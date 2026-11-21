import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePageEditor } from "./PageEditorScreen.hooks";
import { usePostEditor } from "../PostEditorScreen/PostEditorScreen.hooks";

const { state, update, mutate, push, toast } = vi.hoisted(() => ({
  state: { item: {} },
  update: vi.fn(),
  mutate: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("swr", () => ({
  default: () => ({ data: state, mutate, isLoading: false }),
}));
vi.mock("@/lib/services/page.client", () => ({
  updatePageApi: update,
  createPageApi: update,
}));
vi.mock("@/lib/services/post.client", () => ({
  updatePostApi: update,
  createPostApi: update,
}));
vi.mock("@/ui/utils", () => ({ showToast: toast }));

const values = {
  type: "STANDARD" as const,
  title: "Local title",
  slug: "local-title",
  status: "DRAFT" as const,
  tags: [],
  content: [],
  excerpt: [],
  cover: null,
  parentId: null,
  inHeaderMenu: false,
  inFooterMenu: false,
};

const { status: draftStatus, cover: _cover, ...content } = values;
const acknowledgement = {
  workingVersion: 12,
  status: draftStatus,
  publishedAt: null,
};
const accepted = { ok: true, acknowledgement };

describe.each([
  ["Page", usePageEditor],
  ["Post", usePostEditor],
] as const)("%s editor save outcome", (_kind, useEditor) => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.item = { ...values, workingVersion: 7 };
    mutate.mockResolvedValue(undefined);
  });

  it("does not submit publication fields for a title edit on an undated published record", async () => {
    update.mockResolvedValue(accepted);
    const legacy = {
      ...values,
      status: "PUBLISHED" as const,
      publishedAt: null,
    };
    state.item = { ...legacy, workingVersion: 7 };
    const { result } = renderHook(() => useEditor("item"));

    await act(async () =>
      result.current.handleSubmit({ ...legacy, title: "Updated title" }),
    );

    const [, submitted] = update.mock.lastCall ?? [];
    expect(submitted).toMatchObject({ title: "Updated title" });
    expect(submitted).not.toHaveProperty("status");
    expect(submitted).not.toHaveProperty("publishedAt");
  });

  it("omits an unchanged empty publication date but forwards explicit clearing", async () => {
    update.mockResolvedValue(accepted);
    state.item = { ...values, workingVersion: 7, publishedAt: null };
    const { result } = renderHook(() => useEditor("item"));
    await act(async () =>
      result.current.handleSubmit({ ...values, publishedAt: null }),
    );
    expect(update).toHaveBeenLastCalledWith("item", content, 7);
    state.item = {
      ...values,
      workingVersion: 7,
      publishedAt: "2099-01-01T00:00:00Z",
    };
    await act(async () =>
      result.current.handleSubmit({ ...values, publishedAt: null }),
    );
    expect(update).toHaveBeenLastCalledWith(
      "item",
      { ...content, publishedAt: null },
      7,
    );
  });

  it("rejects an overlapping save until the first write finishes", async () => {
    let complete: (value: typeof accepted) => void = () => {};
    update.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const { result } = renderHook(() => useEditor("item"));
    await act(async () => {
      const pending = result.current.handleSubmit(values);
      expect(
        await result.current.handleSubmit({ ...values, title: "Newer" }),
      ).toBe(false);
      expect(update).toHaveBeenCalledTimes(1);
      complete(accepted);
      expect(await pending).toMatchObject({ status: "DRAFT" });
    });
  });

  it("allows retry after transport failure without advancing the version", async () => {
    update
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(accepted);
    const { result } = renderHook(() => useEditor("item"));
    await act(async () => {
      expect(await result.current.handleSubmit(values)).toBe(false);
    });
    expect(mutate).not.toHaveBeenCalled();
    await act(async () => {
      expect(await result.current.handleSubmit(values)).toMatchObject({
        status: "DRAFT",
      });
    });
    expect(update).toHaveBeenLastCalledWith("item", content, 7);
  });

  it.each([409, 422, 500])(
    "returns explicit failure for %s without replacing local values or version",
    async (status) => {
      update.mockResolvedValue({ ok: false, status });
      const { result } = renderHook(() => useEditor("item"));
      await act(async () => {
        expect(await result.current.handleSubmit(values)).toBe(false);
      });
      expect(mutate).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
      expect(values.title).toBe("Local title");
      expect(result.current.saving).toBe(false);
    },
  );

  it("uses the acknowledged date and version on the next ordinary save", async () => {
    const publication = {
      status: "PUBLISHED" as const,
      publishedAt: "2020-01-01T00:00:00.000Z",
    };
    update.mockResolvedValue({
      ok: true,
      acknowledgement: { ...publication, workingVersion: 12 },
    });
    mutate.mockImplementation(async ({ item }) => {
      state.item = item;
    });
    const { result } = renderHook(() => useEditor("item"));

    await act(async () => {
      expect(
        await result.current.handleSubmit({ ...values, status: "PUBLISHED" }),
      ).toEqual(publication);
    });

    await act(async () =>
      result.current.handleSubmit({
        ...values,
        ...publication,
        title: "Second edit",
      }),
    );

    expect(update).toHaveBeenLastCalledWith(
      "item",
      { ...content, title: "Second edit" },
      12,
    );
  });

  it("returns success only after the accepted write and advances the loaded version", async () => {
    update.mockResolvedValue(accepted);
    const { result } = renderHook(() => useEditor("item"));
    await act(async () => {
      expect(await result.current.handleSubmit(values)).toMatchObject({
        status: "DRAFT",
      });
    });
    expect(mutate).toHaveBeenCalledWith(
      { item: { ...values, ...acknowledgement } },
      { revalidate: false },
    );
  });
});
