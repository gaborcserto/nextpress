"use client";

import {
  DashboardSummarySchema,
  type DashboardSummary,
} from "@nextpress/shared/api-contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FaArrowRight,
  FaCalendarAlt,
  FaClock,
  FaCopy,
  FaNewspaper,
  FaPlus,
  FaRegCalendarAlt,
  FaRegFileAlt,
} from "react-icons/fa";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import {
  AdminTimestamp,
  useAdminDateLocale,
} from "@/lib/settings/admin-date-time";
import { DataListLoading } from "@/ui/components/DataList";
import { PublicationStatusBadge } from "@/ui/components/PublicationStatusBadge";
import {
  Alert,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@/ui/primitives";
import { AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import { DashboardStatisticCard } from "./DashboardStatisticCard";
import { useDashboardMessages } from "./messages";

import type { RoleName } from "@/lib/auth/roles";

type DashboardAccount = {
  id: string;
  name: string | null;
  role: RoleName | null;
};

async function fetchDashboard([url]: readonly [string, string, RoleName]) {
  const response = await jsonFetcher<unknown>(url, { cache: "no-store" });

  return DashboardSummarySchema.parse(response);
}

function ContentStatistics({ summary }: { summary: DashboardSummary }) {
  const text = useDashboardMessages();
  const locale = useAdminDateLocale();
  const number = new Intl.NumberFormat(locale === "hu" ? "hu-HU" : "en-US");

  return (
    <section
      className="admin-surface admin-dashboard-statistics p-4 sm:p-5"
      aria-labelledby="dashboard-statistics"
    >
      <h2 id="dashboard-statistics" className="mb-3 text-lg font-semibold">
        {text.statistics}
      </h2>
      <div className="admin-dashboard-metrics">
        <DashboardStatisticCard
          title={text.posts}
          Icon={FaNewspaper}
          tone="blue"
          primaryValue={number.format(summary.posts.total)}
          primaryHref="/admin/posts"
          secondary={{
            label: text.published,
            value: number.format(summary.posts.published),
            href: "/admin/posts?status=PUBLISHED",
          }}
        />
        <DashboardStatisticCard
          title={text.pages}
          Icon={FaCopy}
          tone="purple"
          primaryValue={number.format(summary.pages.total)}
          primaryHref="/admin/pages"
          secondary={{
            label: text.published,
            value: number.format(summary.pages.published),
            href: "/admin/pages?status=PUBLISHED",
          }}
        />
        <DashboardStatisticCard
          title={text.drafts}
          Icon={FaRegFileAlt}
          tone="neutral"
          primaryValue={number.format(summary.drafts)}
        />
        <DashboardStatisticCard
          title={text.scheduledCount}
          Icon={FaRegCalendarAlt}
          tone="warning"
          primaryValue={number.format(summary.scheduled)}
        />
      </div>
      {summary.missingPublicationDate > 0 && (
        <p className="mt-3 text-sm text-(--text-muted)">
          {text.missingDate} ({number.format(summary.missingPublicationDate)})
        </p>
      )}
    </section>
  );
}

type ContentPanelProps =
  | { kind: "recent"; items: DashboardSummary["recentContent"] }
  | { kind: "scheduled"; items: DashboardSummary["scheduledContent"] };

function ContentPanel({ kind, items }: ContentPanelProps) {
  const text = useDashboardMessages();
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
            {scheduled ? text.scheduled : text.recent}
          </h2>
        </div>
      </header>
      {items.length === 0 ? (
        <p className="admin-overview-empty">
          {scheduled ? text.emptyScheduled : text.emptyRecent}
        </p>
      ) : (
        <ul className="admin-overview-list">
          {items.map((item) => {
            const collection = item.type === "POST" ? "posts" : "pages";
            const collectionLabel =
              item.type === "POST" ? text.post : text.page;
            const recent = "updatedAt" in item;
            const timestamp = recent ? item.updatedAt : item.publishedAt;
            const state = recent ? item.publicationState : "SCHEDULED";

            return (
              <li key={item.id}>
                <Link
                  href={`/admin/${collection}/${item.id}`}
                  className="admin-overview-row"
                >
                  <div className="min-w-0">
                    <strong>{item.title}</strong>
                    <p className="text-sm text-(--text-muted)">
                      {collectionLabel}
                      {recent && item.authorName && ` · ${item.authorName}`}
                    </p>
                    <div className="admin-dashboard-timing mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-(--text-muted)">
                        {recent ? text.updated : text.publishes}{" "}
                        <AdminTimestamp value={timestamp} />
                      </span>
                      <PublicationStatusBadge status={state} />
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
  const router = useRouter();
  const text = useDashboardMessages();
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
      title={text.title}
      actions={
        canEdit ? (
          <Dropdown align="end">
            <DropdownTrigger ariaLabel={text.create} appearance="primary">
              <FaPlus aria-hidden="true" />
              {text.create}
            </DropdownTrigger>
            <DropdownMenu aria-label={text.create}>
              <DropdownItem
                itemKey="create-post"
                onClick={() => router.push("/admin/posts/new")}
              >
                {text.createPost}
              </DropdownItem>
              <DropdownItem
                itemKey="create-page"
                onClick={() => router.push("/admin/pages/new")}
              >
                {text.createPage}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        ) : undefined
      }
      description={
        <>
          <p className="wrap-anywhere" role="status">
            {text.welcome}, {account.name || text.publisher}.
          </p>
          {account.role === "AUTHOR" && <p>{text.ownContent}</p>}
        </>
      }
    >
      {!canEdit && (
        <p className="text-(--text-muted)">{text.editorialAccess}</p>
      )}
      {canEdit && error && (
        <div className="grid justify-items-start gap-3">
          <Alert status="error" message={text.loadError} />
          <Button
            size="sm"
            disabled={isValidating}
            onClick={() => void mutate()}
          >
            {isValidating ? text.retrying : text.retry}
          </Button>
        </div>
      )}
      {canEdit && !error && !data && (
        <DataListLoading label="dashboard" message={text.loading} />
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
