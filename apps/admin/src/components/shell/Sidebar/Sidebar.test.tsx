import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("../NavItem", () => ({
  NavItem: ({
    label,
    IconAction,
  }: {
    label: string;
    IconAction: { name: string };
  }) => <span data-icon={IconAction.name}>{label}</span>,
}));

import Sidebar from "./Sidebar";

describe("Sidebar drawer close control", () => {
  it("uses the shared posts and pages navigation icons", () => {
    render(<Sidebar collapsed={false} role="ADMIN" />);

    expect(screen.getByText("Posts")).toHaveAttribute(
      "data-icon",
      "FaNewspaper",
    );
    expect(screen.getByText("Pages")).toHaveAttribute("data-icon", "FaCopy");
  });

  it("shows the full branded wordmark when expanded", () => {
    render(<Sidebar collapsed={false} role="ADMIN" />);

    expect(screen.getByLabelText("nextpress.")).toHaveTextContent("nextpress.");
    expect(
      screen.getByLabelText("nextpress.").querySelector("span"),
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the centered compact wordmark when collapsed", () => {
    render(<Sidebar collapsed role="ADMIN" />);

    expect(screen.getByLabelText("nextpress.")).toHaveTextContent("np.");
  });

  it("offers a named button that closes the mobile navigation", () => {
    const onCloseAction = vi.fn();
    render(
      <Sidebar collapsed={false} role="ADMIN" onCloseAction={onCloseAction} />,
    );
    const close = screen.getByRole("button", { name: "Close navigation" });
    expect(close).toHaveAttribute("type", "button");
    fireEvent.click(close);
    expect(onCloseAction).toHaveBeenCalledOnce();
  });

  it("keeps the desktop collapse control independent of drawer closing", () => {
    const onToggleCollapsedAction = vi.fn();
    render(
      <Sidebar
        collapsed={false}
        role="ADMIN"
        onToggleCollapsedAction={onToggleCollapsedAction}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Close navigation" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(onToggleCollapsedAction).toHaveBeenCalledOnce();
  });
});
