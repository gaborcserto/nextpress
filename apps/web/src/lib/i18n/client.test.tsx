import { act, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LocaleProvider,
  PreferenceProvider,
  VisitorControls,
  LocalizedDate,
  UiText,
} from "./client";

afterEach(() => vi.restoreAllMocks());

describe("localized visitor controls", () => {
  it("renders Hungarian language labels and dates from the SSR locale", () => {
    render(
      <LocaleProvider locale="hu">
        <UiText id="navigation.home" />
        <LocalizedDate value="2026-11-13T00:00:00Z" />
        <VisitorControls />
      </LocaleProvider>,
    );
    expect(screen.getByText(/2026.*november 13/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nyelv" }));
    expect(
      screen.getByRole("menuitemradio", { name: "Magyar" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemradio", { name: "English" }),
    ).toHaveAttribute("lang", "en");
  });
  it("toggles immediately, persists explicit choices and never opens an appearance menu", () => {
    render(
      <PreferenceProvider mode="dark">
        <VisitorControls />
      </PreferenceProvider>,
    );
    // jsdom does not apply the responsive CSS that selects one of the two SSR action labels.
    const toggle = screen.getByRole("button", { name: /Switch to/ });
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).not.toHaveAttribute("aria-haspopup");
    for (const mode of ["light", "dark", "light"]) {
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("data-mode", mode);
      expect(document.documentElement.dataset.colorMode).toBe(mode);
      expect(document.cookie).toContain(`np-color-mode=${mode}`);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    }
    expect(screen.queryByText("System")).not.toBeInTheDocument();
  });
  it.each([true, false])(
    "toggles opposite the current OS preference when System is selected (dark=%s)",
    (dark) => {
      vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
        matches: dark,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      render(
        <PreferenceProvider mode="system">
          <VisitorControls />
        </PreferenceProvider>,
      );
      const toggle = screen.getByRole("button", { name: /Switch to/ });
      fireEvent.click(toggle);
      const expected = dark ? "light" : "dark";
      expect(toggle).toHaveAttribute("data-mode", expected);
      expect(document.cookie).toContain(`np-color-mode=${expected}`);
    },
  );
  it("reads the OS at activation time and ignores it after a manual selection", () => {
    let dark = false;
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: dark,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    render(
      <PreferenceProvider mode="system">
        <VisitorControls />
      </PreferenceProvider>,
    );
    dark = true;
    const toggle = screen.getByRole("button", { name: /Switch to/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("data-mode", "light");
    dark = true;
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("data-mode", "dark");
  });
  it("hydrates the System markup without reading the OS or changing SSR attributes", async () => {
    const matchMedia = vi.spyOn(window, "matchMedia").mockClear();
    const errors = vi.spyOn(console, "error");
    const ui = (
      <PreferenceProvider mode="system">
        <VisitorControls />
      </PreferenceProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(ui);
    document.body.append(container);
    const before = container.innerHTML;
    const root = hydrateRoot(container, ui);
    await act(async () => {});
    expect(container.innerHTML).toBe(before);
    expect(matchMedia).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    container.remove();
  });
  it("preserves language keyboard navigation, Escape and outside dismissal", () => {
    render(
      <PreferenceProvider mode="dark">
        <VisitorControls />
      </PreferenceProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Language" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const english = screen.getByRole("menuitemradio", { name: "English" });
    expect(english).toHaveFocus();
    fireEvent.keyDown(english, { key: "ArrowDown" });
    expect(screen.getByRole("menuitemradio", { name: "Magyar" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
