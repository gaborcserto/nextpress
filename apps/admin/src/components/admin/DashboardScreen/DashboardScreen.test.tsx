import { fireEvent, render, screen, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, expect, it, vi } from "vitest";

import DashboardScreen from "./DashboardScreen";

import type { DashboardSummary } from "@nextpress/shared/api-contracts";

const empty: DashboardSummary = {
  posts: { total: 0, published: 0 },
  pages: { total: 0, published: 0 },
  drafts: 0,
  scheduled: 0,
  missingPublicationDate: 0,
  recentContent: [],
  scheduledContent: [],
};

function renderDashboard(role: "AUTHOR" | "SUBSCRIBER" = "AUTHOR") {
  const cache = new Map();

  return render(
    <SWRConfig value={{ provider: () => cache }}>
      <DashboardScreen account={{ id: "account", name: "Jo", role }} />
    </SWRConfig>,
  );
}

afterEach(() => vi.unstubAllGlobals());

it("shows scoped counts and links recent and scheduled content to their editors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        ...empty,
        posts: { total: 3, published: 2 },
        pages: { total: 1, published: 0 },
        drafts: 1,
        scheduled: 1,
        recentContent: [
          {
            id: "post-id",
            title: "Editorial notes",
            type: "POST",
            updatedAt: "2026-11-21T09:00:00Z",
            authorName: "Jo",
            publicationState: "DRAFT",
          },
        ],
        scheduledContent: [
          {
            id: "page-id",
            title: "Launch",
            type: "PAGE",
            publishedAt: "2026-12-21T09:00:00Z",
          },
        ],
      }),
    ),
  );
  renderDashboard();

  await screen.findByRole("heading", { name: "Content statistics" });
  expect(screen.getByText("Total Posts").parentElement).toHaveTextContent("3");
  expect(screen.getByText("Published Posts").parentElement).toHaveTextContent(
    "2",
  );
  expect(screen.getByText("Draft content").parentElement).toHaveTextContent(
    "1",
  );
  expect(screen.getByRole("link", { name: "Create Post" })).toHaveAttribute(
    "href",
    "/admin/posts/new",
  );
  expect(screen.getByRole("link", { name: "Create Page" })).toHaveAttribute(
    "href",
    "/admin/pages/new",
  );
  const recent = screen.getByRole("region", {
    name: "Recently updated content",
  });
  const scheduled = screen.getByRole("region", {
    name: "Scheduled publishing",
  });
  expect(
    within(recent).getByRole("link", { name: /Editorial notes.*Jo.*Draft/ }),
  ).toHaveAttribute("href", "/admin/posts/post-id");
  const scheduledLink = within(scheduled).getByRole("link", {
    name: /Launch.*Publishes.*Scheduled/,
  });
  expect(scheduledLink).toHaveAttribute("href", "/admin/pages/page-id");
  expect(within(scheduledLink).getByText(/^Publishes/)).toHaveAttribute(
    "datetime",
    "2026-12-21T09:00:00Z",
  );
});

it("omits create actions and skips the editorial request for a subscriber", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  renderDashboard("SUBSCRIBER");

  expect(screen.getByRole("link", { name: "View Posts" })).toBeVisible();
  expect(
    screen.queryByRole("link", { name: /Create/ }),
  ).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it("announces loading while the summary request is pending", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
  );
  renderDashboard();

  expect(screen.getByText("Loading the editorial dashboard…")).toBeVisible();
  expect(
    screen.queryByText("No upcoming publications."),
  ).not.toBeInTheDocument();
});

it("recovers from a failed request and displays empty collections", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "Unexpected error" }, { status: 500 }),
      )
      .mockResolvedValueOnce(Response.json(empty)),
  );
  renderDashboard();

  const retry = await screen.findByRole("button", { name: "Retry" });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Unable to load the editorial dashboard.",
  );
  fireEvent.click(retry);

  expect(await screen.findByText("No upcoming publications.")).toBeVisible();
  expect(screen.getByText("No content to show yet.")).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
