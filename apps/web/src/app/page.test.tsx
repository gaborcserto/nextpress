import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("renders the documentation link", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "Read our docs" })).toHaveAttribute(
      "href",
      expect.stringContaining("nextjs.org/docs")
    );
  });
});
