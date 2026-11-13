import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/posts/a-story" }));

import { NavigationLink } from "./NavigationLink";

it("indicates the active posts section on article routes", () => {
  render(
    <>
      <NavigationLink href="/en/posts">Posts</NavigationLink>
      <NavigationLink href="/">Home</NavigationLink>
    </>,
  );
  expect(screen.getByRole("link", { name: "Posts" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
    "aria-current",
  );
});
