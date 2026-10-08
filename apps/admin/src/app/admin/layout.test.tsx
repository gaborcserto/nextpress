import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { session, redirect } = vi.hoisted(() => ({ session: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth/auth-server", () => ({ getSessionWithRole: session }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/ui/shell", () => ({
  AppShell: ({ children, role }: { children: ReactNode; role: string | null }) => (
    <div data-role={role}>{children}</div>
  ),
}));

import AdminLayout from "./layout";
import type { ReactNode } from "react";

beforeEach(() => {
  vi.resetAllMocks();
  redirect.mockImplementation(() => { throw new Error("redirect"); });
});

it.each([null, { user: {} }])("denies a request without a validated user", async (value) => {
  session.mockResolvedValue(value);
  await expect(AdminLayout({ children: <div>Protected screen</div> })).rejects.toThrow("redirect");
  expect(redirect).toHaveBeenCalledWith("/auth/sign-in?callbackUrl=%2Fadmin");
});

it.each(["ADMIN", "EDITOR", "AUTHOR", "SUBSCRIBER", null])("renders authenticated children with role %s", async (role) => {
  session.mockResolvedValue({ user: { id: "user-1", role } });
  render(await AdminLayout({ children: <div>Protected screen</div> }));
  expect(screen.getByText("Protected screen").parentElement?.getAttribute("data-role")).toBe(role);
  expect(redirect).not.toHaveBeenCalled();
});

it("revalidates access after the session is removed on a subsequent request", async () => {
  session.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } }).mockResolvedValueOnce(null);
  await AdminLayout({ children: <div>Dashboard</div> });
  await expect(AdminLayout({ children: <div>Posts</div> })).rejects.toThrow("redirect");
  expect(session).toHaveBeenCalledTimes(2);
});
