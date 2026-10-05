import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Topbar from "./Topbar";

const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(() => ({ data: { user: { name: "Admin" } } })),
}));

vi.mock("@/lib/auth/auth-client", () => ({ useSession: useSessionMock }));
vi.mock("@/ui/components", () => ({
  ThemeToggle: () => null,
  UserAvatar: () => <span>Admin avatar</span>,
}));
vi.mock("@/ui/shell", () => ({
  Breadcrumbs: () => null,
  UserMenu: () => null,
}));

describe("Topbar mobile navigation", () => {
  it("provides an accessible trigger for opening mobile navigation", () => {
    const onOpen = vi.fn();
    render(<Topbar scrolled={false} onMobileNavOpenAction={onOpen} />);

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(onOpen).toHaveBeenCalledOnce();
  });
});
