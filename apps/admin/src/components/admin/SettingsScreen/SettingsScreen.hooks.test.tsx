import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeSettingsForm } from "@/lib/settings/admin-settings";
import { deferred } from "@/lib/testing/deferred.fixture";

import { useSettingsScreen } from "./SettingsScreen.hooks";

const { fetcher } = vi.hoisted(() => ({ fetcher: vi.fn() }));
vi.mock("@/lib/api", () => ({ jsonFetcher: fetcher }));
const authoritative = {
  ...normalizeSettingsForm(undefined, "SUBSCRIBER"),
  siteName: "Server settings",
};

describe("settings safety", () => {
  beforeEach(() => {
    fetcher.mockReset();
  });

  it("rejects incomplete successful responses without enabling Save", async () => {
    fetcher.mockResolvedValue({ siteName: "Partial" });
    const { result } = renderHook(() => useSettingsScreen("SUBSCRIBER"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loaded).toBe(false);
    await act(async () => {
      expect(await result.current.save({})).toBe(false);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("blocks saving defaults after load and retry failures, then recovers from an authoritative retry", async () => {
    fetcher.mockRejectedValue(new Error("secret SQL details"));
    const { result } = renderHook(() => useSettingsScreen("SUBSCRIBER"));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loaded).toBe(false);
    expect(result.current.loadError).toBe(
      "Unable to load settings. Please try again.",
    );
    await act(async () => {
      expect(await result.current.save({})).toBe(false);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.loaded).toBe(false);
    expect(result.current.loadError).not.toContain("SQL");
    fetcher.mockResolvedValue(authoritative);
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.loaded).toBe(true);
    expect(result.current.form.siteName).toBe("Server settings");
  });

  it("preserves edits during revalidation and save failures and prevents duplicate saves", async () => {
    fetcher.mockResolvedValue(authoritative);
    const { result } = renderHook(() => useSettingsScreen("SUBSCRIBER"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() =>
      result.current.setForm((form) => ({ ...form, siteName: "Local edits" })),
    );
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.form.siteName).toBe("Local edits");
    fetcher.mockRejectedValue(new Error("private credential"));
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.form.siteName).toBe("Local edits");
    expect(result.current.loaded).toBe(true);
    await act(async () => {
      expect(await result.current.save({})).toBe(false);
    });
    expect(result.current.form.siteName).toBe("Local edits");
    expect(result.current.error).toContain("Unable to save settings");
    expect(result.current.error).not.toContain("private");

    let resolve: () => void = () => undefined;
    fetcher.mockReset();
    fetcher.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    let first: Promise<boolean>;
    act(() => {
      first = result.current.save({});
    });
    expect(result.current.saving).toBe(true);
    await act(async () => {
      expect(await result.current.save({})).toBe(false);
      resolve();
      expect(await first).toBe(true);
    });
    expect(result.current.saving).toBe(false);
  });
  it("aborts superseded reads and keeps Save blocked until the current role's load settles", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    fetcher
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender, unmount } = renderHook(
      ({ role }: { role: "SUBSCRIBER" | "EDITOR" }) => useSettingsScreen(role),
      {
        initialProps: { role: "SUBSCRIBER" },
      },
    );
    const oldSignal = fetcher.mock.calls[0][1].signal;

    rerender({ role: "EDITOR" });
    expect(oldSignal.aborted).toBe(true);
    await act(async () => first.resolve(authoritative));
    expect(result.current.loading).toBe(true);
    expect(result.current.loaded).toBe(false);
    await act(async () => {
      expect(await result.current.save({})).toBe(false);
    });

    await act(async () =>
      second.resolve({ ...authoritative, siteName: "Current settings" }),
    );
    expect(result.current.form.siteName).toBe("Current settings");
    expect(result.current.loading).toBe(false);

    const pending = deferred<unknown>();
    fetcher.mockReturnValueOnce(pending.promise);
    act(() => {
      void result.current.retry();
    });
    const retrySignal = fetcher.mock.calls[2][1].signal;
    expect(result.current.loading).toBe(true);
    unmount();
    expect(retrySignal.aborted).toBe(true);
    await act(async () => pending.reject(new Error("Late failure")));
  });
});
