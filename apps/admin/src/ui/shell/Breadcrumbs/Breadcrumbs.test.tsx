import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname }));

import Breadcrumbs from "./Breadcrumbs";

afterEach(() => vi.unstubAllGlobals());

describe("Breadcrumbs", () => {
  it("keeps ancestor links and marks the current page", () => {
    usePathname.mockReturnValue("/admin/posts/new");
    render(<Breadcrumbs />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
    expect(within(nav).getByRole("link", { name: "Posts" })).toHaveAttribute("href", "/admin/posts");
    expect(within(nav).getByText("Create Post")).toHaveAttribute("aria-current", "page");
  });

  it("keeps the full detail title available when the displayed breadcrumb is truncated", async () => {
    const title = "A long article title that remains available on narrow mobile screens";
    usePathname.mockReturnValue("/admin/posts/dev-seed-post-long-form");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ item: { title } }) }));
    render(<Breadcrumbs />);
    await waitFor(() => expect(screen.getByText(title)).toHaveAttribute("title", title));
    expect(screen.getByText(title)).toHaveAttribute("aria-current", "page");
  });
});
