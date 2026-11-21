import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { deferred } from "@/lib/testing/deferred.fixture";

import { TagMultiSelect } from "./TagMultiSelect";

import type { TagLoadOptionsFn, TagValue } from "./TagMultiSelect.types";

describe("TagMultiSelect", () => {
  it("reports search failures instead of offering creation from incomplete results", async () => {
    const createTag = vi.fn();
    render(
      <TagMultiSelect
        value={[]}
        onChangeAction={vi.fn()}
        loadOptionsAction={async () => {
          throw new Error("offline");
        }}
        createTagAction={createTag}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Tag selector" });
    fireEvent.change(input, { target: { value: "news" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to search tags.",
    );
    fireEvent.keyDown(input, { key: "Enter" });
    expect(createTag).not.toHaveBeenCalled();
  });
  it("selects a search result through native button activation", async () => {
    const tag = { id: "tag-1", name: "News", slug: "news" };
    const onChange = vi.fn();
    render(
      <TagMultiSelect
        value={[]}
        onChangeAction={onChange}
        loadOptionsAction={async () => [tag]}
        createTagAction={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Tag selector" }), {
      target: { value: "ne" },
    });
    const option = await screen.findByRole("button", { name: "News" });
    await waitFor(() => expect(option).not.toBeDisabled());
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledExactlyOnceWith([tag]);
  });

  it("prevents duplicate creation and reports failure", async () => {
    let rejectRequest: (error: Error) => void = () => undefined;
    const createTag = vi.fn().mockReturnValue(
      new Promise((_, reject) => {
        rejectRequest = reject;
      }),
    );
    render(
      <TagMultiSelect
        value={[]}
        onChangeAction={vi.fn()}
        loadOptionsAction={async () => []}
        createTagAction={createTag}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Tag selector" });
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(createTag).toHaveBeenCalledExactlyOnceWith("x");
    expect(input).toBeDisabled();
    rejectRequest(new Error("offline"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to create tag.",
    );
    expect(input).not.toBeDisabled();
  });

  it("aborts superseded and unmounted tag searches and ignores late results", async () => {
    vi.useFakeTimers();

    try {
      const first = deferred<TagValue[]>();
      const second = deferred<TagValue[]>();
      const loadOptions = vi
        .fn<TagLoadOptionsFn>()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce([{ id: "new", name: "Newest", slug: "newest" }])
        .mockReturnValueOnce(second.promise);
      const { unmount } = render(
        <TagMultiSelect
          value={[]}
          onChangeAction={vi.fn()}
          loadOptionsAction={loadOptions}
          createTagAction={vi.fn()}
        />,
      );

      const input = screen.getByRole("textbox", { name: "Tag selector" });
      fireEvent.change(input, { target: { value: "old" } });
      await act(async () => vi.advanceTimersByTimeAsync(200));
      const oldSignal = loadOptions.mock.calls[0]?.[1];

      fireEvent.change(input, { target: { value: "new" } });
      await act(async () => vi.advanceTimersByTimeAsync(200));
      await act(async () =>
        first.resolve([{ id: "old", name: "Older", slug: "older" }]),
      );

      expect(oldSignal?.aborted).toBe(true);
      expect(screen.getByRole("button", { name: "Newest" })).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Older" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      fireEvent.change(input, { target: { value: "next" } });
      await act(async () => vi.advanceTimersByTimeAsync(200));
      const pendingSignal = loadOptions.mock.calls[2]?.[1];

      unmount();
      await act(async () =>
        second.reject(new DOMException("Aborted", "AbortError")),
      );

      expect(pendingSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
