import { render, screen, act, fireEvent } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n/client";
import { getMessages } from "@/lib/i18n/messages";

import { getPreviewPosts } from "../actions";
import { Preview } from "./Preview";

vi.mock("../actions", () => ({
  getPreviewPosts: vi.fn(),
  getPreviewDocumentListing: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => <a {...props} />,
}));

const appearance = {
  listVariant: "compact",
  postsPerPage: 1,
  listingMode: "PAGINATION",
} as const;

const session = "11111111-1111-4111-8111-111111111111";
const origin = "http://localhost:49101";
const message = {
  type: "nextpress:preview",
  session,
  snapshot: {
    title: "Exact old revision",
    slug: "old",
    content: '{"version":1,"blocks":[]}',
    excerpt: null,
    layout: "STANDARD",
    pageDocument: JSON.stringify({
      version: 1,
      blocks: [
        {
          id: "preview-hero",
          version: 1,
          type: "hero",
          props: {
            title: "Structured page heading",
            description: "Preview block body",
          },
        },
      ],
    }),
  },
};

afterEach(() => {
  vi.mocked(getPreviewPosts).mockReset();
  vi.unstubAllGlobals();
  window.location.hash = "";
});

it("ignores a delayed listing response after switching the tag", async () => {
  type PreviewBatch = Awaited<ReturnType<typeof getPreviewPosts>>;

  let resolveOldBatch = (_batch: PreviewBatch) => {};
  const oldBatch = new Promise<PreviewBatch>((resolve) => {
    resolveOldBatch = resolve;
  });
  const load = vi.mocked(getPreviewPosts);
  load.mockReturnValueOnce(oldBatch).mockResolvedValueOnce({
    posts: [],
    hasMore: false,
  });
  vi.stubGlobal("opener", window);
  window.location.hash = session;
  render(<Preview adminOrigin={origin} appearance={appearance} />);

  sendLayout("POSTS", "previous");
  sendLayout("POSTS", "updated");
  await act(async () => {
    await Promise.resolve();
    resolveOldBatch({
      posts: [
        {
          title: "Stale archive article",
          slug: "stale",
          summary: "",
          author: null,
          taxonomies: [],
          publishedAt: "2026-01-01T00:00:00Z",
        },
      ],
      hasMore: true,
    });
  });

  expect(load).toHaveBeenLastCalledWith(1, "updated");
  expect(screen.getByText(getMessages("en").posts.empty)).toBeVisible();
  expect(
    screen.queryByRole("link", { name: "Stale archive article" }),
  ).not.toBeInTheDocument();
});

describe("preview boundary", () => {
  it("accepts only the configured host, session and validated snapshot", () => {
    vi.stubGlobal("opener", window);
    window.location.hash = session;
    render(<Preview adminOrigin={origin} appearance={appearance} />);

    function deliver(
      data: unknown,
      sender = origin,
      source: Window | null = window,
    ) {
      act(() =>
        window.dispatchEvent(
          new MessageEvent("message", { origin: sender, source, data }),
        ),
      );
    }

    deliver(message, "https://attacker.invalid");
    deliver(message, origin, null);
    deliver({ ...message, session: "22222222-2222-4222-8222-222222222222" });
    deliver({ ...message, snapshot: { title: "Invalid" } });
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    deliver(message);
    expect(
      screen.getByRole("heading", { name: "Exact old revision" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Structured page heading" }),
    ).toBeVisible();
    expect(screen.getByText("Preview block body")).toBeVisible();
  });
});

function sendLayout(layout: string, listingTagSlug?: string) {
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin,
        source: window,
        data: {
          ...message,
          snapshot: { ...message.snapshot, layout, listingTagSlug },
        },
      }),
    ),
  );
}

it("switches between managed Home and the localized Gallery empty state", () => {
  vi.stubGlobal("opener", window);
  window.location.hash = session;
  render(
    <LocaleProvider locale="hu">
      <Preview adminOrigin={origin} appearance={appearance} />
    </LocaleProvider>,
  );

  sendLayout("HOME");
  expect(
    screen.getByRole("heading", { name: message.snapshot.title }),
  ).toBeVisible();
  const emptyGallery = getMessages("hu").pages.galleryEmpty;
  expect(screen.queryByText(emptyGallery)).not.toBeInTheDocument();

  sendLayout("GALLERY");
  expect(screen.getByText(emptyGallery)).toBeVisible();
  expect(getPreviewPosts).not.toHaveBeenCalled();
});

it("paginates a filtered Posts preview without leaving the preview session", async () => {
  const load = vi.mocked(getPreviewPosts);
  load.mockImplementation(async (page) => ({
    posts: [
      {
        title: `Published article ${page}`,
        slug: `article-${page}`,
        summary: "",
        author: null,
        taxonomies: [],
        publishedAt: "2026-01-01T00:00:00Z",
      },
    ],
    hasMore: page === 1,
  }));
  vi.stubGlobal("opener", window);
  window.location.hash = session;
  render(<Preview adminOrigin={origin} appearance={appearance} />);

  sendLayout("POSTS", "news");
  expect(
    await screen.findByRole("link", { name: "Published article 1" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));

  expect(
    await screen.findByRole("link", { name: "Published article 2" }),
  ).toBeVisible();
  expect(load).toHaveBeenLastCalledWith(2, "news");
  expect(window.location.hash).toBe(`#${session}`);

  sendLayout("POSTS");
  expect(
    await screen.findByRole("link", { name: "Published article 1" }),
  ).toBeVisible();
  expect(load).toHaveBeenLastCalledWith(1, null);
});
