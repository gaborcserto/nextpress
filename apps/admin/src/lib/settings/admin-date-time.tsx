"use client";

import {
  DEFAULT_SITE_DATE_TIME,
  formatSiteDateTime,
  type SiteDateTime,
} from "@nextpress/shared/site-date-time";
import { createContext, useContext, type ReactNode } from "react";

import { useAdminLocale } from "@/lib/i18n/admin-locale";

export const AdminDateTimeContext = createContext<SiteDateTime | null>(
  DEFAULT_SITE_DATE_TIME,
);

export function AdminDateTimeProvider({
  settings,
  children,
}: {
  settings: SiteDateTime | null;
  children: ReactNode;
}) {
  return (
    <AdminDateTimeContext.Provider value={settings}>
      {children}
    </AdminDateTimeContext.Provider>
  );
}

export function useAdminDateLocale() {
  return useAdminLocale() === "hu" ? "hu" : "en-US";
}

export function useAdminTimestampFormatter() {
  const settings = useContext(AdminDateTimeContext);
  const locale = useAdminDateLocale();

  return (value: string) =>
    formatSiteDateTime(value, settings ?? DEFAULT_SITE_DATE_TIME, locale);
}

export function AdminTimestamp({ value }: { value: string }) {
  const formatTimestamp = useAdminTimestampFormatter();

  return <time dateTime={value}>{formatTimestamp(value)}</time>;
}
