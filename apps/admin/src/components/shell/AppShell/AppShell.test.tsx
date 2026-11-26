import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AppShell from "./AppShell";

const { pathname } = vi.hoisted(() => ({ pathname: vi.fn(() => "/admin") }));
vi.mock("next/navigation", () => ({ usePathname: pathname }));
vi.mock("../Topbar", () => ({
  Topbar: ({
    mobileNavOpen,
    onMobileNavOpenAction,
  }: {
    mobileNavOpen: boolean;
    onMobileNavOpenAction: () => void;
  }) => (
    <button aria-expanded={mobileNavOpen} onClick={onMobileNavOpenAction}>
      Open navigation
    </button>
  ),
}));

let desktop = false;
let viewportChange: (() => void) | undefined;

beforeEach(() => {
  desktop = false;
  pathname.mockReturnValue("/admin");
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return desktop;
    },
    addEventListener(_event: string, listener: () => void) {
      viewportChange = listener;
    },
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => vi.unstubAllGlobals());

function openNavigation() {
  const trigger = screen.getByRole("button", { name: "Open navigation" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Admin navigation" });

  return { trigger, dialog };
}

describe("AppShell mobile navigation", () => {
  it.each(["escape", "button"])(
    "dismisses through %s and restores the trigger",
    (method) => {
      render(<AppShell role="ADMIN">Page</AppShell>);
      const { trigger, dialog } = openNavigation();
      const close = within(dialog).getByRole("button", {
        name: "Close navigation",
      });
      expect(close).toHaveFocus();
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      if (method === "escape") {
        fireEvent(dialog, new Event("cancel", { cancelable: true }));
      } else {
        fireEvent.click(close);
      }

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    },
  );

  it("focuses the most specific current link at the desktop breakpoint", () => {
    pathname.mockReturnValue("/admin/settings/menus");
    render(<AppShell role="ADMIN">Page</AppShell>);
    const { trigger, dialog } = openNavigation();
    const navigation = within(dialog).getByRole("navigation");

    expect(
      within(navigation).getByRole("link", { current: "page" }),
    ).toHaveTextContent("Menus");

    act(() => {
      desktop = true;
      viewportChange?.();
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Menus" })).toHaveFocus();
  });

  it("closes on navigation and stays closed when going back", () => {
    const { rerender } = render(<AppShell role="ADMIN">Page</AppShell>);
    openNavigation();
    pathname.mockReturnValue("/admin/users");
    rerender(<AppShell role="ADMIN">Users</AppShell>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    pathname.mockReturnValue("/admin");
    rerender(<AppShell role="ADMIN">Page</AppShell>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
