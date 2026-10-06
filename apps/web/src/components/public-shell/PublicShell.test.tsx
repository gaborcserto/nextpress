import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicShell } from "./PublicShell";

describe("PublicShell", () => {
  it("provides skip navigation to the single main landmark", () => {
    render(
      <PublicShell siteName="NextPress">
        <p>Page content</p>
      </PublicShell>
    );

    const main = screen.getByRole("main");

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      `#${main.id}`
    );
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("links the site identity and primary navigation to the public home route", () => {
    render(
      <PublicShell siteName="Example Publication">
        <p>Page content</p>
      </PublicShell>
    );

    expect(screen.getByRole("link", { name: "Example Publication" })).toHaveAttribute("href", "/");
    expect(within(screen.getByRole("contentinfo")).getByText("Example Publication")).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Primary" })).getByRole("link", {
        name: "Home",
      })
    ).toHaveAttribute("href", "/");
  });

  it("keeps structural links and renders CMS header and footer links in their separate landmarks", () => {
    render(
      <PublicShell
        siteName="Example Publication"
        headerPages={[{ slug: "about", title: "About" }, { slug: "contact", title: "Contact" }]}
        footerPages={[{ slug: "contact", title: "Contact" }]}
      >
        <p>Page content</p>
      </PublicShell>
    );

    const primary = within(screen.getByRole("navigation", { name: "Primary" }));
    expect(primary.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(primary.getByRole("link", { name: "Posts" })).toHaveAttribute("href", "/posts");
    expect(primary.getByRole("link", { name: "About" })).toHaveAttribute("href", "/pages/about");
    expect(primary.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/pages/contact");
    expect(within(screen.getByRole("navigation", { name: "Footer" })).getByRole("link", { name: "Contact" }))
      .toHaveAttribute("href", "/pages/contact");
  });
});
