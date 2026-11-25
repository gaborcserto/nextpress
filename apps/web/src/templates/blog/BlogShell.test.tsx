import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("./MenuTree", () => ({
  MenuTree: ({ items }: { items: PublicMenuItem[] }) => (
    <ul>
      {items.map(({ href, label }, index) => (
        <li key={index}>
          <a href={href === "/" ? "/en/" : `/en${href}`}>
            {label === "/" ? "Home" : label === "/posts" ? "Posts" : label}
          </a>
        </li>
      ))}
    </ul>
  ),
}));

import { BlogShell } from "./BlogShell";

import type { PublicMenuItem } from "@nextpress/shared/api-contracts";

describe("BlogShell", () => {
  it("provides skip navigation to the single main landmark", () => {
    render(
      <BlogShell siteName="NextPress">
        <p>Page content</p>
      </BlogShell>,
    );

    const main = screen.getByRole("main");

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveAttribute("href", `#${main.id}`);
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("links the site identity and configured primary home item to the public home route", () => {
    render(
      <BlogShell
        siteName="Example Publication"
        menus={{
          header: [{ href: "/", label: "/", parent: null, newTab: false }],
          footer: [],
          sidebar: [],
        }}
      >
        <p>Page content</p>
      </BlogShell>,
    );

    expect(
      screen.getByRole("link", { name: "Example Publication" }),
    ).toHaveAttribute("href", "/en/");
    expect(
      within(screen.getByRole("contentinfo")).getByText("Example Publication"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Primary" })).getByRole(
        "link",
        {
          name: "Home",
        },
      ),
    ).toHaveAttribute("href", "/en/");
  });

  it("does not substitute fallback navigation for an explicitly empty menu", () => {
    render(
      <BlogShell
        siteName="Example Publication"
        menus={{ header: [], footer: [], sidebar: [] }}
      >
        <p>Page content</p>
      </BlogShell>,
    );

    expect(
      within(screen.getByRole("navigation", { name: "Primary" })).queryByRole(
        "link",
        { name: "Home" },
      ),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Primary" })).queryByRole(
        "link",
        { name: "Posts" },
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps structural links and renders CMS header and footer links in their separate landmarks", () => {
    render(
      <BlogShell
        siteName="Example Publication"
        menus={{
          header: [
            { href: "/", label: "/", parent: null, newTab: false },
            { href: "/posts", label: "/posts", parent: null, newTab: false },
            { href: "/about", label: "About", parent: null, newTab: false },
            { href: "/contact", label: "Contact", parent: null, newTab: false },
          ],
          footer: [
            { href: "/contact", label: "Contact", parent: null, newTab: false },
          ],
          sidebar: [],
        }}
      >
        <p>Page content</p>
      </BlogShell>,
    );

    const primary = within(screen.getByRole("navigation", { name: "Primary" }));
    expect(primary.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/en/",
    );
    expect(primary.getByRole("link", { name: "Posts" })).toHaveAttribute(
      "href",
      "/en/posts",
    );
    expect(primary.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/en/about",
    );
    expect(primary.getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "/en/contact",
    );
    expect(
      within(screen.getByRole("navigation", { name: "Footer" })).getByRole(
        "link",
        { name: "Contact" },
      ),
    ).toHaveAttribute("href", "/en/contact");
  });
});
