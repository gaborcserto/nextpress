import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import ApiDocsPage from "./page";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "Content-Security-Policy": "script-src 'self' 'nonce-test-nonce' 'strict-dynamic'" }),
}));
vi.mock("next/script", () => ({
  default: ({ src, nonce }: { src: string; nonce: string }) => (
    <span data-testid="swagger-ui-script" data-src={src} data-nonce={nonce} />
  ),
}));
afterEach(() => vi.unstubAllEnvs());

it.each(["production", "test"])("hides documentation in %s", async (environment) => {
  vi.stubEnv("NODE_ENV", environment);
  await expect(ApiDocsPage()).rejects.toThrow("NEXT_NOT_FOUND");
});

it("renders the development warning, JSON source, local bundle, and CSP nonce", async () => {
  vi.stubEnv("NODE_ENV", "development");
  render(await ApiDocsPage());
  expect(screen.getByRole("heading", { name: "NextPress API" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View OpenAPI JSON" })).toHaveAttribute("href", "/api/openapi");
  expect(screen.getByRole("alert")).toHaveTextContent("Write requests can modify real data");
  expect(document.getElementById("swagger-ui")).toBeInTheDocument();
  expect(screen.getByTestId("swagger-ui-script")).toHaveAttribute("data-src", "/api-docs/swagger-ui-bundle.js");
  expect(screen.getByTestId("swagger-ui-script")).toHaveAttribute("data-nonce", "test-nonce");
});
