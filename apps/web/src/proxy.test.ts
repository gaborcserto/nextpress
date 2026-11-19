// @vitest-environment node
import {
  isRequestId,
  newRequestId,
  renderRequestIdHeader,
  requestIdHeader,
} from "@nextpress/shared/request-correlation";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";
describe("public locale proxy", () => {
  it.each([
    "/",
    "/posts?page=2&q=hello",
    "/posts/story",
    "/pages/about",
    "/tags/news",
    "/categories/design",
    "/search?q=hello",
  ])("permanently redirects legacy %s to English", (path) => {
    const response = proxy(
      new NextRequest(`https://publication.example${path}`, {
        headers: { cookie: "np-locale=hu", "accept-language": "hu-HU" },
      }),
    );
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      `https://publication.example/en${path}`,
    );
  });
  it.each(["en", "hu"])(
    "rewrites explicit %s URLs without redirect loops or spoofed locale",
    (locale) => {
      const response = proxy(
        new NextRequest(
          `https://publication.example/${locale}/posts/story?page=2`,
          { headers: { "x-nextpress-locale": "fr", cookie: "np-locale=hu" } },
        ),
      );
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-rewrite")).toBe(
        "https://publication.example/posts/story?page=2",
      );
      expect(
        response.headers.get("x-middleware-request-x-nextpress-locale"),
      ).toBe(locale);
    },
  );
  it("canonicalizes homepage and archive trailing slashes without loops", () => {
    expect(
      proxy(new NextRequest("https://publication.example/en")).headers.get(
        "location",
      ),
    ).toBe("https://publication.example/en/");
    expect(
      proxy(new NextRequest("https://publication.example/en/")).headers.get(
        "location",
      ),
    ).toBeNull();
    expect(
      proxy(
        new NextRequest("https://publication.example/hu/posts/"),
      ).headers.get("location"),
    ).toBe("https://publication.example/hu/posts");
  });
  it.each([
    "/api/public/posts",
    "/admin",
    "/auth/login",
    "/live-preview",
    "/media/asset",
    "/robots.txt",
    "/sitemap.xml",
  ])("stamps %s without rewriting or redirecting", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    const spoofed = newRequestId();
    const response = proxy(
      new NextRequest(`https://publication.example${url}`, {
        headers: { [renderRequestIdHeader]: spoofed },
      }),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    const requestId = response.headers.get(requestIdHeader);
    expect(isRequestId(requestId)).toBe(true);
    expect(requestId).not.toBe(spoofed);
    expect(
      response.headers.get(`x-middleware-request-${renderRequestIdHeader}`),
    ).toBe(requestId);
  });
  it.each(["/_next/static/test.js", "/_next/image", "/favicon.ico"])(
    "skips framework asset %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    },
  );
  it("does not expose preview under a locale prefix", () => {
    expect(
      proxy(
        new NextRequest("https://publication.example/hu/live-preview"),
      ).headers.get("x-middleware-rewrite"),
    ).toBeNull();
  });
});

it("outage probe reaches rendering only at the canonical homepage", () => {
  const root = proxy(new NextRequest("http://localhost:49200/"));
  expect(root.status).toBe(308);
  expect(root.headers.get("location")).toBe("http://localhost:49200/en/");
  const probe = proxy(new NextRequest("http://localhost:49200/en/"));
  expect(probe.headers.get("location")).toBeNull();
  expect(probe.headers.get("x-middleware-rewrite")).toBe(
    "http://localhost:49200/",
  );
});
