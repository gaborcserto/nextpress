import { serviceUnavailableDigest } from "@nextpress/shared/service-unavailable";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import PublicError from "./error";
import GlobalError from "./global-error";

describe("Public error recovery", () => {
  it("shows an outage using the production-safe error digest", () => {
    const error = Object.assign(new Error("redacted by Next.js"), {
      digest: serviceUnavailableDigest(),
    });
    render(<PublicError error={error} retry={vi.fn()} />);

    expect(screen.getByRole("main")).toHaveTextContent("503");
    expect(screen.getByRole("heading")).toHaveTextContent(
      "Service temporarily unavailable",
    );
    expect(screen.queryByText("redacted by Next.js")).not.toBeInTheDocument();
  });

  it("renders the same default skin attributes when the root layout fails", () => {
    const markup = renderToStaticMarkup(
      <GlobalError error={new Error("root failure")} retry={vi.fn()} />,
    );
    const html = new DOMParser().parseFromString(
      markup,
      "text/html",
    ).documentElement;
    expect(html.getAttribute("data-skin")).toBe("default");
    expect(html.getAttribute("data-color-mode")).toBe("light");
    expect(html.hasAttribute("data-theme")).toBe(false);
  });

  it("keeps unexpected route failures generic and provides retry and navigation", () => {
    const retry = vi.fn();
    render(
      <PublicError
        error={new Error("secret database details")}
        retry={retry}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "This page could not be loaded" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("secret database details"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/en/",
    );
    expect(screen.getByRole("link", { name: "Posts" })).toHaveAttribute(
      "href",
      "/en/posts",
    );
  });

  it("redacts root layout errors and lets visitors retry or navigate away", () => {
    const retry = vi.fn();
    // The root error renders its own <html> and needs a document with a window.
    const frame = document.body.appendChild(document.createElement("iframe"));
    onTestFinished(() => frame.remove());
    const errorDocument = frame.contentDocument;

    if (!errorDocument) {
      throw new Error("Expected a document for the global error page");
    }

    const page = render(
      <GlobalError error={new Error("private root failure")} retry={retry} />,
      { container: errorDocument, baseElement: errorDocument },
    );

    expect(
      page.getByRole("heading", { name: "This page could not be loaded" }),
    ).toBeInTheDocument();
    expect(page.queryByText("private root failure")).not.toBeInTheDocument();
    expect(page.getByRole("link", { name: "Posts" })).toHaveAttribute(
      "href",
      "/en/posts",
    );

    fireEvent.click(page.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledOnce();
  });
});
