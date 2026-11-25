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

  it("stages appearance edits for the shared settings save", async () => {
    jsonFetcher
      .mockResolvedValueOnce(DEFAULT_APPEARANCE)
      .mockResolvedValueOnce(APPEARANCE_CATALOG);
    const onChangeAction = vi.fn();
    render(<AppearanceSettings onChangeAction={onChangeAction} />);

    const preset = await screen.findByRole("combobox", {
      name: "Style variant",
    });
    expect(preset).toHaveValue("classic");
    fireEvent.change(preset, { target: { value: "modern" } });
    expect(onChangeAction).toHaveBeenLastCalledWith(
      { ...DEFAULT_APPEARANCE, stylePreset: "modern" },
      true,
    );
  });

  it("offers a retry and prevents saving an incompatible active selection", async () => {
    jsonFetcher
      .mockResolvedValueOnce({ ...DEFAULT_APPEARANCE, stylePreset: "obsolete" })
      .mockResolvedValueOnce(APPEARANCE_CATALOG)
      .mockResolvedValueOnce(DEFAULT_APPEARANCE)
      .mockResolvedValueOnce(APPEARANCE_CATALOG);
    render(<AppearanceSettings onChangeAction={vi.fn()} />);

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

  it("keeps the proposed variant selected while staging it", async () => {
    jsonFetcher
      .mockResolvedValueOnce(DEFAULT_APPEARANCE)
      .mockResolvedValueOnce(APPEARANCE_CATALOG);
    render(<AppearanceSettings onChangeAction={vi.fn()} />);

    const preset = await screen.findByRole("combobox", {
      name: "Style variant",
    });
    fireEvent.change(preset, { target: { value: "minimal" } });
    expect(preset).toHaveValue("minimal");
  });
});
