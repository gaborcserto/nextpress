import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TagsField from "./TagsField";

const selectedTag = { id: "tag-2", name: "Selected", slug: "selected" };

vi.mock("@/ui/components/TagMultiSelect", () => ({
  TagMultiSelect: ({
    onChangeAction,
  }: {
    onChangeAction: (tags: typeof selectedTag[]) => void;
  }) => (
    <button type="button" onClick={() => onChangeAction([selectedTag])}>
      Select tag
    </button>
  ),
}));

describe("TagsField", () => {
  it("rolls back selection and reports persistence failures", async () => {
    const existingTag = { id: "tag-1", name: "Existing", slug: "existing" };
    const onChange = vi.fn();
    render(<TagsField
      entityId="post-1"
      value={[existingTag]}
      onChangeAction={onChange}
      loadOptionsAction={async () => []}
      createTagAction={vi.fn()}
      loadEntityTagsAction={async () => [existingTag]}
      updateEntityTagsAction={async () => { throw new Error("offline"); }}
    />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Select tag" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Select tag" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save tags.");
    expect(onChange).toHaveBeenLastCalledWith([existingTag]);
  });

  it("uses feature-supplied entity loading and persistence actions", async () => {
    const existingTag = { id: "tag-1", name: "Existing", slug: "existing" };
    const onChange = vi.fn();
    const loadEntityTags = vi.fn().mockResolvedValue([existingTag]);
    const updateEntityTags = vi.fn().mockResolvedValue(undefined);

    render(
      <TagsField
        entityId="post-1"
        value={[]}
        onChangeAction={onChange}
        loadOptionsAction={vi.fn().mockResolvedValue([])}
        createTagAction={vi.fn()}
        loadEntityTagsAction={loadEntityTags}
        updateEntityTagsAction={updateEntityTags}
      />,
    );

    await waitFor(() => {
      expect(loadEntityTags).toHaveBeenCalledWith("post-1");
      expect(onChange).toHaveBeenCalledWith([existingTag]);
    });

    fireEvent.click(screen.getByRole("button", { name: "Select tag" }));

    await waitFor(() => {
      expect(updateEntityTags).toHaveBeenCalledWith("post-1", ["tag-2"]);
    });
  });
});
