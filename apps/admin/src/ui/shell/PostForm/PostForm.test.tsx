import { render, screen } from "@testing-library/react";
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
});
