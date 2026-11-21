"use client";

import {
  DashboardSummarySchema,
  type DashboardSummary,
} from "@nextpress/shared/api-contracts";
import Link from "next/link";
import { FaArrowRight, FaCalendarAlt, FaClock, FaPlus } from "react-icons/fa";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import { publicationLabels } from "@/lib/content/publication-status";
import { DataListLoading } from "@/ui/components/DataList";
import { Alert, Button, LinkIconButton } from "@/ui/primitives";
import { AdminPageLayout } from "@/ui/shell/AdminPageLayout";

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
    <section aria-labelledby="dashboard-statistics">
      <h2 id="dashboard-statistics" className="mb-3 text-lg font-semibold">
        Content statistics
      </h2>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        {metrics.map(([label, value]) => (
          <div key={label} className="admin-collection p-3 sm:p-4">
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
  const scheduled = kind === "scheduled";
  const Icon = scheduled ? FaCalendarAlt : FaClock;
  const time = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section className="admin-collection" aria-labelledby={`dashboard-${kind}`}>
      <header className="admin-collection-heading">
        <div className="flex min-w-0 items-center gap-3">
          <span className="admin-collection-icon">
            <Icon aria-hidden="true" />
          </span>
          <h2 id={`dashboard-${kind}`} className="font-semibold">
            {scheduled ? "Scheduled publishing" : "Recently updated content"}
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
                    <time dateTime={timestamp}>
                      {recent ? "Updated " : "Publishes "}{" "}
                      {time.format(new Date(timestamp))}
                    </time>
                    <span className="badge badge-soft mt-2">
                      {publicationLabels[state]}
                    </span>
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
      actions={
        canEdit && (
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Quick actions"
          >
            {collections.map(({ segment, label }) => (
              <LinkIconButton
                key={segment}
                href={`/admin/${segment}/new`}
                aria-label={`Create ${label}`}
                icon={FaPlus}
                variant="outline"
              >
                Create {label}
              </LinkIconButton>
            ))}
          </div>
        )
      }
    >
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
        <div className="flex flex-wrap items-center gap-3">
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
