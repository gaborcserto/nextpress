import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("@/ui/shell", () => ({ NavItem: ({ label }: { label: string }) => <span>{label}</span> }));

import Sidebar from "./Sidebar";

describe("Sidebar drawer close control", () => {
  it("offers a named button that closes the mobile navigation", () => {
    const onCloseAction = vi.fn();
    render(<Sidebar collapsed={false} role="ADMIN" onCloseAction={onCloseAction} />);
    const close = screen.getByRole("button", { name: "Close navigation" });
    expect(close).toHaveAttribute("type", "button");
    fireEvent.click(close);
    expect(onCloseAction).toHaveBeenCalledOnce();
  });

  it("keeps the desktop collapse control independent of drawer closing", () => {
    const onToggleCollapsedAction = vi.fn();
    render(<Sidebar collapsed={false} role="ADMIN" onToggleCollapsedAction={onToggleCollapsedAction} />);
    expect(screen.queryByRole("button", { name: "Close navigation" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(onToggleCollapsedAction).toHaveBeenCalledOnce();
  });
});
