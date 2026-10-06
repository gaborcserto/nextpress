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
});
