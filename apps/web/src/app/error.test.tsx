import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import PublicError from "./error";
import GlobalError from "./global-error";

describe("Public error recovery", () => {
  it("renders the same default skin attributes when the root layout fails", () => {
    const markup = renderToStaticMarkup(
      <GlobalError error={new Error("root failure")} reset={vi.fn()} />,
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
    const reset = vi.fn();
    render(
      <PublicError
        error={new Error("secret database details")}
        reset={reset}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "This page could not be loaded" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("secret database details"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
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
    const reset = vi.fn();
    // The root error renders its own <html> and needs a document with a window.
    const frame = document.body.appendChild(document.createElement("iframe"));
    onTestFinished(() => frame.remove());
    const errorDocument = frame.contentDocument;

    if (!errorDocument) {
      throw new Error("Expected a document for the global error page");
    }

    const page = render(
      <GlobalError error={new Error("private root failure")} reset={reset} />,
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

    expect(reset).toHaveBeenCalledOnce();
  });
});
