"use client";

import { useSyncExternalStore } from "react";

export type AdminLocale = "en" | "hu";

const localeCookie = "admin-locale";

function readLocale(): AdminLocale {
  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim() === `${localeCookie}=hu`)
    ? "hu"
    : "en";
}

function subscribe(onChange: () => void) {
  window.addEventListener("admin-locale-change", onChange);
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener("admin-locale-change", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useAdminLocale(): AdminLocale {
  return useSyncExternalStore(subscribe, readLocale, () => "en");
}

export function setAdminLocale(locale: AdminLocale) {
  document.cookie = `${localeCookie}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.documentElement.lang = locale;
  window.dispatchEvent(new Event("admin-locale-change"));
}
