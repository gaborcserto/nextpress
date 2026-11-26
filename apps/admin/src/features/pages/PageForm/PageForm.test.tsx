import { ContentLayoutSchema, pageLayouts } from "@nextpress/shared/content";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { deferred } from "@/lib/testing/deferred.fixture";

import { pageValuesToDto } from "../page.client";
import PageForm from "./PageForm";

import type { PageFormValues } from "@/features/content/editor/contracts";
import type { LegacySaveOutcome } from "@/features/content/editor/legacy-editor";

const { submitAction } = vi.hoisted(() => ({ submitAction: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("@/ui/components", async () => ({
  ...(await vi.importActual<typeof import("@/ui/components")>(
    "@/ui/components",
  )),
  EMPTY_SLATE_VALUE: [{ type: "paragraph", children: [{ text: "" }] }],
  SlateEditor: () => null,
}));

vi.mock("../EventFields", () => ({ EventFields: () => null }));
vi.mock("../ListingFields", () => ({ ListingFields: () => null }));
vi.mock("../RedirectField", () => ({ RedirectField: () => null }));
vi.mock("@/features/taxonomy/TagsField", () => ({
  TagsField: ({
    onChangeAction,
    persist,
  }: {
    onChangeAction: (
      tags: { id: string; name: string; slug: string }[],
    ) => void;
    persist: boolean;
  }) => (
    <button
      type="button"
      onClick={() => onChangeAction([{ id: "tag", name: "Tag", slug: "tag" }])}
    >
      {persist ? "Assign immediately" : "Assign on save"}
    </button>
  ),
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

function renderPageForm(
  values: PageFormValues = initial,
  options: {
    save?: (values: PageFormValues) => Promise<LegacySaveOutcome>;
    contentId?: string;
    submitting?: boolean;
    submitLabel?: string;
  } = {},
) {
  const save = options.save ?? vi.fn(async () => true);

  return render(
    <PageForm
      contentId={options.contentId}
      initial={values}
      submitting={options.submitting}
      submitLabel={options.submitLabel}
      onSubmitAction={save}
      loadTagOptionsAction={async () => []}
      createTagAction={async (name) => ({ id: name, name, slug: name })}
      loadEntityTagsAction={async () => []}
      updateEntityTagsAction={async () => undefined}
    />,
  );
}

function getTitleInput() {
  return screen.getByLabelText("Title");
}

function getFormForButton(name: string) {
  const form = screen.getByRole("button", { name }).closest("form");

  if (!form) {
    throw new Error(`Expected the ${name} button to belong to a form`);
  }

  return form;
}

function mockCalendarDialog() {
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
}

describe("PageForm", () => {
  it("keeps controls visually enabled and shows an in-button saving state", () => {
    renderPageForm(
      { ...initial, title: "A page", slug: "a-page" },
      { submitting: true },
    );

    expect(getTitleInput()).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
  });

  it("shows the full record ID below the sidebar panels with a copy control", () => {
    const recordId = "page-record-123456789";
    renderPageForm(initial, { contentId: recordId });

    const heading = screen.getByRole("heading", { name: "Page" });
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
    mockCalendarDialog();
    renderPageForm();

    const trigger = screen.getByRole("button", { name: "Open calendar" });
    expect(trigger).toBeVisible();
    fireEvent.click(trigger);

    expect(
      screen.getByRole("button", { name: "Previous month" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Hour")).toBeVisible();
  });

  it("retains edits typed during a save and adopts the server publication date on the next submit", async () => {
    const { resolve, promise } = deferred<LegacySaveOutcome>();
    const savedAt = "2026-01-01T12:34:00.000Z";
    const save = vi
      .fn()
      .mockReturnValueOnce(promise)
      .mockResolvedValueOnce(true);
    renderPageForm(
      {
        ...initial,
        title: "Scheduled page",
        slug: "scheduled-page",
        status: "PUBLISHED",
        publishedAt: "2099-01-01T12:34:00.000Z",
      },
      { save },
    );
    const editor = getFormForButton("Save");
    const title = getTitleInput();

    expect(screen.getByText("Scheduled", { exact: true })).toBeVisible();
    fireEvent.submit(editor);
    fireEvent.change(title, { target: { value: "Newer edit" } });

    await act(async () =>
      resolve({ status: "PUBLISHED", publishedAt: savedAt }),
    );

    expect(title).toHaveValue("Newer edit");
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
    await act(async () => fireEvent.submit(editor));

    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "Newer edit",
        publishedAt: savedAt,
      }),
    );
  });

  it.each([undefined, "page-1"])(
    "omits hierarchy and navigation panels for page creation and editing (%s)",
    (contentId) => {
      renderPageForm(initial, { save: vi.fn(async () => true), contentId });

      expect(screen.queryByText("Hierarchy")).not.toBeInTheDocument();
      expect(screen.queryByText("Navigation")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Manage menu placement" }),
      ).not.toBeInTheDocument();
    },
  );

  it("shows the Homepage helper only in the page type field", () => {
    renderPageForm({ ...initial, type: pageLayouts.home });

    expect(
      screen.getByText("This page is the website's default landing page."),
    ).toBeVisible();
    expect(
      screen.queryByText(
        "This is the website's default landing page. Only one Homepage page can exist.",
      ),
    ).not.toBeInTheDocument();
  });

  it("retains failed edits and retries tags through the same form save", async () => {
    const save = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    renderPageForm(
      { ...initial, title: "Existing", slug: "existing" },
      { save },
    );
    fireEvent.click(screen.getByRole("button", { name: "Assign on save" }));
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Save" })),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Save failed");
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tags: [{ id: "tag", name: "Tag", slug: "tag" }],
      }),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Save" })),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("round-trips a scheduled Page date through an unrelated edit", async () => {
    const publishedAt = "2026-12-01T12:30:00.000Z";
    const save = vi.fn(async (_values: PageFormValues) => true);
    renderPageForm(
      {
        ...initial,
        status: "PUBLISHED",
        title: "Scheduled",
        slug: "scheduled",
        publishedAt,
      },
      { save },
    );
    fireEvent.change(getTitleInput(), {
      target: { value: "Edited schedule" },
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Save" })),
    );
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ publishedAt, status: "PUBLISHED" }),
    );
    expect(
      pageValuesToDto(save.mock.calls[0]?.[0] ?? initial).publishedAt,
    ).toBe(publishedAt);
  });

  it("offers four page types and reveals the tag filter only for Posts pages", () => {
    renderPageForm();
    const selector = screen.getByRole("combobox", { name: "Page type" });

    expect(selector).toHaveValue("STANDARD");

    for (const name of [
      "Standard Page",
      "Homepage — default landing page",
      "Posts Page",
      "Gallery Page",
    ]) {
      expect(within(selector).getByRole("option", { name })).toBeEnabled();
    }

    expect(screen.queryByLabelText("Filter by tag")).not.toBeInTheDocument();
    fireEvent.change(selector, { target: { value: pageLayouts.posts } });
    expect(screen.getByLabelText("Filter by tag")).toBeVisible();
  });

  it("places Posts listing below Tags in the sidebar only for Posts pages", () => {
    renderPageForm();

    expect(
      screen.queryByRole("heading", { name: "Posts listing" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Page type" }), {
      target: { value: pageLayouts.posts },
    });

    const postsHeading = screen.getByRole("heading", {
      name: "Posts listing",
    });
    const tagsHeading = screen.getByRole("heading", { name: "Tags" });
    const sidebar = postsHeading.closest("aside");

    expect(sidebar).not.toBeNull();
    expect(sidebar).toContainElement(tagsHeading);
    expect(
      tagsHeading.compareDocumentPosition(postsHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it("allows an explicit change from an existing layout to Standard", () => {
    renderPageForm({ ...initial, type: "LISTING" });
    fireEvent.change(screen.getByRole("combobox", { name: "Page type" }), {
      target: { value: "STANDARD" },
    });
    expect(screen.getByRole("combobox", { name: "Page type" })).toHaveValue(
      "STANDARD",
    );
    expect(
      screen.queryByRole("option", { name: /Listing/ }),
    ).not.toBeInTheDocument();
  });

  it.each(
    ContentLayoutSchema.options.filter(
      (layout) => !Object.values<string>(pageLayouts).includes(layout),
    ),
  )(
    "preserves existing %s layout and specialized fields on unrelated edits",
    async (type) => {
      const legacy = {
        ...initial,
        id: "legacy-page",
        type,
        title: "Historical page",
        slug: "historical-page",
        parentId: "parent-1",
        listingKind: "EVENTS" as const,
        listingTaxonomyId: "taxonomy-1",
        eventStart: "2026-12-01T12:00:00.000Z",
        eventEnd: "2026-12-01T14:00:00.000Z",
        eventLocation: "Main hall",
        registrationUrl: "https://example.com/register",
        redirectTo: "/historical-target",
      };
      const save = vi.fn(async () => true);
      renderPageForm(legacy, { save });
      expect(screen.getByRole("combobox", { name: "Page type" })).toHaveValue(
        type,
      );
      expect(screen.getByRole("option", { name: /legacy/ })).toBeDisabled();
      fireEvent.change(getTitleInput(), {
        target: { value: "Edited title" },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });
      expect(save).toHaveBeenCalledWith({ ...legacy, title: "Edited title" });
      const dto = pageValuesToDto({ ...legacy, title: "Edited title" });
      expect(dto.layout).toBe(type);

      for (const field of [
        "parentId",
        "listingKind",
        "listingTaxonomyId",
        "eventStart",
        "eventEnd",
        "eventLocation",
        "registrationUrl",
        "redirectTo",
      ]) {
        expect(dto).not.toHaveProperty(field);
      }
    },
  );

  it.each([false, true])(
    "retains unsaved input on failed save and resets only on success (%s)",
    async (accepted) => {
      const save = vi.fn(async () => accepted);
      renderPageForm(initial, { save });
      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Local page" },
      });
      const button = screen.getByRole("button", { name: "Save" });
      const form = button.closest("form");
      expect(form).not.toBeNull();
      await act(async () => {
        if (form) {
          fireEvent.submit(form);
        }
      });
      expect(getTitleInput()).toHaveValue("Local page");
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(!accepted);
    },
  );

  it.each([null, "parent-1"])(
    "preserves parent %s without requesting hierarchy choices",
    async (parentId) => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const save = vi.fn(async (values: PageFormValues) => {
        expect(values.parentId).toBe(parentId);
        expect(pageValuesToDto(values)).not.toHaveProperty("parentId");

        return true;
      });
      renderPageForm({ ...initial, parentId }, { save });
      expect(
        screen.queryByRole("combobox", { name: "Parent page" }),
      ).not.toBeInTheDocument();
      fireEvent.change(getTitleInput(), {
        target: { value: "Updated page" },
      });
      await act(async () => {
        fireEvent.submit(
          screen.getByRole("button", { name: "Save" }).closest("form")!,
        );
      });
      expect(save).toHaveBeenCalledOnce();
      expect(fetchSpy).not.toHaveBeenCalledWith(
        "/api/admin/page-hierarchy",
        expect.anything(),
      );
      expect(
        fetchSpy.mock.calls.some(
          ([url]) => url === "/api/admin/page-hierarchy",
        ),
      ).toBe(false);
      fetchSpy.mockRestore();
    },
  );

  it("validates required fields inline and submits through its form", () => {
    submitAction.mockReset();
    renderPageForm(initial, {
      save: submitAction,
      submitLabel: "Create",
    });

    const form = screen
      .getByRole("button", { name: "Create" })
      .closest("form")!;
    fireEvent.submit(form);

    expect(screen.getByText("Title is required.")).toBeInTheDocument();
    expect(screen.getByText("Slug is required.")).toBeInTheDocument();
    expect(submitAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "A new page" },
    });
    expect(screen.queryByText("Slug is required.")).not.toBeInTheDocument();
    fireEvent.submit(form);

    expect(submitAction).toHaveBeenCalledOnce();
    expect(submitAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: "A new page", slug: "a-new-page" }),
    );
  });
});
