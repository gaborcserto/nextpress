import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("Public not-found state", () => {
  it("uses the same unavailable message and offers Home and Posts recovery", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText("This page is unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Recovery" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Posts" })).toHaveAttribute("href", "/posts");
  });
});
