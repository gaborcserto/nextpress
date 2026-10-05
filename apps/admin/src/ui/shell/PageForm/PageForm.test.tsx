import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PageForm from "./PageForm";
import type { PageFormValues } from "@/lib/content/contracts";

const { submitAction } = vi.hoisted(() => ({ submitAction: vi.fn() }));

vi.mock("@/ui/components", () => ({
  EMPTY_SLATE_VALUE: [{ type: "paragraph", children: [{ text: "" }] }],
  EventFields: () => null,
  HierarchyField: () => null,
  ListingFields: () => null,
  MenuPlacementField: () => null,
  PageTypeField: () => null,
  RedirectField: () => null,
  SlateEditor: () => null,
  TagsField: () => null,
}));

const initial: PageFormValues = {
  type: "STANDARD" as const,
  status: "DRAFT" as const,
  slug: "",
  title: "",
  content: [{ type: "paragraph", children: [{ text: "" }] }],
  tags: [],
  parentId: null,
  inHeaderMenu: false,
  inFooterMenu: false,
};

describe("PageForm", () => {
  it("validates required fields inline and submits through its form", () => {
    submitAction.mockReset();
    render(
      <PageForm
        initial={initial}
        onSubmitAction={submitAction}
        submitLabel="Create"
        loadTagOptionsAction={async () => []}
        createTagAction={async (name) => ({ id: name, name, slug: name })}
        loadEntityTagsAction={async () => []}
        updateEntityTagsAction={async () => undefined}
      />,
    );

    const form = screen.getByRole("button", { name: "Create" }).closest("form")!;
    fireEvent.submit(form);

    expect(screen.getByText("Title is required.")).toBeInTheDocument();
    expect(screen.getByText("Slug is required.")).toBeInTheDocument();
    expect(submitAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "A new page" },
    });
    fireEvent.submit(form);

    expect(submitAction).toHaveBeenCalledOnce();
    expect(submitAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: "A new page", slug: "a-new-page" }),
    );
  });
});
