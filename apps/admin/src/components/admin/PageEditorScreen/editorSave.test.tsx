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
