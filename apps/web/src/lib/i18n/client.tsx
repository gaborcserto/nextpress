"use client";

import {
  DEFAULT_SITE_DATE_TIME,
  formatSiteDateTime,
  type SiteDateTime,
} from "@nextpress/shared/site-date-time";
import Link from "next/link";
import { createContext, useContext, useState } from "react";

import { getMessage, getMessages } from "./messages";
import { localizedHref, pathLocale } from "./routing";

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

export function useColorModePreference() {
  return useContext(ModeContext);
}

const SiteDateTimeContext = createContext(DEFAULT_SITE_DATE_TIME);

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

export function SiteDateTimeProvider({
  settings = DEFAULT_SITE_DATE_TIME,
  children,
}: {
  settings?: SiteDateTime;
  children: ReactNode;
}) {
  return (
    <SiteDateTimeContext.Provider value={settings}>
      {children}
    </SiteDateTimeContext.Provider>
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
  const dateTime = useContext(SiteDateTimeContext);

  return (
    <time dateTime={value}>{formatSiteDateTime(value, dateTime, locale)}</time>
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
