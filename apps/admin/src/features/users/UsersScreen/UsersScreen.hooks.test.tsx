import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { deferred } from "@/lib/testing/deferred.fixture";

import { useUsersScreen } from "./UsersScreen.hooks";

import type { UserRow } from "./UsersScreen.types";

const { jsonFetcher } = vi.hoisted(() => ({ jsonFetcher: vi.fn() }));
vi.mock("@/lib/api", () => ({ jsonFetcher }));

const user: UserRow = {
  id: "user-1",
  name: "Current user",
  email: null,
  emailVerified: false,
  roleName: "SUBSCRIBER",
  createdAt: "",
  updatedAt: "",
};

it("ignores responses from obsolete user loads and aborts reads on unmount", async () => {
  const first = deferred<UserRow[]>();
  const second = deferred<UserRow[]>();
  const third = deferred<UserRow[]>();
  const role = deferred<unknown>();
  jsonFetcher
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(role.promise)
    .mockReturnValueOnce(second.promise)
    .mockReturnValueOnce(third.promise);
  const { result, unmount } = renderHook(useUsersScreen);
  expect(result.current.loading).toBe(true);

  act(() => {
    void result.current.reload();
  });
  expect(jsonFetcher.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => first.reject(new Error("Obsolete error")));
  expect(result.current.error).toBeNull();
  expect(result.current.loading).toBe(true);

  await act(async () => second.resolve([user]));
  expect(result.current.users).toEqual([user]);
  expect(result.current.loading).toBe(false);

  act(() => {
    void result.current.reload();
  });
  expect(result.current.loading).toBe(true);
  unmount();
  expect(jsonFetcher.mock.calls[1][1].signal.aborted).toBe(true);
  expect(jsonFetcher.mock.calls[3][1].signal.aborted).toBe(true);
  await act(async () => third.resolve([]));
});
