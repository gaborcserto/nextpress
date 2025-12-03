"use client";

import { useEffect, useState } from "react";
import { FiMoon, FiSun } from "react-icons/fi";

import type { ThemeToggleProps } from "./ThemeToggle.types";

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof document === "undefined") return;

    const curr =
        document.documentElement.getAttribute("data-theme") || "light";
    setIsDark(curr === "dark");
  }, []);

  const handleToggle = () => {
    if (typeof document === "undefined") return;

    const curr =
        document.documentElement.getAttribute("data-theme") || "light";
    const next = curr === "dark" ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `theme=${next}; path=/; max-age=31536000`;

    setIsDark(next === "dark");
  };

  if (!mounted) {
    return (
        <button
            type="button"
            aria-label="Toggle theme"
            aria-pressed={false}
            className={`btn btn-ghost btn-circle ${className}`}
            onClick={handleToggle}
        >
          <FiMoon size={18} />
        </button>
    );
  }

  const ariaLabel = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
      <button
          type="button"
          onClick={handleToggle}
          aria-label={ariaLabel}
          aria-pressed={isDark}
          className={[
            "btn btn-ghost btn-circle",
            "swap swap-rotate",
            isDark ? "swap-active" : "",
            className,
          ]
              .filter(Boolean)
              .join(" ")}
      >
        <span className="swap-on h-5 w-5 flex items-center justify-center">
          <FiSun size={18} aria-hidden="true" />
        </span>

        <span className="swap-off h-5 w-5 flex items-center justify-center">
          <FiMoon size={18} aria-hidden="true" />
        </span>
      </button>
  );
}
