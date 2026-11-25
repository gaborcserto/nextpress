import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/posts/a-story" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

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

it("marks a hierarchical parent active when a nested route is current", () => {
  route.pathname = "/section/story";

  render(
    <>
      <NavigationLink href="/en/section">Section</NavigationLink>
      <NavigationLink href="/en/section/story">Story</NavigationLink>
    </>,
  );

  expect(screen.getByRole("link", { name: "Section" })).toHaveAttribute(
    "data-active-route",
    "true",
  );
  expect(screen.getByRole("link", { name: "Section" })).not.toHaveAttribute(
    "aria-current",
  );
  expect(screen.getByRole("link", { name: "Story" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
