import { textDocument } from "@nextpress/shared/content";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RevisionEditor from "./RevisionEditor";

import type { ReactNode } from "react";

vi.mock("@/ui/shell", () => ({
  AdminPageLayout: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock("./LivePreview", () => ({
  default: ({ snapshot }: { snapshot: { title: string } }) => (
    <section aria-label="Revision preview">{snapshot.title}</section>
  ),
}));

const snapshot = {
  title: "Latest draft",
  slug: "draft",
  content: JSON.stringify(textDocument("Revision content")),
  excerpt: null,
  layout: "STANDARD",
  pageDocument: null,
};
const latest = {
  ...snapshot,
  id: "latest",
  workingVersion: 2,
  createdAt: "2026-11-12T00:00:00Z",
};
const older = {
  ...latest,
  id: "older",
  title: "Older draft",
  workingVersion: 1,
};
const revisions = { version: 2, current: snapshot, revisions: [latest, older] };
const fetchMock = vi.fn<typeof fetch>();

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

async function openEditor() {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValueOnce(Response.json(revisions));
  render(<RevisionEditor pageId="page-1" />);

  await waitFor(() =>
    expect(screen.getByLabelText("Working title")).toHaveValue("Latest draft"),
  );
  fireEvent.change(screen.getByLabelText("Saved revision"), {
    target: { value: "older" },
  });
}

describe("revision actions", () => {
  it.each([
    ["Restore revision", "restore", "Revision restored as a new draft."],
    ["Publish revision", "publish", "Revision published."],
    ["Unpublish content", "unpublish", "Content unpublished."],
  ])(
    "reports the result of %s and targets the selected revision",
    async (label, action, success) => {
      await openEditor();
      fetchMock
        .mockResolvedValueOnce(Response.json({}))
        .mockResolvedValueOnce(Response.json(revisions));

      fireEvent.click(screen.getByRole("button", { name: label }));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(success),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/pages/page-1/revisions",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: 2,
            revisionId: "older",
            action,
          }),
        },
      );
    },
  );

  it("loads the newly saved revision and reports a working save", async () => {
    await openEditor();
    fireEvent.change(screen.getByLabelText("Working title"), {
      target: { value: "Saved draft" },
    });
    const saved = {
      ...older,
      id: "saved",
      title: "Saved draft",
      workingVersion: 3,
    };
    fetchMock.mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(
      Response.json({
        ...revisions,
        version: 3,
        revisions: [saved, latest, older],
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Save working revision" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Working revision saved.",
      ),
    );
    expect(screen.getByLabelText("Working title")).toHaveValue("Saved draft");
    expect(screen.getByLabelText("Saved revision")).toHaveValue("saved");

    const body = fetchMock.mock.calls[1]?.[1]?.body;

    if (typeof body !== "string") {
      throw new Error("Expected a serialized revision request");
    }

    expect(JSON.parse(body)).toMatchObject({
      expectedVersion: 2,
      title: "Saved draft",
      content: older.content,
      slug: older.slug,
      pageDocument: null,
    });
  });

  it("keeps the selected revision and unsaved title after a save conflict", async () => {
    await openEditor();
    fireEvent.change(screen.getByLabelText("Working title"), {
      target: { value: "Unsaved title" },
    });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 409 }));

    fireEvent.click(
      screen.getByRole("button", { name: "Save working revision" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Unable to save the working revision: Content changed",
      ),
    );
    expect(screen.getByLabelText("Working title")).toHaveValue("Unsaved title");
    expect(screen.getByLabelText("Saved revision")).toHaveValue("older");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("previews an exact older revision without reloading the selection", async () => {
    await openEditor();
    fetchMock.mockResolvedValueOnce(Response.json(older));

    fireEvent.click(screen.getByRole("button", { name: "Preview revision" }));

    expect(
      await screen.findByRole("region", { name: "Revision preview" }),
    ).toHaveTextContent("Older draft");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Revision preview loaded.",
    );
    expect(screen.getByLabelText("Saved revision")).toHaveValue("older");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/pages/page-1/revisions?revisionId=older",
      { cache: "no-store" },
    );
  });
});
