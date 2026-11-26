import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import dropdownStyles from "@/components/public-ui/PublicDropdown.module.css";

vi.mock("@/lib/i18n/client", () => ({
  UiText: ({ id }: { id: string }) => id,
}));

vi.mock("@/lib/i18n/server", () => ({
  getLocale: async () => "en",
}));

vi.mock("../NavigationLink/NavigationLink", () => ({
  NavigationLink: ({
    children,
    className,
    href,
  }: {
    children: React.ReactNode;
    className?: string;
    href: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { MenuTree } from "./MenuTree";

it("keeps dropdown treatment on nested links, not top-level navigation", async () => {
  render(
    await MenuTree({
      dropdown: true,
      items: [
        { parent: null, href: "/section", label: "Section", newTab: false },
        { parent: 0, href: "/section/child", label: "Child", newTab: false },
      ],
    }),
  );

  expect(screen.getByRole("link", { name: "Section" })).not.toHaveClass("item");
  expect(screen.getByRole("link", { name: "Child" })).toHaveClass(
    dropdownStyles.item,
  );
});

it("renders a group as a non-navigating submenu trigger", async () => {
  render(
    await MenuTree({
      dropdown: true,
      items: [
        { parent: null, href: null, label: "Explore", newTab: false },
        {
          parent: 0,
          href: "https://example.test/about",
          label: "About",
          newTab: false,
        },
      ],
    }),
  );

  expect(screen.queryByRole("link", { name: "Explore" })).toBeNull();
  const toggle = screen.getByLabelText("Open submenu for Explore");
  expect(toggle.tagName).toBe("SUMMARY");
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle.parentElement).toHaveAttribute("data-chevron", "false");
  fireEvent.click(toggle);
  expect(toggle.parentElement).toHaveAttribute("open");
  expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
    "href",
    "https://example.test/about",
  );
});

it("keeps linked parents navigable with an independent chevron only when children exist", async () => {
  render(
    await MenuTree({
      dropdown: true,
      items: [
        { parent: null, href: "/section", label: "Section", newTab: false },
        { parent: 0, href: "/section/child", label: "Child", newTab: false },
        { parent: null, href: "/about", label: "About", newTab: false },
      ],
    }),
  );

  expect(screen.getByRole("link", { name: "Section" })).toHaveAttribute(
    "href",
    "/section",
  );
  expect(screen.getByLabelText("Open submenu for Section")).toBeInTheDocument();
  expect(screen.queryByLabelText("Open submenu for About")).toBeNull();
});

it("preserves nested disclosure interaction", async () => {
  render(
    await MenuTree({
      dropdown: true,
      items: [
        { parent: null, href: null, label: "Explore", newTab: false },
        { parent: 0, href: null, label: "Topics", newTab: false },
        { parent: 1, href: "/topic/one", label: "One", newTab: false },
      ],
    }),
  );

  fireEvent.click(screen.getByLabelText("Open submenu for Explore"));
  fireEvent.click(screen.getByLabelText("Open submenu for Topics"));

  expect(screen.getByRole("link", { name: "One" })).toHaveAttribute(
    "href",
    "/topic/one",
  );
});
