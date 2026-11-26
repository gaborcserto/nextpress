import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import Link from "next/link";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUnsavedChanges } from "./useUnsavedChanges";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const initial = {
  title: "Original",
  tags: [],
  content: [{ type: "paragraph", children: [{ text: "Hello" }] }],
};

function Editor() {
  const [form, setForm] = React.useState(initial);
  const guard = useUnsavedChanges(form, true);

  return (
    <>
      <input
        aria-label="Title"
        value={form.title}
        onChange={(event) => setForm({ ...form, title: event.target.value })}
      />
      <Link href="/admin/posts">Posts</Link>
      <Link href="/admin/pages">Pages</Link>
      <button onClick={() => guard.requestNavigation(() => push("cancel"))}>
        Cancel
      </button>
      {guard.dialog}
    </>
  );
}

describe("unsaved editing", () => {
  beforeEach(() => push.mockReset());

  it("compares equivalent dates and optional empty fields without false dirty state", () => {
    const form: typeof initial & { publishedAt: string; cover?: null } = {
      ...initial,
      publishedAt: "2026-11-13T10:00:00+00:00",
    };
    const { result, rerender } = renderHook(
      ({ values }) => useUnsavedChanges(values, false),
      { initialProps: { values: form } },
    );
    rerender({
      values: { ...form, publishedAt: "2026-11-13T10:00:00.000Z", cover: null },
    });
    expect(result.current.dirty).toBe(false);
  });

  it("starts clean, ignores equivalent Slate normalization and persisted tags, detects undo and accepted saves", () => {
    const { result, rerender } = renderHook(
      ({ form }) => useUnsavedChanges(form, true),
      { initialProps: { form: initial } },
    );
    expect(result.current.dirty).toBe(false);
    rerender({
      form: {
        ...initial,
        tags: [],
        content: [
          {
            type: "paragraph",
            children: [{ text: "Hello", ...{ bold: false } }],
          },
        ],
      },
    });
    expect(result.current.dirty).toBe(false);
    rerender({
      form: {
        ...initial,
        content: [{ type: "paragraph", children: [{ text: "Changed" }] }],
      },
    });
    expect(result.current.dirty).toBe(true);
    rerender({ form: initial });
    expect(result.current.dirty).toBe(false);
    rerender({ form: { ...initial, title: "Changed" } });
    expect(result.current.dirty).toBe(true);
    act(() => result.current.markSaved());
    expect(result.current.dirty).toBe(false);
  });

  it("installs the native warning only while dirty and cleans up on undo and unmount", () => {
    const { rerender, unmount } = renderHook(
      ({ form }) => useUnsavedChanges(form, false),
      { initialProps: { form: initial } },
    );

    const warn = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);

      return event.defaultPrevented;
    };
    expect(warn()).toBe(false);
    rerender({ form: { ...initial, title: "Changed" } });
    expect(warn()).toBe(true);
    rerender({ form: initial });
    expect(warn()).toBe(false);
    rerender({ form: { ...initial, title: "Changed" } });
    unmount();
    expect(warn()).toBe(false);
  });

  it("allows clean Cancel, keeps edits on Stay, and retains the first destination across repeated attempts", () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(push).toHaveBeenCalledWith("cancel");
    push.mockClear();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("link", { name: "Posts" }));
    fireEvent.click(screen.getByRole("link", { name: "Pages" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Stay and edit" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Stay and edit" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Changed");
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Posts" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard and leave" }));
    expect(push).toHaveBeenCalledExactlyOnceWith("/admin/posts");
  });
});
