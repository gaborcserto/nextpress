import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAdminLocale } from "@/lib/i18n/admin-locale";

import Topbar from "./Topbar";

const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(() => ({ data: { user: { name: "Admin" } } })),
}));

vi.mock("@/lib/auth/auth-client", () => ({ useSession: useSessionMock }));
vi.mock("@/ui/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../Breadcrumbs", () => ({ Breadcrumbs: () => null }));
vi.mock("../UserMenu", () => ({ UserMenu: () => null }));

describe("Topbar mobile navigation", () => {
  afterEach(() => setAdminLocale("en"));

  it("changes Admin language from the accessible language menu", async () => {
    setAdminLocale("en");
    render(<Topbar mobileNavOpen={false} onMobileNavOpenAction={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Admin language: English" }),
    );
    const hungarian = screen.getByRole("menuitemradio", {
      name: "Magyar",
    });
    expect(hungarian).toHaveAttribute("aria-checked", "false");
    fireEvent.click(hungarian);

    expect(document.cookie).toContain("admin-locale=hu");
    expect(
      screen.getByRole("button", { name: "Admin nyelve: Magyar" }),
    ).toBeVisible();
  });

  it("provides an accessible trigger for opening mobile navigation", () => {
    const onOpen = vi.fn();
    render(<Topbar mobileNavOpen={false} onMobileNavOpenAction={onOpen} />);

    const trigger = screen.getByRole("button", {
      name: "Open navigation",
      expanded: false,
    });
    expect(trigger).toHaveAttribute("aria-controls", "admin-mobile-navigation");
    fireEvent.click(trigger);

    expect(onOpen).toHaveBeenCalledOnce();
  });
});
