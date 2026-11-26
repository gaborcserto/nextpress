import { textDocument } from "@nextpress/shared/content";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RevisionEditor from "./RevisionEditor";

import type { ReactNode } from "react";

vi.mock("@/ui/shell", () => ({
  AdminPageLayout: ({
    actions,
    children,
  }: {
    actions?: ReactNode;
    children: ReactNode;
  }) => (
    <main>
      <header>{actions}</header>
      {children}
    </main>
  ),
}));

vi.mock("../LivePreview/LivePreview", () => ({
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
  updatedAt: "2026-11-12T00:00:00Z",
};
const latest = {
  ...snapshot,
  id: "latest",
  workingVersion: 2,
  createdAt: "2026-11-12T00:00:00Z",
  authorName: "Content editor",
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
    expect(
      screen.getByText("Latest draft", { selector: "dd" }),
    ).toBeInTheDocument(),
  );
  fireEvent.click(
    screen.getByRole("radio", {
      name: "Select revision 1: Older draft",
    }),
  );
}

describe("revision actions", () => {
  it("renders the working copy and history in matching Admin panels", async () => {
    await openEditor();

    expect(
      document.querySelectorAll(".admin-revisions-layout > .admin-surface"),
    ).toHaveLength(2);
  });

  it("shows a compact empty history state when no snapshots exist", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(
      Response.json({ version: 2, current: snapshot, revisions: [] }),
    );
    render(<RevisionEditor pageId="page-1" />);

    expect(
      await screen.findByText("No saved revisions yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Previous document versions will appear here."),
    ).toBeVisible();
    const emptyState = screen
      .getByText("No saved revisions yet")
      .closest(".admin-revision-empty-state");
    expect(emptyState).toHaveClass("admin-revision-empty-state");
    expect(emptyState?.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Save working revision" }),
    ).toBeEnabled();
    expect(screen.getByText("Current working copy")).toBeInTheDocument();
    expect(screen.getAllByText("Working version 2")).toHaveLength(2);
    expect(screen.getByText("Last modified:")).toBeVisible();
    expect(screen.getByText("Document title")).toBeVisible();
    expect(screen.getByText("Latest draft", { selector: "dd" })).toBeVisible();
    expect(screen.queryByLabelText("Working title")).not.toBeInTheDocument();
    expect(screen.queryByText("Current title")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish revision" }),
    ).not.toBeInTheDocument();
  });

  it("does not show the empty state when revision loading fails", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValueOnce(new Error("Network failure"));
    render(<RevisionEditor pageId="page-1" />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Unable to load revisions",
    );
    expect(
      screen.queryByText("No saved revisions yet"),
    ).not.toBeInTheDocument();
  });

  it.each([
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

  it("restores from the selected saved timeline entry", async () => {
    await openEditor();
    fetchMock
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json(revisions));

    fireEvent.click(screen.getByRole("button", { name: "Restore revision 1" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Revision restored as a new draft.",
      ),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/pages/page-1/revisions",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          expectedVersion: 2,
          revisionId: "older",
          action: "restore",
        }),
      }),
    );
  });

  it("loads the newly saved revision and reports a working save", async () => {
    await openEditor();
    const saved = {
      ...older,
      id: "saved",
      title: "Latest draft",
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
    expect(
      screen.getByRole("radio", { name: "Select revision 3: Latest draft" }),
    ).toBeChecked();

    const body = fetchMock.mock.calls[1]?.[1]?.body;

    if (typeof body !== "string") {
      throw new Error("Expected a serialized revision request");
    }

    expect(JSON.parse(body)).toMatchObject({
      expectedVersion: 2,
      title: snapshot.title,
      content: snapshot.content,
      slug: snapshot.slug,
      pageDocument: null,
    });
  });

  it("keeps the selected revision and read-only working title after a save conflict", async () => {
    await openEditor();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 409 }));

    fireEvent.click(
      screen.getByRole("button", { name: "Save working revision" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Unable to save the working revision: Content changed",
      ),
    );
    expect(
      screen.getByText("Latest draft", { selector: "dd" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", {
        name: "Select revision 1: Older draft",
      }),
    ).toBeChecked();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("previews an exact older revision without reloading the selection", async () => {
    await openEditor();
    fetchMock.mockResolvedValueOnce(Response.json(older));

    fireEvent.click(screen.getByRole("button", { name: "Preview revision 1" }));

    expect(
      await screen.findByRole("region", { name: "Revision preview" }),
    ).toHaveTextContent("Older draft");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Revision preview loaded.",
    );
    expect(screen.getAllByText("By Content editor").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("radio", {
        name: "Select revision 1: Older draft",
      }),
    ).toBeChecked();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/pages/page-1/revisions?revisionId=older",
      { cache: "no-store" },
    );
  });
});
