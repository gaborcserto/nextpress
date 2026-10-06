import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PostForm from "./PostForm";

vi.mock("@/ui/components", () => ({
  EMPTY_SLATE_VALUE: [{ type: "paragraph", children: [{ text: "" }] }],
  PostIntroFields: () => null,
  SlateEditor: () => null,
  TagsField: () => null,
}));

describe("PostForm", () => {
  it("associates status and publication date labels and disables fields during save", () => {
    render(<PostForm
      initial={{ title: "Post", slug: "post", status: "DRAFT", excerpt: [], content: [], tags: [], cover: null, publishedAt: null }}
      submitting
      onSubmitAction={vi.fn()}
      loadTagOptionsAction={async () => []}
      createTagAction={vi.fn()}
      loadEntityTagsAction={async () => []}
      updateEntityTagsAction={vi.fn()}
    />);
    expect(screen.getByLabelText("Status")).toBeDisabled();
    expect(screen.getByLabelText("Publish date")).toBeDisabled();
  });
  it("preserves an unedited publication instant and converts local date edits to ISO", () => {
    const submit = vi.fn();
    const original = "2024-10-27T01:30:56.789Z";
    render(<PostForm
      initial={{ title: "Post", slug: "post", status: "PUBLISHED", excerpt: [], content: [], tags: [], cover: null, publishedAt: original }}
      onSubmitAction={submit}
      loadTagOptionsAction={async () => []}
      createTagAction={vi.fn()}
      loadEntityTagsAction={async () => []}
      updateEntityTagsAction={vi.fn()}
    />);
    const form = screen.getByRole("button", { name: "Save post" }).closest("form");
    if (!form) throw new Error("Expected a post form");
    fireEvent.submit(form);
    expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ publishedAt: original }));
    fireEvent.change(screen.getByLabelText("Publish date"), { target: { value: "2024-07-01T12:00" } });
    fireEvent.submit(form);
    expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ publishedAt: new Date("2024-07-01T12:00").toISOString() }));
  });
});
