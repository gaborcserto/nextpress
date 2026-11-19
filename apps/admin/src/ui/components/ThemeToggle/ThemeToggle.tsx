"use client";

import { useSyncExternalStore } from "react";
import { FiCheck, FiMonitor, FiMoon, FiSun } from "react-icons/fi";

import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@/ui/primitives/Dropdown";

import type { ThemeToggleProps } from "./ThemeToggle.types";

const modes = [
  { value: "light", label: "Light", icon: FiSun },
  { value: "dark", label: "Dark", icon: FiMoon },
  { value: "system", label: "System", icon: FiMonitor },
] as const;

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  return () => observer.disconnect();
}

function themePreference() {
  return document.documentElement.getAttribute("data-theme") ?? "system";
}

function changePreference(value: (typeof modes)[number]["value"]) {
  if (value === "system") {
    document.documentElement.removeAttribute("data-theme");
    document.cookie = "theme=; path=/; max-age=0; SameSite=Lax";

    return;
  }

  document.documentElement.setAttribute("data-theme", value);
  document.cookie = `theme=${value}; path=/; max-age=31536000; SameSite=Lax`;
}

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const preference = useSyncExternalStore(
    subscribeToTheme,
    themePreference,
    () => "system",
  );
  const mode = modes.find(({ value }) => value === preference) ?? modes[2];
  const Icon = mode.icon;

  return (
    <Dropdown className={className}>
      <DropdownTrigger
        ariaLabel={`Theme: ${mode.label}`}
        className="admin-theme-trigger btn-square"
      >
        <Icon size={19} aria-hidden="true" />
      </DropdownTrigger>
      <DropdownMenu aria-label="Theme">
        {modes.map(({ value, label, icon: ModeIcon }) => (
          <DropdownItem
            itemKey={value}
            key={value}
            role="menuitemradio"
            aria-checked={value === mode.value}
            startIcon={<ModeIcon />}
            endIcon={value === mode.value ? <FiCheck /> : undefined}
            onClick={() => changePreference(value)}
          >
            {label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
