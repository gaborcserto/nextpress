import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PublicError from "./error";
import GlobalError from "./global-error";

describe("Public error recovery", () => {
  it("renders the same default skin attributes when the root layout fails", () => {
    const markup = renderToStaticMarkup(<GlobalError error={new Error("root failure")} reset={vi.fn()} />);
    const html = new DOMParser().parseFromString(markup, "text/html").documentElement;
    expect(html.getAttribute("data-skin")).toBe("default");
    expect(html.getAttribute("data-color-mode")).toBe("light");
    expect(html.hasAttribute("data-theme")).toBe(false);
  });

  it("keeps unexpected route failures generic and provides retry and navigation", () => {
    const reset = vi.fn();
    render(<PublicError error={new Error("secret database details")} reset={reset} />);

    expect(screen.getByRole("heading", { name: "This page could not be loaded" })).toBeInTheDocument();
    expect(screen.queryByText("secret database details")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Posts" })).toHaveAttribute("href", "/posts");
  });

  it("provides the same safe recovery when the root layout fails", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("private root failure")} reset={reset} />);

    expect(screen.getByRole("heading", { name: "This page could not be loaded" })).toBeInTheDocument();
    expect(screen.queryByText("private root failure")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Posts" })).toHaveAttribute("href", "/posts");
  });
});
