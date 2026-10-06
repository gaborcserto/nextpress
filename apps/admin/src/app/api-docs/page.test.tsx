import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import ApiDocsPage from "./page";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
afterEach(() => vi.unstubAllEnvs());

it.each(["production", "test"])("hides documentation in %s", (environment) => {
  vi.stubEnv("NODE_ENV", environment);
  expect(() => ApiDocsPage()).toThrow("NEXT_NOT_FOUND");
});

it("renders the development contract reference without request controls", () => {
  vi.stubEnv("NODE_ENV", "development");
  render(<ApiDocsPage />);
  expect(screen.getByRole("heading", { name: "NextPress API" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View OpenAPI JSON" })).toHaveAttribute("href", "/api/openapi");
  expect(screen.getByText("GET /api/health — Application liveness")).toBeInTheDocument();
  expect(screen.getByText("PATCH /api/admin/users/{id}/role — Assign a user role")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
