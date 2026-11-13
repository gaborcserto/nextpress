import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("Public not-found state", () => {
  it("renders a standalone 404 with one arrowed home link", () => {
    render(<NotFound />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "404" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Recovery" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(
      screen
        .getByRole("link", { name: "Back to home" })
        .querySelector('svg[aria-hidden="true"]'),
    ).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });
});
