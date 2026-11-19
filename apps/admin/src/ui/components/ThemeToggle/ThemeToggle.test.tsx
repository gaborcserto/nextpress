import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ThemeToggle from "./ThemeToggle";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.cookie = "theme=; path=/; max-age=0";
});

describe("Theme preference", () => {
  it("opens on ArrowDown and marks the saved preference", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<ThemeToggle />);
    const trigger = screen.getByRole("button", { name: "Theme: Dark" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const menu = screen.getByRole("menu", { name: "Theme" });

    expect(
      within(menu).getByRole("menuitemradio", { name: "Dark", checked: true }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitemradio", { name: "Light" }),
    ).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(
      within(menu).getByRole("menuitemradio", { name: "Dark" }),
    ).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(menu).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("persists an explicit choice and restores system mode by removing the override", async () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Theme: System" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Light" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(document.cookie).toContain("theme=light");

    const trigger = await screen.findByRole("button", { name: "Theme: Light" });
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(
      screen.getByRole("menuitemradio", { name: "Light", checked: true }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "System" }));
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(document.cookie).not.toContain("theme=");
    expect(
      await screen.findByRole("button", { name: "Theme: System" }),
    ).toHaveFocus();
  });
});
