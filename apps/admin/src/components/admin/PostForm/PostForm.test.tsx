import { DEFAULT_SITE_DATE_TIME } from "@nextpress/shared/site-date-time";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminDateTimeProvider } from "@/lib/settings/admin-date-time";

import PostForm from "./PostForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("@/ui/components", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/components")>()),
  EMPTY_SLATE_VALUE: [{ type: "paragraph", children: [{ text: "" }] }],
  PostIntroFields: () => null,
  SlateEditor: () => null,
  TagsField: () => null,
}));

describe("PostForm", () => {
  it("associates status and publication date labels and disables fields during save", () => {
    render(
      <PostForm
        initial={{
          title: "Post",
          slug: "post",
          status: "DRAFT",
          excerpt: [],
          content: [],
          tags: [],
          cover: null,
          publishedAt: null,
        }}
        submitting
        onSubmitAction={vi.fn()}
        loadTagOptionsAction={async () => []}
        createTagAction={vi.fn()}
        loadEntityTagsAction={async () => []}
        updateEntityTagsAction={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Status")).toBeDisabled();
    expect(screen.getByLabelText("Publish date")).toBeDisabled();
  });
  it("preserves an unedited publication instant and converts local date edits to ISO", () => {
    const submit = vi.fn();
    const original = "2024-10-27T01:30:56.789Z";
    render(
      <AdminDateTimeProvider
        settings={{ ...DEFAULT_SITE_DATE_TIME, timeZone: "Europe/Budapest" }}
      >
        <PostForm
          initial={{
            title: "Post",
            slug: "post",
            status: "PUBLISHED",
            excerpt: [],
            content: [],
            tags: [],
            cover: null,
            publishedAt: original,
          }}
          onSubmitAction={submit}
          loadTagOptionsAction={async () => []}
          createTagAction={vi.fn()}
          loadEntityTagsAction={async () => []}
          updateEntityTagsAction={vi.fn()}
        />
      </AdminDateTimeProvider>,
    );
    const form = screen
      .getByRole("button", { name: "Save post" })
      .closest("form");

    if (!form) {
      throw new Error("Expected a post form");
    }

    fireEvent.submit(form);
    expect(submit).toHaveBeenLastCalledWith(
      expect.objectContaining({ publishedAt: original }),
    );
    fireEvent.change(screen.getByLabelText("Publish date"), {
      target: { value: "2024-07-01" },
    });
    fireEvent.blur(screen.getByLabelText("Publish date"));
    fireEvent.change(screen.getByLabelText("Publish time"), {
      target: { value: "12:00" },
    });
    fireEvent.blur(screen.getByLabelText("Publish time"));
    fireEvent.submit(form);
    expect(submit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        publishedAt: "2024-07-01T10:00:00.000Z",
      }),
    );
  });
});
