"use client";

import {
  DashboardSummarySchema,
  type DashboardSummary,
} from "@nextpress/shared/api-contracts";
import Link from "next/link";
import {
  FaArrowRight,
  FaCalendarAlt,
  FaClock,
  FaFilePdf,
  FaImages,
  FaPlus,
} from "react-icons/fa";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import { publicationLabels } from "@/lib/content/publication-status";
import {
  AdminTimestamp,
  useAdminDateLocale,
} from "@/lib/settings/admin-date-time";
import { DataListLoading } from "@/ui/components/DataList";
import { Alert, Button, LinkIconButton } from "@/ui/primitives";
import { Badge } from "@/ui/primitives/Badge";
import { AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import { useMediaMessages } from "../Media/messages";

import type { RoleName } from "@/lib/auth/roles";

type DashboardAccount = {
  id: string;
  name: string | null;
  role: RoleName | null;
};

const collections = [
  { segment: "posts", label: "Post" },
  { segment: "pages", label: "Page" },
] as const;

async function fetchDashboard([url]: readonly [string, string, RoleName]) {
  const response = await jsonFetcher<unknown>(url, { cache: "no-store" });

  return DashboardSummarySchema.parse(response);
}

function ContentStatistics({ summary }: { summary: DashboardSummary }) {
  const metrics = [
    ["Total Posts", summary.posts.total],
    ["Total Pages", summary.pages.total],
    ["Published Posts", summary.posts.published],
    ["Published Pages", summary.pages.published],
    ["Draft content", summary.drafts],
    ["Scheduled content", summary.scheduled],
  ] as const;
  const number = new Intl.NumberFormat();

  return (
    <section
      className="admin-surface p-4 sm:p-5"
      aria-labelledby="dashboard-statistics"
    >
      <h2 id="dashboard-statistics" className="mb-3 text-lg font-semibold">
        Content statistics
      </h2>
      <dl className="admin-dashboard-metrics">
        {metrics.map(([label, value]) => (
          <div
            key={label}
            className="rounded-(--radius-control) bg-(--surface-rail) p-3 sm:p-4"
          >
            <dt className="wrap-anywhere text-sm text-(--text-muted)">
              {label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {number.format(value)}
            </dd>
          </div>
        ))}
      </dl>
      {summary.missingPublicationDate > 0 && (
        <p className="mt-3 text-sm text-(--text-muted)">
          Missing publication date (
          {number.format(summary.missingPublicationDate)})
        </p>
      )}
    </section>
  );
}

type ContentPanelProps =
  | { kind: "recent"; items: DashboardSummary["recentContent"] }
  | { kind: "scheduled"; items: DashboardSummary["scheduledContent"] };

function ContentPanel({ kind, items }: ContentPanelProps) {
  const hu = useAdminDateLocale() === "hu";
  const scheduled = kind === "scheduled";
  const Icon = scheduled ? FaCalendarAlt : FaClock;

  return (
    <section className="admin-collection" aria-labelledby={`dashboard-${kind}`}>
      <header className="admin-collection-heading">
        <div className="flex min-w-0 items-center gap-3">
          <span className="admin-collection-icon">
            <Icon aria-hidden="true" />
          </span>
          <h2
            id={`dashboard-${kind}`}
            className="min-w-0 font-semibold wrap-anywhere"
          >
            {scheduled
              ? hu
                ? "Ütemezett közzététel"
                : "Scheduled publishing"
              : "Recently updated content"}
          </h2>
        </div>
      </header>
      {items.length === 0 ? (
        <p className="admin-overview-empty">
          {scheduled ? "No upcoming publications." : "No content to show yet."}
        </p>
      ) : (
        <ul className="admin-overview-list">
          {items.map((item) => {
            const collection =
              item.type === "POST" ? collections[0] : collections[1];
            const recent = "updatedAt" in item;
            const timestamp = recent ? item.updatedAt : item.publishedAt;
            const state = recent ? item.publicationState : "SCHEDULED";

            return (
              <li key={item.id}>
                <Link href={`/admin/${collection.segment}/${item.id}`}>
                  <div className="min-w-0">
                    <strong>{item.title}</strong>
                    <p className="text-sm text-(--text-muted)">
                      {collection.label}
                      {recent && item.authorName && ` · ${item.authorName}`}
                    </p>
                    <div className="admin-dashboard-timing mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-(--text-muted)">
                        {recent
                          ? hu
                            ? "Módosítva"
                            : "Updated"
                          : hu
                            ? "Közzététel"
                            : "Publishes"}{" "}
                        <AdminTimestamp value={timestamp} />
                      </span>
                      <Badge>{publicationLabels[state]}</Badge>
                    </div>
                  </div>
                  <FaArrowRight aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function DashboardScreen({
  account,
}: {
  account: DashboardAccount;
}) {
  const canEdit = account.role !== null && account.role !== "SUBSCRIBER";
  const mediaText = useMediaMessages();
  const { data, error, isValidating, mutate } = useSWR(
    canEdit
      ? (["/api/admin/dashboard", account.id, account.role] as const)
      : null,
    fetchDashboard,
    { shouldRetryOnError: false },
  );

  return (
    <AdminPageLayout
      title="Dashboard"
      description={
        <>
          <p className="wrap-anywhere" role="status">
            Welcome, {account.name || "publisher"}.
          </p>
          {account.role === "AUTHOR" && (
            <p>This overview shows your own content.</p>
          )}
        </>
      }
    >
      {canEdit && (
        <div
          className="admin-dashboard-actions"
          role="group"
          aria-label="Quick actions"
        >
          {collections.map(({ segment, label }) => (
            <LinkIconButton
              key={segment}
              href={`/admin/${segment}/new`}
              aria-label={`Create ${label}`}
              icon={FaPlus}
              color="primary"
            >
              Create {label}
            </LinkIconButton>
          ))}
          <div className="flex min-w-0 flex-wrap gap-2">
            <LinkIconButton
              href="/admin/media"
              aria-label={mediaText.library}
              icon={FaImages}
              variant="ghost"
            >
              {mediaText.library}
            </LinkIconButton>
            <LinkIconButton
              href="/admin/documents"
              aria-label={mediaText.documents}
              icon={FaFilePdf}
              variant="ghost"
            >
              {mediaText.documents}
            </LinkIconButton>
          </div>
        </div>
      )}
      <nav className="flex flex-wrap gap-4" aria-label="Content collections">
        {collections.map(({ segment, label }) => (
          <Link
            key={segment}
            href={`/admin/${segment}`}
            className="admin-text-link"
          >
            View {label}s
          </Link>
        ))}
      </nav>

      {!canEdit && (
        <p className="text-(--text-muted)">
          Editorial summaries are available to authors, editors, and
          administrators.
        </p>
      )}
      {canEdit && error && (
        <div className="grid justify-items-start gap-3">
          <Alert
            status="error"
            message="Unable to load the editorial dashboard."
          />
          <Button
            size="sm"
            disabled={isValidating}
            onClick={() => void mutate()}
          >
            {isValidating ? "Retrying…" : "Retry"}
          </Button>
        </div>
      )}
      {canEdit && !error && !data && (
        <DataListLoading label="the editorial dashboard" />
      )}
      {canEdit && !error && data && (
        <>
          <ContentStatistics summary={data} />
          <div className="admin-overview">
            <ContentPanel kind="recent" items={data.recentContent} />
            <ContentPanel kind="scheduled" items={data.scheduledContent} />
          </div>
        </>
      )}
    </AdminPageLayout>
  );
}
