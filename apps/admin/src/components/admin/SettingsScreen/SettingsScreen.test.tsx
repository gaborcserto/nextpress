import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SettingsScreen from "./SettingsScreen";
import { normalizeSettingsForm } from "@/lib/settings/admin-settings";

const { useSettingsScreen } = vi.hoisted(() => ({ useSettingsScreen: vi.fn() }));
vi.mock("./SettingsScreen.hooks", () => ({ useSettingsScreen }));

describe("SettingsScreen", () => {
  it("names provider controls and disables them during save", () => {
    useSettingsScreen.mockReturnValue({
      form: normalizeSettingsForm({ oauthProviders: [{ provider: "github", enabled: true, clientId: "", hasClientId: false, hasClientSecret: false, operational: false }] }, "SUBSCRIBER"),
      setForm: vi.fn(), loading: false, saving: true, error: null, save: vi.fn(),
    });
    render(<SettingsScreen />);
    expect(screen.getByRole("checkbox", { name: "Enable github" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "github client ID" })).toBeDisabled();
    expect(screen.getByLabelText("github new secret")).toBeDisabled();
  });

  it("exposes bounded public listing mode and batch controls", () => {
    useSettingsScreen.mockReturnValue({
      form: normalizeSettingsForm(undefined, "SUBSCRIBER"),
      setForm: vi.fn(), loading: false, saving: false, error: null, save: vi.fn(),
    });

    render(<SettingsScreen />);

    expect(screen.getByRole("combobox", { name: "Listing mode" })).toHaveValue("PAGINATION");
    expect(screen.getByRole("option", { name: "Load more" })).toHaveValue("LOAD_MORE");
    expect(screen.getByRole("spinbutton", { name: "Posts per page / batch" })).toHaveAttribute("min", "1");
    expect(screen.getByRole("spinbutton", { name: "Posts per page / batch" })).toHaveAttribute("max", "50");
  });

  it("shows inline feedback for an invalid batch size", () => {
    const form = normalizeSettingsForm(undefined, "SUBSCRIBER");
    form.postsPerPage = 51;
    useSettingsScreen.mockReturnValue({
      form, setForm: vi.fn(), loading: false, saving: false, error: null, save: vi.fn(),
    });

    render(<SettingsScreen />);

    expect(screen.getByRole("spinbutton", { name: "Posts per page / batch" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a whole number from 1 to 50.");
  });
});
