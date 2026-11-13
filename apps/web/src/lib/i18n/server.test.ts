import { describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({
  locale: "",
  cookie: "hu",
  accepted: "hu-HU",
}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-nextpress-locale": request.locale,
      "accept-language": request.accepted,
      cookie: `np-locale=${request.cookie}`,
    }),
}));
import { getLocale } from "./server";
describe("SSR URL locale", () => {
  it("uses explicit URL locale regardless of saved or browser preference", async () => {
    request.locale = "en";
    expect(await getLocale()).toBe("en");
    request.locale = "hu";
    request.cookie = "en";
    request.accepted = "en";
    expect(await getLocale()).toBe("hu");
  });
  it("defaults to English for missing or invalid routing locale", async () => {
    for (const locale of ["", "fr", "../../hu"]) {
      request.locale = locale;
      expect(await getLocale()).toBe("en");
    }
  });
});
