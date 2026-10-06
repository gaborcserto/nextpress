import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import UserMenu from "./UserMenu";

const { signOut, replace, showToast } = vi.hoisted(() => ({
  signOut: vi.fn(), replace: vi.fn(), showToast: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/lib/auth/auth-client", () => ({ signOut }));
vi.mock(import("@/ui/utils"), async (importOriginal) => ({ ...await importOriginal(), showToast }));

beforeEach(() => vi.resetAllMocks());

function clickSignOut() {
  render(<UserMenu name="User" />);
  fireEvent.click(screen.getByRole("button", { name: "Open user menu" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
}

describe("logout feedback", () => {
  it("redirects after successful server logout", async () => {
    signOut.mockResolvedValue({ error: null });
    clickSignOut();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/auth/sign-in"));
    expect(showToast).not.toHaveBeenCalled();
  });

  it("shows revocation failure instead of presenting a successful logout", async () => {
    signOut.mockResolvedValue({ error: { code: "SESSION_REVOCATION_FAILED", status: 500 } });
    clickSignOut();
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Sign out failed", "error"));
    expect(replace).not.toHaveBeenCalled();
  });
});
