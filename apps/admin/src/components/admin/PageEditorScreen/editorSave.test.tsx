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

describe.each([usePageEditor, usePostEditor])(
  "editor save outcome",
  (useEditor) => {
    beforeEach(() => {
      vi.clearAllMocks();
      state.item = { ...values, workingVersion: 7 };
      mutate.mockResolvedValue(undefined);
    });

    it("omits an unchanged empty publication date but forwards explicit clearing", async () => {
      update.mockResolvedValue({ ok: true, status: 200 });
      state.item = { ...values, workingVersion: 7, publishedAt: null };
      const { result } = renderHook(() => useEditor("item"));
      await act(async () =>
        result.current.handleSubmit({ ...values, publishedAt: null }),
      );
      expect(update).toHaveBeenLastCalledWith("item", values, 7);
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
        { ...values, publishedAt: null },
        7,
      );
    });

    it("rejects an overlapping save until the first write finishes", async () => {
      let complete: (value: { ok: boolean; status: number }) => void = () => {};
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
        complete({ ok: true, status: 200 });
        expect(await pending).toBe(true);
      });
    });

    it("allows retry after transport failure without advancing the version", async () => {
      update
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({ ok: true, status: 200 });
      const { result } = renderHook(() => useEditor("item"));
      await act(async () => {
        expect(await result.current.handleSubmit(values)).toBe(false);
      });
      expect(mutate).not.toHaveBeenCalled();
      await act(async () => {
        expect(await result.current.handleSubmit(values)).toBe(true);
      });
      expect(update).toHaveBeenLastCalledWith("item", values, 7);
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

    it("returns success only after the accepted write and advances the loaded version", async () => {
      update.mockResolvedValue({ ok: true, status: 200 });
      const { result } = renderHook(() => useEditor("item"));
      await act(async () => {
        expect(await result.current.handleSubmit(values)).toBe(true);
      });
      expect(mutate).toHaveBeenCalledWith(
        { item: { ...values, workingVersion: 8 } },
        { revalidate: false },
      );
    });
  },
);
