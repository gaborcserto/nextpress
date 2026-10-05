import { act, fireEvent, render, screen, within } from "@testing-library/react";
import Link from "next/link";
import { afterEach, describe, expect, it, vi } from "vitest";

import AppShell from "./AppShell";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn(() => "/admin") }));

vi.mock("next/navigation", () => ({ usePathname: pathnameMock }));
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, initial: _initial, animate: _animate, transition: _transition, layout: _layout, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => <div {...props}>{children}</div>,
    span: ({ children, initial: _initial, animate: _animate, transition: _transition, layout: _layout, ...props }: React.HTMLAttributes<HTMLSpanElement> & Record<string, unknown>) => <span {...props}>{children}</span>,
  },
}));
vi.mock("@/ui/hooks/useStickyScrolled", () => ({ useStickyScrolled: () => false }));
vi.mock("@/ui/shell", () => ({
  Sidebar: ({ onItemClickAction }: { onItemClickAction?: () => void }) => (
    <nav aria-label="Admin navigation">
      <Link href="/admin" onClick={onItemClickAction}>Dashboard</Link>
      <Link href="/admin/pages" onClick={onItemClickAction}>Pages</Link>
    </nav>
  ),
  Topbar: ({
    mobileNavOpen,
    mobileNavTriggerRef,
    onMobileNavOpenAction,
  }: {
    mobileNavOpen: boolean;
    mobileNavTriggerRef: (node: HTMLButtonElement | null) => void;
    onMobileNavOpenAction: () => void;
  }) => (
    <header>
      <button ref={mobileNavTriggerRef} aria-expanded={mobileNavOpen} onClick={onMobileNavOpenAction}>
        Open navigation
      </button>
    </header>
  ),
}));

afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

describe("AppShell mobile navigation", () => {
  it("contains focus in the open drawer and restores it to the trigger on Escape", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    render(<AppShell role="ADMIN">Page</AppShell>);
    const trigger = screen.getByRole("button", { name: "Open navigation" });

    fireEvent.click(trigger);
    const drawer = screen.getByRole("dialog", { name: "Admin navigation" });
    const links = within(drawer).getAllByRole("link");
    expect(links[0]).toHaveFocus();
    expect(trigger.closest(".flex.h-full")).toHaveAttribute("inert");

    links[links.length - 1].focus();
    fireEvent.keyDown(links[links.length - 1], { key: "Tab" });
    expect(links[0]).toHaveFocus();

    fireEvent.keyDown(drawer, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("clears the mobile drawer and restores desktop interaction at the breakpoint", () => {
    let matches = false;
    let onChange: (() => void) | undefined;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        get matches() { return matches; },
        addEventListener: (_type: string, listener: () => void) => { onChange = listener; },
        removeEventListener: vi.fn(),
      })),
    });
    const onPageAction = vi.fn();
    render(<AppShell role="ADMIN"><button onClick={onPageAction}>Page action</button></AppShell>);
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(trigger);

    const drawer = screen.getByRole("dialog", { name: "Admin navigation" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger.closest(".flex.h-full")).toHaveAttribute("inert");
    expect(within(drawer).getByRole("link", { name: "Dashboard" })).toHaveFocus();

    act(() => {
      matches = true;
      onChange?.();
    });

    expect(screen.queryByRole("dialog", { name: "Admin navigation" })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger.closest(".flex.h-full")).not.toHaveAttribute("inert");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Page action" }));
    expect(onPageAction).toHaveBeenCalledOnce();
  });
});
