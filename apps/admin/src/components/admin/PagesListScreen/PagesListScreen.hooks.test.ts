import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDeletePage } from "./PagesListScreen.hooks";
import { useDeletePost } from "../PostsListScreen/PostsListScreen.hooks";

const { apiFetch, showToast } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  showToast: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiFetch, jsonFetcher: vi.fn() }));
vi.mock("@/ui/utils", () => ({ showToast }));

describe.each([
  { kind: "page", useDelete: useDeletePage, url: "/api/pages/item-1" },
  { kind: "post", useDelete: useDeletePost, url: "/api/post/item-1" },
])("$kind deletion", ({ kind, useDelete, url }) => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the UI confirmation and prevents concurrent deletion", async () => {
    const confirm = vi.spyOn(window, "confirm");
    let resolveRequest: (response: Response) => void = () => undefined;
    apiFetch.mockReturnValue(new Promise<Response>((resolve) => { resolveRequest = resolve; }));
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useDelete(onDeleted));

    await act(async () => {
      const deleteItem = "deletePage" in result.current ? result.current.deletePage : result.current.deletePost;
      const first = deleteItem("item-1");
      const second = deleteItem("item-2");
      resolveRequest(new Response(null, { status: 204 }));
      await Promise.all([first, second]);
    });

    expect(apiFetch).toHaveBeenCalledExactlyOnceWith(url, { method: "DELETE" });
    expect(confirm).not.toHaveBeenCalled();
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(result.current.deletingId).toBeNull();
    confirm.mockRestore();
  });

  it("reports network failure and releases the pending state", async () => {
    apiFetch.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useDelete());
    await act(async () => {
      const deleteItem = "deletePage" in result.current ? result.current.deletePage : result.current.deletePost;
      await deleteItem("item-1");
    });
    expect(showToast).toHaveBeenCalledWith(`Unable to delete ${kind}. Please try again.`, "error");
    expect(result.current.deletingId).toBeNull();
  });
});
