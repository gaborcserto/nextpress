import { fireEvent, render, screen, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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

afterEach(() => {
  document.cookie = "admin-locale=en; Path=/";
  vi.unstubAllGlobals();
  push.mockReset();
});

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
  const postsCard = screen
    .getByRole("heading", { name: "Posts" })
    .closest("article");
  const pagesCard = screen
    .getByRole("heading", { name: "Pages" })
    .closest("article");
  const draftsCard = screen
    .getByRole("heading", { name: "Draft content" })
    .closest("article");
  const scheduledCard = screen
    .getByRole("heading", { name: "Scheduled content" })
    .closest("article");

  expect(screen.getAllByRole("article")).toHaveLength(4);
  expect(postsCard).toHaveTextContent("3");
  expect(postsCard).toHaveTextContent("2");
  expect(within(postsCard!).getAllByRole("link")).toHaveLength(2);
  expect(within(postsCard!).getAllByRole("link")[0]).toHaveAttribute(
    "href",
    "/admin/posts",
  );
  expect(within(postsCard!).getAllByRole("link")[1]).toHaveAttribute(
    "href",
    "/admin/posts?status=PUBLISHED",
  );
  expect(pagesCard).toHaveTextContent("1");
  expect(within(pagesCard!).getAllByRole("link")).toHaveLength(2);
  expect(within(pagesCard!).getAllByRole("link")[0]).toHaveAttribute(
    "href",
    "/admin/pages",
  );
  expect(within(pagesCard!).getAllByRole("link")[1]).toHaveAttribute(
    "href",
    "/admin/pages?status=PUBLISHED",
  );
  expect(draftsCard).toHaveTextContent("1");
  expect(within(draftsCard!).queryByRole("link")).not.toBeInTheDocument();
  expect(scheduledCard).toHaveTextContent("1");
  expect(within(scheduledCard!).queryByRole("link")).not.toBeInTheDocument();
  const create = screen.getByRole("button", { name: "Create" });
  fireEvent.keyDown(create, { key: "ArrowDown" });
  const createPost = screen.getByRole("menuitem", { name: "Create Post" });
  const createPage = screen.getByRole("menuitem", { name: "Create Page" });
  expect(createPost).toHaveFocus();
  fireEvent.keyDown(createPost, { key: "ArrowDown" });
  expect(createPage).toHaveFocus();
  fireEvent.click(createPost);
  expect(push).toHaveBeenCalledWith("/admin/posts/new");
  fireEvent.click(create);
  fireEvent.click(screen.getByRole("menuitem", { name: "Create Page" }));
  expect(push).toHaveBeenCalledWith("/admin/pages/new");
  expect(screen.queryByRole("link", { name: "View Posts" })).toBeNull();
  expect(screen.queryByRole("link", { name: "View Pages" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Media Library" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Document Library" })).toBeNull();
  const recent = screen.getByRole("region", {
    name: "Recently updated content",
  });
  const scheduled = screen.getByRole("region", {
    name: "Scheduled publications",
  });
  expect(
    within(recent).getByRole("link", { name: /Editorial notes.*Jo.*Draft/ }),
  ).toHaveAttribute("href", "/admin/posts/post-id");
  const scheduledLink = within(scheduled).getByRole("link", {
    name: /Launch.*Publishes.*Scheduled/,
  });
  expect(scheduledLink).toHaveAttribute("href", "/admin/pages/page-id");
  expect(scheduledLink).toHaveClass("admin-overview-row");
  scheduledLink.focus();
  expect(scheduledLink).toHaveFocus();
  expect(
    within(scheduledLink).getByText("December 21, 2026, 09:00"),
  ).toHaveAttribute("datetime", "2026-12-21T09:00:00Z");
});

it("omits create actions and skips the editorial request for a subscriber", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  renderDashboard("SUBSCRIBER");

  expect(screen.queryByRole("link", { name: "View Posts" })).toBeNull();
  expect(screen.queryByRole("link", { name: "View Pages" })).toBeNull();
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

  expect(
    screen
      .getAllByRole("status")
      .some((status) =>
        status.textContent?.includes("Loading the editorial dashboard…"),
      ),
  ).toBe(true);
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

it("localizes dashboard sections, actions, statuses, and empty states in Hungarian", async () => {
  document.cookie = "admin-locale=hu; Path=/";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(empty)));
  renderDashboard();

  expect(
    await screen.findByRole("heading", { name: "Tartalmi statisztikák" }),
  ).toBeVisible();
  expect(screen.getByRole("heading", { name: "Bejegyzések" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Oldalak" })).toBeVisible();
  expect(screen.getAllByText("Közzétett")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Létrehozás" })).toBeVisible();
  expect(
    screen.getByRole("region", { name: "Legutóbb módosított tartalmak" }),
  ).toHaveTextContent("Még nincs megjeleníthető tartalom.");
  expect(
    screen.getByRole("region", { name: "Ütemezett közzétételek" }),
  ).toHaveTextContent("Nincs közelgő közzététel.");
});
