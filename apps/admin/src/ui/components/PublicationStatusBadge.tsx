"use client";

import { useAdminLocale } from "@/lib/i18n/admin-locale";
import { Badge } from "@/ui/primitives/Badge";

import type { PublicationState } from "@/lib/content/publication-status";

export function PublicationStatusBadge({
  status,
}: {
  status: PublicationState;
}) {
  const locale = useAdminLocale();
  const labels =
    locale === "hu"
      ? {
          PUBLISHED: "Közzétéve",
          DRAFT: "Piszkozat",
          SCHEDULED: "Ütemezve",
          MISSING_DATE: "Hiányzik a közzétételi dátum",
        }
      : {
          PUBLISHED: "Published",
          DRAFT: "Draft",
          SCHEDULED: "Scheduled",
          MISSING_DATE: "Publication date missing",
        };

  return <Badge data-publication-state={status}>{labels[status]}</Badge>;
}
