import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserAvatar } from "./UserAvatar";

describe("UserAvatar browser URL boundary", () => {
  it("falls back to the generated avatar for an unsafe persisted URL", () => {
    const { container } = render(<UserAvatar name="Ada" image="javascript:alert(1)" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("preserves OAuth avatar rendering and its no-referrer policy", () => {
    render(<UserAvatar name="Ada" image="https://avatars.githubusercontent.com/u/1" />);
    expect(screen.getByRole("img", { name: "Ada avatar" })).toHaveAttribute("src", "https://avatars.githubusercontent.com/u/1?s=36");
    expect(screen.getByRole("img", { name: "Ada avatar" })).toHaveAttribute("referrerpolicy", "no-referrer");
  });
});
