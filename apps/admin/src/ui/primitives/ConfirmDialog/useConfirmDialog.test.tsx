import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useConfirmDialog } from "./useConfirmDialog";

describe("async confirmation", () => {
  it("locks selection while pending, keeps failures retryable, and closes only on success", async () => {
    const { result } = renderHook(() => useConfirmDialog<string>());
    act(() => result.current.show("first"));

    let reject: (error: Error) => void = () => undefined;
    const action = vi.fn(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    );
    let pending: Promise<void>;
    act(() => {
      pending = result.current.run(action);
    });
    expect(result.current.pending).toBe(true);
    act(() => {
      result.current.show("second");
      result.current.hide();
      void result.current.run(action);
    });
    expect(action).toHaveBeenCalledExactlyOnceWith("first");
    expect(result.current.open).toBe(true);
    await act(async () => {
      reject(new Error("Try again"));
      await pending;
    });
    expect(result.current.error).toBe("Try again");
    expect(result.current.open).toBe(true);
    expect(result.current.pending).toBe(false);
    await act(async () => {
      await result.current.run(async () => undefined);
    });
    expect(result.current.open).toBe(false);
  });

  it("allows cancellation after failure and ignores completion after unmount", async () => {
    const { result, unmount } = renderHook(() => useConfirmDialog<string>());
    act(() => result.current.show("first"));
    await act(async () => {
      await result.current.run(async () => {
        throw new Error("Failure");
      });
    });
    act(() => result.current.hide());
    expect(result.current.open).toBe(false);
    act(() => result.current.show("second"));

    let finish: () => void = () => undefined;
    let pending: Promise<void>;
    act(() => {
      pending = result.current.run(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
    });
    unmount();
    await act(async () => {
      finish();
      await pending;
    });
  });
});
