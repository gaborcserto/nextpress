"use client";

import Link from "next/link";
import { createContext, useContext, useId, useState } from "react";
import { IoGlobeOutline, IoSunnyOutline, IoMoonOutline } from "react-icons/io5";

import { PreferenceChoice } from "@/components/public-shell/PreferenceChoice";

import { getMessage, getMessages, isLocale } from "./messages";
import { localizedHref, pathLocale } from "./routing";
import styles from "./VisitorControls.module.css";

import type { ComponentProps, MouseEvent, ReactNode } from "react";

import type { Locale, MessageKey } from "./messages";

const ModeContext = createContext({
  mode: "system",
  setMode: (_mode: string) => {},
});

export function PreferenceProvider({
  mode,
  children,
}: {
  mode: string;
  children: ReactNode;
}) {
  const [selectedMode, setMode] = useState(mode);

  return (
    <ModeContext.Provider value={{ mode: selectedMode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useMessages() {
  return getMessages(useLocale());
}

export function UiText({ id }: { id: MessageKey }) {
  return getMessage(useLocale(), id);
}

export function LocalizedDate({ value }: { value: string }) {
  const locale = useContext(LocaleContext);

  return (
    <time dateTime={value}>
      {new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(value))}
    </time>
  );
}

function savePreference(name: string, value: string) {
  document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

export function VisitorControls() {
  const { mode, setMode } = useContext(ModeContext);
  const locale = useContext(LocaleContext);
  const text = useMessages();
  const themeLabelId = useId();

  function changeLanguage(value: string) {
    if (!isLocale(value)) {
      return;
    }
    savePreference("np-locale", value);
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

export function UiNav({
  label,
  children,
  ...props
}: Omit<React.ComponentProps<"nav">, "aria-label"> & { label: MessageKey }) {
  const locale = useLocale();

  return (
    <nav {...props} aria-label={getMessage(locale, label)}>
      {children}
    </nav>
  );
}

export function LocaleLink({
  href,
  onClick,
  ...props
}: ComponentProps<typeof Link>) {
  const locale = useLocale();

  function localizeDestination(path: string) {
    return pathLocale(path.split(/[?#]/)[0] ?? "")
      ? path
      : localizedHref(path, locale);
  }

  const destination =
    typeof href === "string"
      ? localizeDestination(href)
      : {
          ...href,
          pathname: href.pathname
            ? localizeDestination(href.pathname)
            : href.pathname,
        };

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    const target = new URL(event.currentTarget.href);
    const targetLocale = pathLocale(target.pathname);

    if (
      !event.defaultPrevented &&
      event.button === 0 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey &&
      !event.currentTarget.hasAttribute("download") &&
      (!event.currentTarget.target || event.currentTarget.target === "_self") &&
      target.origin === window.location.origin &&
      targetLocale &&
      targetLocale !== locale
    ) {
      // Root layouts persist across client transitions; crossing locales needs fresh HTML.
      event.preventDefault();
      window.location.assign(target.href);
    }
  }

  return <Link {...props} href={destination} onClick={handleClick} />;
}
