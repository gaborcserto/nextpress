import { OAUTH_PROVIDERS } from "@nextpress/shared/oauth-providers";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeSettingsForm } from "@/lib/settings/admin-settings";

import SettingsScreen from "./SettingsScreen";

import type { SettingsScreenState } from "./SettingsScreen.types";

const { useSettingsScreen, jsonFetcher } = vi.hoisted(() => ({
  useSettingsScreen:
    vi.fn<typeof import("./SettingsScreen.hooks").useSettingsScreen>(),
  jsonFetcher: vi.fn(),
}));
vi.mock("./SettingsScreen.hooks", () => ({ useSettingsScreen }));
vi.mock("@/lib/api", () => ({ jsonFetcher }));

function mockLoadedSettings(overrides: Partial<SettingsScreenState> = {}) {
  useSettingsScreen.mockReturnValue({
    form: normalizeSettingsForm(undefined, "SUBSCRIBER"),
    setForm: vi.fn(),
    loaded: true,
    loadError: null,
    retry: vi.fn(),
    loading: false,
    saving: false,
    error: null,
    save: vi.fn(),
    ...overrides,
  });
}

describe("SettingsScreen", () => {
  beforeEach(() => {
    useSettingsScreen.mockReset();
    jsonFetcher.mockReset();
  });

  afterEach(() => {
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("blocks editing on an invalid provider list and recovers after retry", async () => {
    const hooks = await vi.importActual<
      typeof import("./SettingsScreen.hooks")
    >("./SettingsScreen.hooks");
    useSettingsScreen.mockImplementation(hooks.useSettingsScreen);
    const settings = {
      ...normalizeSettingsForm(undefined, "SUBSCRIBER"),
      siteName: "NextPress",
    };
    jsonFetcher.mockResolvedValueOnce(settings);

    render(<SettingsScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load settings. Please try again.",
    );
    expect(
      screen.queryByRole("button", { name: "Save site settings" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Site name")).not.toBeInTheDocument();

    jsonFetcher.mockResolvedValueOnce({
      ...settings,
      oauthProviders: OAUTH_PROVIDERS.map((provider) => ({
        provider,
        enabled: false,
        clientId: "",
        hasClientId: false,
        hasClientSecret: false,
        operational: false,
      })),
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("button", { name: "Save site settings" }),
    ).toBeEnabled();
    expect(screen.getByLabelText("Site name")).toHaveValue("NextPress");
  });

  it("keeps legacy Appearance links in the General tab", () => {
    window.history.replaceState(
      null,
      "",
      "/admin/settings#settings-appearance",
    );
    mockLoadedSettings();

    render(<SettingsScreen />);

    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByRole("tab", { name: "Appearance" })).toBeNull();
    expect(document.getElementById("settings-appearance")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save site settings" }),
    ).toBeVisible();
    expect(document.querySelectorAll("form")).toHaveLength(1);
  });

  it("names provider controls and disables them during save", () => {
    mockLoadedSettings({
      form: normalizeSettingsForm(
        {
          oauthProviders: [
            {
              provider: "github",
              enabled: true,
              clientId: "",
              hasClientId: false,
              hasClientSecret: false,
              operational: false,
            },
          ],
        },
        "SUBSCRIBER",
      ),
      saving: true,
    });

    render(<SettingsScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Authentication" }));
    fireEvent.click(screen.getByText("github", { exact: true }));
    expect(
      screen.getByRole("checkbox", { name: "Enable github" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("textbox", { name: "github client ID" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("github new secret")).toBeDisabled();
  });

  it("keeps a submitted secret after failure and clears it on a successful retry", async () => {
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    mockLoadedSettings({
      form: normalizeSettingsForm(
        {
          siteName: "NextPress",
          oauthProviders: [
            {
              provider: "github",
              enabled: true,
              clientId: "example-client",
              hasClientId: true,
              hasClientSecret: true,
              operational: true,
            },
          ],
        },
        "SUBSCRIBER",
      ),
      save,
    });

    render(<SettingsScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Authentication" }));
    const provider = screen.getByText("github", { exact: true });
    fireEvent.click(provider);
    const secret = screen.getByLabelText("github new secret");
    expect(secret).toHaveValue("");

    fireEvent.change(secret, { target: { value: "replacement" } });
    fireEvent.click(provider);
    fireEvent.click(screen.getByRole("tab", { name: "General" }));
    const saveButton = screen.getByRole("button", {
      name: "Save site settings",
    });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(save).toHaveBeenCalledExactlyOnceWith({
      github: { clientSecret: "replacement" },
    });
    expect(secret).toHaveValue("replacement");

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(secret).toHaveValue("");
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("exposes bounded public listing mode and batch controls", () => {
    mockLoadedSettings();

    render(<SettingsScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Publishing" }));
    expect(screen.getByRole("combobox", { name: "Listing mode" })).toHaveValue(
      "PAGINATION",
    );
    expect(screen.getByRole("option", { name: "Load more" })).toHaveValue(
      "LOAD_MORE",
    );
    expect(
      screen.getByRole("spinbutton", { name: "Posts per page / batch" }),
    ).toHaveAttribute("min", "1");
    expect(
      screen.getByRole("spinbutton", { name: "Posts per page / batch" }),
    ).toHaveAttribute("max", "50");
  });

  it("shows inline feedback for an invalid batch size", () => {
    const form = normalizeSettingsForm(undefined, "SUBSCRIBER");
    form.siteName = "NextPress";
    form.postsPerPage = 51;
    const save = vi.fn();
    mockLoadedSettings({ form, save });

    render(<SettingsScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Save site settings" }));

    expect(screen.getByRole("tabpanel", { name: "Publishing" })).toBeVisible();
    expect(save).not.toHaveBeenCalled();
    expect(
      screen.getByRole("spinbutton", { name: "Posts per page / batch" }),
    ).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a whole number from 1 to 50.",
    );
  });
});
