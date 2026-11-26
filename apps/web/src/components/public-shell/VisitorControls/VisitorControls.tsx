"use client";

import { useId } from "react";
import { IoGlobeOutline, IoSunnyOutline, IoMoonOutline } from "react-icons/io5";

import {
  useColorModePreference,
  useLocale,
  useMessages,
} from "@/lib/i18n/client";
import { isLocale } from "@/lib/i18n/messages";
import { localizedHref } from "@/lib/i18n/routing";

import { PreferenceChoice } from "../PreferenceChoice";
import styles from "./VisitorControls.module.css";

function savePreference(name: string, value: string) {
  document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

export function VisitorControls() {
  const { mode, setMode } = useColorModePreference();
  const locale = useLocale();
  const text = useMessages();
  const themeLabelId = useId();

  function changeLanguage(value: string) {
    if (!isLocale(value)) {
      return;
    }

    savePreference("np-locale", value);
    const location = new URL(window.location.href);

    if (location.pathname === "/live-preview") {
      location.searchParams.set("locale", value);
      window.location.assign(location);

      return;
    }

    // A document navigation refreshes root HTML language and server-rendered metadata.
    window.location.assign(
      localizedHref(
        window.location.pathname +
          window.location.search +
          window.location.hash,
        value,
      ),
    );
  }

  function toggleMode() {
    const dark =
      mode === "dark" ||
      (mode === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    const nextMode = dark ? "light" : "dark";

    savePreference("np-color-mode", nextMode);
    document.documentElement.dataset.colorMode = nextMode;
    setMode(nextMode);
  }

  return (
    <div className={styles.controls}>
      <PreferenceChoice
        label={text.language.label}
        value={locale}
        onChange={changeLanguage}
        icon={<IoGlobeOutline aria-hidden="true" />}
        options={[
          {
            value: "en",
            label: text.language.english,
            mobileLabel: "EN",
            lang: "en",
          },
          {
            value: "hu",
            label: text.language.hungarian,
            mobileLabel: "HU",
            lang: "hu",
          },
        ]}
      />
      <button
        type="button"
        className={styles.themeToggle}
        data-mode={mode}
        aria-labelledby={themeLabelId}
        onClick={toggleMode}
      >
        <span className={styles.modeIcon} aria-hidden="true">
          <IoSunnyOutline className={styles.sun} />
          <IoMoonOutline className={styles.moon} />
        </span>
        <span id={themeLabelId} className="visually-hidden">
          <span className={styles.whenLight}>
            {text.appearance.switchToDark}
          </span>
          <span className={styles.whenDark}>
            {text.appearance.switchToLight}
          </span>
        </span>
        <span className={styles.themeLabel} aria-hidden="true">
          {text.appearance.label}
        </span>
        <span className={styles.themeState} aria-hidden="true">
          <span className={styles.whenLight}>{text.appearance.light}</span>
          <span className={styles.whenDark}>{text.appearance.dark}</span>
        </span>
      </button>
    </div>
  );
}
