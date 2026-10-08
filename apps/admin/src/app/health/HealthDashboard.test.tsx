import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import HealthDashboard from "./HealthDashboard";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) }));
});

it("shows the health result and safe environment values", async () => {
  render(<HealthDashboard environment="production" deployment="Unknown" />);

  expect(await screen.findByText("Available")).toBeInTheDocument();
  expect(screen.getByText("production")).toBeInTheDocument();
  expect(within(screen.getByRole("heading", { name: "Environment" }).parentElement!.parentElement!).getAllByText("Unknown")).toHaveLength(1);
  expect(screen.getByText(/ms$/)).toBeInTheDocument();
  expect(screen.getByText("Last successful check").parentElement).toHaveTextContent("Last successful check");
  expect(fetch).toHaveBeenCalledWith("/api/health", { cache: "no-store" });
});

it("supports manual refresh and reports unavailable metrics on failure", async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ status: "ok" }) } as Response);
  render(<HealthDashboard environment="Unknown" deployment="Unknown" />);
  expect(await screen.findByText("Available")).toBeInTheDocument();
  const previousTimestamp = screen.getByRole("heading", { name: "Last successful check" }).parentElement!.parentElement!.querySelector("p.text-lg")?.textContent;

  fetchMock.mockRejectedValueOnce(new Error("network failure"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the health endpoint");
  await waitFor(() => expect(screen.getByText("Unavailable")).toBeInTheDocument());
  expect(screen.getByRole("heading", { name: "Last successful check" }).parentElement!.parentElement).toHaveTextContent(previousTimestamp ?? "");
});
