import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserAvatar } from "./UserAvatar";

describe("UserAvatar", () => {
  it("uses deterministic Unicode initials and a missing-name fallback", () => {
    const { rerender } = render(
      <UserAvatar name="  Árvíz   Tükörfúró Gép  " />,
    );
    expect(
      screen.getByRole("img", { name: "Árvíz Tükörfúró Gép avatar" }),
    ).toHaveTextContent("ÁG");
    rerender(<UserAvatar name=" " />);
    expect(
      screen.getByRole("img", { name: "Account avatar" }),
    ).toHaveTextContent("?");
  });
  it("falls back to initials for an unsafe persisted URL", () => {
    const { container } = render(
      <UserAvatar name="Ada" image="javascript:alert(1)" />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Ada avatar" })).toHaveTextContent(
      "A",
    );
  });

  it("preserves OAuth avatar rendering and its no-referrer policy", () => {
    render(
      <UserAvatar
        name="Ada"
        image="https://avatars.githubusercontent.com/u/1"
      />,
    );
    const image = screen
      .getByRole("img", { name: "Ada avatar" })
      .querySelector("img");
    expect(image).toHaveAttribute(
      "src",
      "https://avatars.githubusercontent.com/u/1?s=36",
    );
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");

    if (image) {
      fireEvent.error(image);
    }

    expect(screen.getByRole("img", { name: "Ada avatar" })).toHaveTextContent(
      "A",
    );
  });
});
