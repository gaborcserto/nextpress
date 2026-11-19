"use client";

import { ContentListSchema } from "@nextpress/shared/api-contracts";
import Link from "next/link";
import { FaArrowRight, FaCopy, FaPlus, FaThumbtack } from "react-icons/fa";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import { useSession } from "@/lib/auth/auth-client";
import { DataListLoading } from "@/ui/components/DataList";
import { Alert, Button, LinkIconButton } from "@/ui/primitives";
import { AdminPageLayout } from "@/ui/shell/AdminPageLayout";

const collections = [
  {
    segment: "posts",
    endpoint: "/api/post",
    label: "Posts",
    icon: FaThumbtack,
  },
  { segment: "pages", endpoint: "/api/pages", label: "Pages", icon: FaCopy },
] as const;

async function fetchOverview(url: string) {
  const response = await jsonFetcher<unknown>(url);

  return ContentListSchema.parse(response);
}

function CollectionOverview({
  collection,
}: {
  collection: (typeof collections)[number];
}) {
  const { segment, endpoint, label, icon: Icon } = collection;
  const href = `/admin/${segment}`;
  const { data, error, mutate } = useSWR(
    `${endpoint}?page=1&limit=5`,
    fetchOverview,
  );

  return (
    <section
      className="admin-collection"
      aria-labelledby={`overview-${segment}`}
    >
      <header className="admin-collection-heading">
        <div className="flex min-w-0 items-center gap-3">
          <span className="admin-collection-icon">
            <Icon aria-hidden="true" />
          </span>
          <div>
            <h2 id={`overview-${segment}`} className="font-semibold">
              Recent {segment}
            </h2>
            {data && (
              <p className="text-sm text-(--text-muted)">
                {data.total} accessible {segment}
              </p>
            )}
          </div>
        </div>
        <Link href={href} className="btn btn-ghost btn-sm">
          All {label.toLowerCase()} <FaArrowRight aria-hidden="true" />
        </Link>
      </header>
      {error && (
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Alert status="error" message={`Unable to load ${segment}.`} />
          <Button size="sm" onClick={() => void mutate()}>
            Retry
          </Button>
        </div>
      )}
      {!data && !error && (
        <div className="p-4">
          <DataListLoading label={segment} />
        </div>
      )}
      {data &&
        (data.items.length ? (
          <ul className="admin-overview-list">
            {data.items.map((item) => (
              <li key={item.id}>
                <Link href={`${href}/${item.id}`}>
                  <div className="min-w-0">
                    <strong>{item.title}</strong>
                    <time dateTime={item.updatedAt}>
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </time>
                  </div>
                  <span
                    className="badge badge-soft"
                    data-content-status={item.status}
                  >
                    {item.status === "PUBLISHED" ? "Published" : "Draft"}
                  </span>
                  <FaArrowRight aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="admin-overview-empty">
            <p>No {segment} to show yet.</p>
            <Link className="admin-text-link" href={`${href}/new`}>
              Create your first {segment === "posts" ? "post" : "page"}
            </Link>
          </div>
        ))}
    </section>
  );
}

export default function DashboardScreen() {
  const { data, isPending } = useSession();
  const displayName = data?.user?.name || data?.user?.email || "Admin";

  return (
    <AdminPageLayout
      title="Dashboard"
      description={
        <p className="text-(--text-muted) wrap-anywhere" role="status">
          {isPending
            ? "Loading your account\u2026"
            : `Welcome, ${displayName}.`}
        </p>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <LinkIconButton
            href="/admin/pages/new"
            aria-label="Create Page"
            icon={FaPlus}
            variant="outline"
          >
            Create Page
          </LinkIconButton>
          <LinkIconButton
            href="/admin/posts/new"
            aria-label="Create Post"
            icon={FaPlus}
            color="primary"
          >
            Create Post
          </LinkIconButton>
        </div>
      }
    >
      <div className="admin-overview">
        {collections.map((collection) => (
          <CollectionOverview
            key={collection.segment}
            collection={collection}
          />
        ))}
      </div>
    </AdminPageLayout>
  );
}
