import { createHash } from "node:crypto";

/** JSON-only canonical form: object keys sort; arrays, nulls and strings retain meaning. */
export function canonicalBaseline(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${Array.from(value, canonicalBaseline).join(",")}]`;
  }

  if (
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalBaseline(item)}`)
      .join(",")}}`;
  }

  throw new Error(
    "Baseline values must be finite JSON; serialize dates explicitly",
  );
}

export function baselineHash(value: unknown): string {
  return createHash("sha256").update(canonicalBaseline(value)).digest("hex");
}

export async function publicBaseline(
  response: Response,
  validate: (value: unknown) => unknown,
) {
  const body: unknown = await response.json();
  validate(body);
  // Hash the original body: validating schemas must never strip unknown wire fields.
  return {
    status: response.status,
    body,
    hash: baselineHash({ status: response.status, body }),
  };
}

export const baselineInstant = "2026-01-01T00:00:00.000Z";
export const editorialFixtures = (["POST", "PAGE"] as const).flatMap((type) =>
  (
    [
      "draft",
      "past",
      "null-date",
      "future",
      "unpublished",
      "private-revision",
    ] as const
  ).map((scenario) => ({
    id: `baseline-${type.toLowerCase()}-${scenario}`,
    type,
    scenario,
    status:
      scenario === "draft" || scenario === "unpublished"
        ? "DRAFT"
        : "PUBLISHED",
    slug: `baseline-${type.toLowerCase()}-${scenario}`,
    title: `Baseline ${type} ${scenario}`,
    content: "Legacy literal <script>alert('literal')</script>",
    excerpt: "Legacy excerpt",
    publishedAt:
      scenario === "draft" || scenario === "null-date"
        ? null
        : new Date(
            scenario === "future"
              ? "2026-01-01T00:00:00.001Z"
              : "2025-12-31T23:59:59.999Z",
          ),
    pageDocument: null,
    layout: "EVENT_PAGE",
    inHeaderMenu: true,
    inFooterMenu: false,
    parentId: "baseline-parent",
    listingKind: "POSTS",
    listingTaxonomyId: "baseline-category",
    eventStart: "2026-03-29T01:30:00.000Z",
    eventEnd: "2026-10-25T01:30:00.000Z",
    eventLocation: "Budapest",
    registrationUrl: "https://example.invalid/register",
    redirectTo: "/preserved",
    cover: {
      id: "baseline-cover",
      mime: "image/png",
      url: "/media/baseline-cover",
      alt: "Cover",
      width: 1,
      height: 1,
      uploadedById: "other-author",
    },
    gallery: [
      { mediaId: "second", sort: 0 },
      { mediaId: "first", sort: 1 },
    ],
    taxonomies: [
      {
        taxonomy: {
          id: "baseline-tag",
          type: "TAG",
          slug: "baseline-tag",
          name: "Tag",
        },
      },
      {
        taxonomy: {
          id: "baseline-category",
          type: "CATEGORY",
          slug: "baseline-category",
          name: "Category",
        },
      },
    ],
    author: null,
    authorId: null,
    coverId: "baseline-cover",
    workingVersion: 1,
    viewCount: 12,
    uniqueViewCount: 8,
    likeCount: 2,
    lastViewedAt: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-12-31T00:00:00.000Z",
    revisions: ["a", "b"].map((id) => ({
      id,
      title: "Newer private title",
      slug: "private-slug",
      content: "Private body",
      excerpt: null,
      layout: "STANDARD",
      pageDocument: null,
      authorId: null,
      workingVersion: 1,
      createdAt: "2025-12-31T23:59:59.999Z",
    })),
  })),
);

export const historicalDocuments = {
  supported: {
    version: 1,
    blocks: [
      {
        id: "image",
        version: 1,
        type: "image",
        props: { mediaId: "document-media", alt: "Document" },
      },
    ],
  },
  unsupported: { version: 999, blocks: [], future: { media: "unknown" } },
};

export const budapestInstants = [
  "2026-03-29T01:59:59+01:00",
  "2026-03-29T03:00:00+02:00",
  "2026-10-25T02:30:00+02:00",
  "2026-10-25T02:30:00+01:00",
];
