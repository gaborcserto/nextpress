import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import ApiDocsPage from "./page";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("./swagger-docs", () => ({ default: () => <div>Interactive API documentation</div> }));
afterEach(() => vi.unstubAllEnvs());

it.each(["production", "test"])("hides documentation in %s", (environment) => {
  vi.stubEnv("NODE_ENV", environment);
  expect(() => ApiDocsPage()).toThrow("NEXT_NOT_FOUND");
});

it("renders the development warning, JSON link, and Swagger UI slot", () => {
  vi.stubEnv("NODE_ENV", "development");
  render(<ApiDocsPage />);
  expect(screen.getByRole("heading", { name: "NextPress API" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View OpenAPI JSON" })).toHaveAttribute("href", "/api/openapi");
  expect(screen.getByRole("alert")).toHaveTextContent("Write requests can modify real data");
  expect(screen.getByText("Interactive API documentation")).toBeInTheDocument();
});
