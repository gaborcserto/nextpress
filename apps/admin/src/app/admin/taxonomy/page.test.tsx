import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { session, redirect } = vi.hoisted(() => ({ session: vi.fn(), redirect: vi.fn() }));
vi.mock("@nextpress/db/src/client", () => ({ prisma: {} }));
vi.mock("@/lib/auth/auth-server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/auth-server")>(),
  getSessionWithRole: session,
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/components/admin/TaxonomyScreen", () => ({ default: () => <div>Taxonomy records</div> }));

import AdminTaxonomyRoute from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  redirect.mockImplementation(() => { throw new Error("redirect"); });
});

it("redirects missing sessions to sign-in with the taxonomy return URL", async () => {
  session.mockResolvedValue(null);
  await expect(AdminTaxonomyRoute()).rejects.toThrow("redirect");
  expect(redirect).toHaveBeenCalledWith("/auth/sign-in?callbackUrl=%2Fadmin%2Ftaxonomy");
});

it.each(["ADMIN", "EDITOR", "AUTHOR"])("renders taxonomy for an authenticated %s", async (role) => {
  session.mockResolvedValue({ user: { id: "user-1", role } });
  render(await AdminTaxonomyRoute());
  expect(screen.getByText("Taxonomy records")).toBeInTheDocument();
  expect(redirect).not.toHaveBeenCalled();
});

it.each(["SUBSCRIBER", null])("shows denied access for role %s", async (role) => {
  session.mockResolvedValue({ user: { id: "user-1", role } });
  render(await AdminTaxonomyRoute());
  expect(screen.getByRole("alert")).toHaveTextContent("You do not have permission");
  expect(screen.queryByText("Taxonomy records")).not.toBeInTheDocument();
});
