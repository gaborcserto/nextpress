import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActionButton } from "./ActionButton";
import { ActionLink } from "./ActionLink";
import { SkipLink } from "./SkipLink";

describe("public UI primitives", () => {
  it("keeps action links and buttons as their native elements", () => {
    render(
      <>
        <ActionLink href="/posts">Read posts</ActionLink>
        <ActionButton type="submit">Save</ActionButton>
      </>
    );

    expect(screen.getByRole("link", { name: "Read posts" })).toHaveAttribute("href", "/posts");
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "submit");
  });

  it("provides a keyboard skip link to the public main content target", () => {
    render(<SkipLink />);

    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
  });
});
