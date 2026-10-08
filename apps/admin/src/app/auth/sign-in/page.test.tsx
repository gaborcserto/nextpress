import { beforeEach, expect, it, vi } from "vitest";

const { session, getProviders, redirect } = vi.hoisted(() => ({
  session: vi.fn(),
  getProviders: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/auth-server", () => ({
  getSessionWithRole: session,
  getOperationalOAuthProviders: getProviders,
}));
vi.mock("@/components/auth/SignInForm", () => ({ default: vi.fn() }));

import SignInPageRoute from "./page";
import SignInForm from "@/components/auth/SignInForm";

beforeEach(() => {
  vi.resetAllMocks();
  redirect.mockImplementation(() => { throw new Error("redirect"); });
});

it("redirects an existing session to the Dashboard", async () => {
  session.mockResolvedValue({ user: { id: "user-1" } });

  await expect(SignInPageRoute()).rejects.toThrow("redirect");

  expect(redirect).toHaveBeenCalledWith("/admin");
  expect(getProviders).not.toHaveBeenCalled();
});

it("renders the sign-in form when there is no session", async () => {
  session.mockResolvedValue(null);
  getProviders.mockResolvedValue(["google"]);

  const page = await SignInPageRoute();

  expect(page.type).toBe(SignInForm);
  expect(page.props).toEqual({ providers: ["google"] });
});
