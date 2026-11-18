import { APPEARANCE_CATALOG, DEFAULT_APPEARANCE } from "@nextpress/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AppearanceSettings from "./AppearanceSettings";

const { jsonFetcher } = vi.hoisted(() => ({ jsonFetcher: vi.fn() }));
vi.mock("@/lib/api", () => ({ jsonFetcher }));

describe("AppearanceSettings", () => {
  beforeEach(() => {
    jsonFetcher.mockReset();
  });

  it("waits for compatible configuration and saves only the appearance fields", async () => {
    jsonFetcher
      .mockResolvedValueOnce(DEFAULT_APPEARANCE)
      .mockResolvedValueOnce(APPEARANCE_CATALOG)
      .mockResolvedValueOnce({ ...DEFAULT_APPEARANCE, stylePreset: "modern" });
    render(<AppearanceSettings />);

    const preset = await screen.findByRole("combobox", {
      name: "Style variant",
    });
    expect(preset).toHaveValue("classic");
    fireEvent.change(preset, { target: { value: "modern" } });
    fireEvent.click(screen.getByRole("button", { name: "Save appearance" }));

    expect(await screen.findByText("Appearance saved.")).toHaveAttribute(
      "role",
      "status",
    );
    expect(jsonFetcher).toHaveBeenLastCalledWith(
      "/api/admin/settings/appearance",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...DEFAULT_APPEARANCE, stylePreset: "modern" }),
      },
    );
  });

  it("offers a retry and prevents saving an incompatible active selection", async () => {
    jsonFetcher
      .mockResolvedValueOnce({ ...DEFAULT_APPEARANCE, stylePreset: "obsolete" })
      .mockResolvedValueOnce(APPEARANCE_CATALOG)
      .mockResolvedValueOnce(DEFAULT_APPEARANCE)
      .mockResolvedValueOnce(APPEARANCE_CATALOG);
    render(<AppearanceSettings />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load website appearance.",
    );
    expect(
      screen.queryByRole("button", { name: "Save appearance" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Retry loading appearance" }),
    );

    expect(
      await screen.findByRole("combobox", { name: "Style variant" }),
    ).toHaveValue("classic");
  });

  it("announces rejected saves and keeps the proposed variant selected", async () => {
    jsonFetcher
      .mockResolvedValueOnce(DEFAULT_APPEARANCE)
      .mockResolvedValueOnce(APPEARANCE_CATALOG)
      .mockRejectedValueOnce(new Error("Request failed"));
    render(<AppearanceSettings />);

    const preset = await screen.findByRole("combobox", {
      name: "Style variant",
    });
    fireEvent.change(preset, { target: { value: "minimal" } });
    fireEvent.click(screen.getByRole("button", { name: "Save appearance" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to confirm the appearance change.",
    );
    expect(preset).toHaveValue("minimal");
  });
});
