import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BlogShell } from "./BlogShell";

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

  it("links the site identity and primary navigation to the public home route", () => {
    render(
      <BlogShell siteName="Example Publication">
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

  it("keeps structural links and renders CMS header and footer links in their separate landmarks", () => {
    render(
      <BlogShell
        siteName="Example Publication"
        headerPages={[
          { slug: "about", title: "About" },
          { slug: "contact", title: "Contact" },
        ]}
        footerPages={[{ slug: "contact", title: "Contact" }]}
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
      "/en/pages/about",
    );
    expect(primary.getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "/en/pages/contact",
    );
    expect(
      within(screen.getByRole("navigation", { name: "Footer" })).getByRole(
        "link",
        { name: "Contact" },
      ),
    ).toHaveAttribute("href", "/en/pages/contact");
  });
});
