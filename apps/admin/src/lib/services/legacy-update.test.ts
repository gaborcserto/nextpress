import { beforeEach, describe, expect, it, vi } from "vitest";

import { prepareLegacyUpdate } from "@/lib/content/legacy-editor";

import { updatePageApi } from "./page.client";
import { updatePostApi } from "./post.client";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiFetch }));

const values = {
  type: "STANDARD" as const,
  title: "Edited title",
  slug: "article",
  status: "PUBLISHED" as const,
  publishedAt: null,
  content: [],
  tags: [],
  parentId: null,
  inHeaderMenu: false,
  inFooterMenu: false,
  excerpt: [],
  cover: null,
};
const future = "2099-01-01T00:00:00.000Z";
const past = "2020-01-01T00:00:00.000Z";

describe.each([
  ["Page", updatePageApi, "/api/pages/item"],
  ["Post", updatePostApi, "/api/post/item"],
] as const)("%s publication updates", (_kind, update, endpoint) => {
  beforeEach(() => apiFetch.mockReset());

  it.each([
    ["ordinary legacy edit", values, values, {}],
    [
      "ordinary scheduled edit",
      { ...values, publishedAt: future },
      { ...values, publishedAt: future },
      {},
    ],
    [
      "publish",
      { ...values, status: "DRAFT" },
      values,
      { status: "PUBLISHED" },
    ],
    [
      "schedule",
      values,
      { ...values, publishedAt: future },
      { publishedAt: future },
    ],
    [
      "publish immediately",
      { ...values, publishedAt: future },
      values,
      { publishedAt: null },
    ],
    [
      "withdraw",
      { ...values, publishedAt: past },
      { ...values, publishedAt: past, status: "DRAFT" },
      { status: "DRAFT" },
    ],
    [
      "republish",
      { ...values, publishedAt: past, status: "DRAFT" },
      { ...values, publishedAt: past },
      { status: "PUBLISHED" },
    ],
  ] as const)(
    "sends only publication intent for %s",
    async (_name, loaded, edited, publication) => {
      const acknowledgement = {
        workingVersion: 12,
        status: edited.status,
        publishedAt: past,
      };
      apiFetch.mockResolvedValue(Response.json(acknowledgement));

      const result = await update(
        "item",
        prepareLegacyUpdate(edited, loaded),
        7,
      );

      expect(result).toEqual({ ok: true, acknowledgement });
      expect(apiFetch).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({ method: "PUT" }),
      );
      const payload: unknown = JSON.parse(apiFetch.mock.lastCall?.[1].body);
      expect(payload).toMatchObject({
        title: edited.title,
        expectedVersion: 7,
        ...publication,
      });

      if (!("status" in publication)) {
        expect(payload).not.toHaveProperty("status");
      }

      if (!("publishedAt" in publication)) {
        expect(payload).not.toHaveProperty("publishedAt");
      }
    },
  );
});
