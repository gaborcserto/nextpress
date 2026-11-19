import { ContentLayoutSchema } from "@nextpress/shared/content";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { pageValuesToDto } from "@/lib/services/page.client";

import PageForm from "./PageForm";

import type { PageFormValues } from "@/lib/content/contracts";

const { submitAction } = vi.hoisted(() => ({ submitAction: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("@/ui/components", async () => ({
  ...(await vi.importActual<typeof import("@/ui/components")>(
    "@/ui/components",
  )),
  EMPTY_SLATE_VALUE: [{ type: "paragraph", children: [{ text: "" }] }],
  EventFields: () => null,
  HierarchyField: (
    await import("@/ui/components/HierarchyField/HierarchyField")
  ).default,
  ListingFields: () => null,
  MenuPlacementField: (
    await import("@/ui/components/MenuPlacementField/MenuPlacementField")
  ).default,
  PageTypeField: (await import("@/ui/components/PageTypeField/PageTypeField"))
    .default,
  RedirectField: () => null,
  SlateEditor: () => null,
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

function renderPage(
  values: PageFormValues,
  save: (values: PageFormValues) => Promise<boolean> = vi.fn(async () => true),
) {
  return render(
    <PageForm
      initial={values}
      onSubmitAction={save}
      loadTagOptionsAction={async () => []}
      createTagAction={async (name) => ({ id: name, name, slug: name })}
      loadEntityTagsAction={async () => []}
      updateEntityTagsAction={async () => undefined}
    />,
  );
}

describe("PageForm", () => {
  it("keeps header and footer menu placements independently selectable and saved", async () => {
    const save = vi.fn(async () => true);
    renderPage(
      {
        ...initial,
        title: "Navigation page",
        slug: "navigation-page",
        inHeaderMenu: true,
      },
      save,
    );

    const headerPlacement = screen.getByRole("checkbox", {
      name: "Show in header menu",
    });
    const footerPlacement = screen.getByRole("checkbox", {
      name: "Show in footer menu",
    });
    expect(headerPlacement).toBeChecked();
    expect(footerPlacement).not.toBeChecked();

    fireEvent.click(footerPlacement);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Save" })),
    );

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ inHeaderMenu: true, inFooterMenu: true }),
    );
  });

  it("retains failed edits and retries tags through the same form save", async () => {
    const save = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    renderPage({ ...initial, title: "Existing", slug: "existing" }, save);
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
    renderPage(
      {
        ...initial,
        status: "PUBLISHED",
        title: "Scheduled",
        slug: "scheduled",
        publishedAt,
      },
      save,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
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

  it("offers only Standard for new pages", () => {
    renderPage(initial);
    expect(screen.getByRole("combobox", { name: "Layout" })).toHaveValue(
      "STANDARD",
    );
    expect(
      within(screen.getByRole("combobox", { name: "Layout" })).getAllByRole(
        "option",
      ),
    ).toHaveLength(2);
    expect(screen.getByRole("option", { name: "Standard Page" })).toBeEnabled();
    expect(
      screen.queryByRole("option", { name: /Listing/ }),
    ).not.toBeInTheDocument();
  });

  it("allows an explicit change from an existing layout to Standard", () => {
    renderPage({ ...initial, type: "LISTING" });
    fireEvent.change(screen.getByRole("combobox", { name: "Layout" }), {
      target: { value: "STANDARD" },
    });
    expect(screen.getByRole("combobox", { name: "Layout" })).toHaveValue(
      "STANDARD",
    );
    expect(
      screen.queryByRole("option", { name: /Listing/ }),
    ).not.toBeInTheDocument();
  });

  it.each(
    ContentLayoutSchema.options.filter((layout) => layout !== "STANDARD"),
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
      renderPage(legacy, save);
      expect(screen.getByRole("combobox", { name: "Layout" })).toHaveValue(
        type,
      );
      expect(screen.getByRole("option", { name: /existing/ })).toBeDisabled();
      fireEvent.change(screen.getByLabelText("Title"), {
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
      render(
        <PageForm
          initial={initial}
          onSubmitAction={save}
          loadTagOptionsAction={async () => []}
          createTagAction={async (name) => ({ id: name, name, slug: name })}
          loadEntityTagsAction={async () => []}
          updateEntityTagsAction={async () => undefined}
        />,
      );
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
      expect(screen.getByLabelText("Title")).toHaveValue("Local page");
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
      render(
        <PageForm
          initial={{ ...initial, parentId }}
          onSubmitAction={save}
          loadTagOptionsAction={async () => []}
          createTagAction={async (name) => ({ id: name, name, slug: name })}
          loadEntityTagsAction={async () => []}
          updateEntityTagsAction={async () => undefined}
        />,
      );
      expect(
        screen.getByText(
          parentId
            ? "A parent page is assigned."
            : "No parent page is assigned.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("combobox", { name: "Parent page" }),
      ).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Updated page" },
      });
      await act(async () => {
        fireEvent.submit(
          screen.getByRole("button", { name: "Save" }).closest("form")!,
        );
      });
      expect(save).toHaveBeenCalledOnce();
      expect(fetchSpy).not.toHaveBeenCalledWith(
        "/api/pages?select=parent",
        expect.anything(),
      );
      expect(
        fetchSpy.mock.calls.some(([url]) => url === "/api/pages?select=parent"),
      ).toBe(false);
      fetchSpy.mockRestore();
    },
  );

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
    fireEvent.submit(form);

    expect(submitAction).toHaveBeenCalledOnce();
    expect(submitAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: "A new page", slug: "a-new-page" }),
    );
  });
});
