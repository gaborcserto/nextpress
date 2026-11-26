import { DEFAULT_SITE_DATE_TIME } from "@nextpress/shared/site-date-time";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminDateTimeProvider } from "@/lib/settings/admin-date-time";

import PostForm from "./PostForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("@/ui/components", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/components")>()),
  EMPTY_SLATE_VALUE: [{ type: "paragraph", children: [{ text: "" }] }],
  SlateEditor: () => null,
}));

vi.mock("../PostIntroFields", () => ({ PostIntroFields: () => null }));
vi.mock("@/features/taxonomy/TagsField", () => ({ TagsField: () => null }));

describe("PostForm", () => {
  it("shows the full record ID below the sidebar panels with a copy control", () => {
    const recordId = "post-record-123456789";
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
        contentId={recordId}
        onSubmitAction={vi.fn()}
        loadTagOptionsAction={async () => []}
        createTagAction={vi.fn()}
        loadEntityTagsAction={async () => []}
        updateEntityTagsAction={vi.fn()}
      />,
    );

    const heading = screen.getByRole("heading", { name: "Post" });
    const id = screen.getByText(recordId);

    expect(id.closest("aside")).toBeInTheDocument();
    expect(id.closest("header")).not.toBeInTheDocument();
    expect(id).toHaveClass("font-mono");
    expect(
      screen.getByRole("button", { name: "Copy document ID" }),
    ).toBeInTheDocument();
    expect(heading).toBeInTheDocument();
  });

  it("opens the shared date and time picker from the Publishing panel", () => {
    vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(
      function showModal(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    );
    vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(
      function close(this: HTMLDialogElement) {
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
      },
    );
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
        onSubmitAction={vi.fn()}
        loadTagOptionsAction={async () => []}
        createTagAction={vi.fn()}
        loadEntityTagsAction={async () => []}
        updateEntityTagsAction={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Open calendar" });
    expect(trigger).toBeVisible();
    fireEvent.click(trigger);

    expect(
      screen.getByRole("button", { name: "Previous month" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Hour")).toBeVisible();
  });

  it("keeps field appearance during save while inert locks form interaction", () => {
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
    expect(screen.getByLabelText("Status")).not.toBeDisabled();
    expect(screen.getByLabelText("Title")).not.toBeDisabled();
    expect(screen.getByLabelText("Status").closest("fieldset")).toHaveAttribute(
      "inert",
    );
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
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
    const publicationField = screen.getByLabelText(
      "Publish date and Publish time",
    );
    fireEvent.change(publicationField, {
      target: { value: "2024-07-01 12:00" },
    });
    fireEvent.blur(publicationField);
    fireEvent.submit(form);
    expect(submit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        publishedAt: "2024-07-01T10:00:00.000Z",
      }),
    );
  });
});
