import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import ThemeToggle from "./ThemeToggle";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.cookie = "theme=; path=/; max-age=0";
  vi.unstubAllGlobals();
});

function mockSystemTheme(dark: boolean) {
  const preference = Object.assign(new EventTarget(), { matches: dark });
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(preference));

  return preference;
}

it.each([true, false])(
  "toggles from the effective OS mode and persists only appearance (dark=%s)",
  async (dark) => {
    mockSystemTheme(dark);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);

      return 0;
    });
    await act(async () => {
      render(<ThemeToggle />);
    });
    const button = screen.getByRole("button", {
      name: dark ? "Switch to light theme" : "Switch to dark theme",
    });
    expect(button).toHaveAttribute("aria-pressed", String(dark));
    fireEvent.click(button);
    const next = dark ? "light" : "dark";
    expect(document.documentElement).toHaveAttribute("data-theme", next);
    expect(document.cookie).toContain(`theme=${next}`);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  },
);

it("uses the explicit theme instead of the OS preference", async () => {
  document.documentElement.setAttribute("data-theme", "light");
  mockSystemTheme(true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);

    return 0;
  });
  await act(async () => {
    render(<ThemeToggle />);
  });
  fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
});

it("follows system changes until the user chooses an explicit theme", async () => {
  const preference = mockSystemTheme(false);
  render(<ThemeToggle />);
  const lightModeButton = await screen.findByRole("button", {
    name: "Switch to dark theme",
  });
  expect(lightModeButton).toHaveAttribute("aria-pressed", "false");

  act(() => {
    preference.matches = true;
    preference.dispatchEvent(new Event("change"));
  });
  const darkModeButton = screen.getByRole("button", {
    name: "Switch to light theme",
  });
  expect(darkModeButton).toHaveAttribute("aria-pressed", "true");
  expect(document.documentElement).not.toHaveAttribute("data-theme");
  fireEvent.click(darkModeButton);

  act(() => {
    preference.matches = false;
    preference.dispatchEvent(new Event("change"));
    preference.matches = true;
    preference.dispatchEvent(new Event("change"));
  });
  expect(lightModeButton).toHaveAttribute("aria-pressed", "false");
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
});
