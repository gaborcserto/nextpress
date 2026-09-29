import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Box from "@/ui/primitives/Box/Box";

describe("Box", () => {
  it("renders its content in a surface", () => {
    render(<Box>Settings</Box>);

    expect(screen.getByText("Settings")).toHaveClass("bg-base-100");
  });
});
