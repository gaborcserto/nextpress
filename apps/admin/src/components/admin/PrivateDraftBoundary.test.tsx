import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  privatePageValues,
  privatePostValues,
} from "@/lib/content/private-draft.client";
import { privateDraftFixture } from "@/lib/content/private-draft.fixtures";

import { PrivateDraftBoundary } from "./PrivateDraftBoundary";

type DraftKind = ReturnType<typeof privateDraftFixture>["aggregate"]["kind"];

const { fetchMock, push } = vi.hoisted(() => ({
  fetchMock: vi.fn<typeof import("@/lib/api").apiFetch>(),
  push: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiFetch: fetchMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/ui/components/SlateEditor", () => ({
  SlateEditor: () => null,
  EMPTY_SLATE_VALUE: [{ type: "paragraph", children: [{ text: "" }] }],
}));
vi.mock("@/ui/components/TagsField", () => ({ TagsField: () => null }));

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
});
afterEach(() => vi.useRealTimers());

function renderDraftBoundary(kind: DraftKind, wrapper?: typeof StrictMode) {
  render(
    <PrivateDraftBoundary id="page" kind={kind}>
      <button>Legacy Save</button>
    </PrivateDraftBoundary>,
    { wrapper },
  );
}

function draftRequests(method: "GET" | "PUT") {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === method);
}

function readDraftRequestBody(init?: RequestInit): unknown {
  if (typeof init?.body !== "string") {
    throw new Error("Expected a JSON body for the private draft request");
  }

  return JSON.parse(init.body);
}

function startSaveDiagnostics(kind: DraftKind) {
  const startedAt = performance.now();

  return (stage: string) => {
    console.info(
      `[private-draft-test] kind=${kind} stage=${stage} elapsedMs=${Math.round(performance.now() - startedAt)}`,
    );
  };
}

describe("private editor values", () => {
  it("uses current tag labels while retaining canonical relationship identities", () => {
    const draft = privateDraftFixture();
    draft.aggregate.snapshot.relationships.tagIds = ["tag"];
    draft.tagLabels = [
      { id: "tag", name: "Readable tag", slug: "readable-tag" },
    ];

    expect(privatePageValues(draft).tags).toEqual(draft.tagLabels);
    expect(privatePostValues(draft).tags).toEqual(draft.tagLabels);
  });
});

describe("private editor admission", () => {
  it("shows legacy Save only after the server explicitly disables private drafts", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { code: "PRIVATE_DRAFT_DISABLED" },
        {
          status: 503,
        },
      ),
    );

    renderDraftBoundary("PAGE");

    expect(screen.queryByText("Legacy Save")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Legacy Save" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Private draft" }),
    ).not.toBeInTheDocument();
  });

  it("keeps legacy Save hidden when admission returns 403", async () => {
    fetchMock.mockResolvedValue(Response.json({}, { status: 403 }));

    renderDraftBoundary("PAGE");

    expect(
      await screen.findByText(/Private editing could not be loaded/),
    ).toBeVisible();
    expect(screen.queryByText("Legacy Save")).not.toBeInTheDocument();
  });
});

describe("private draft changes", () => {
  it.each(["PAGE", "POST"] as const)(
    "saves %s privately and keeps publication controls separate",
    async (kind) => {
      const reportStage = startSaveDiagnostics(kind);
      const initial = privateDraftFixture(kind, 2);

      fetchMock.mockImplementation(async (_path, init) => {
        const method = init?.method ?? "GET";
        reportStage(`request.${method}.received`);
        const draft = method === "PUT" ? privateDraftFixture(kind, 3) : initial;
        const response = Response.json(draft);

        reportStage(`request.${method}.response`);

        return response;
      });

      reportStage("render.start");
      await act(async () => {
        renderDraftBoundary(kind, StrictMode);
      });
      reportStage("render.complete");

      const draftRegion = screen.getByLabelText("Private draft", {
        selector: "section",
      });
      expect(draftRegion).toHaveRole("region");
      expect(draftRegion).toBeVisible();
      expect(draftRegion).toHaveTextContent(
        "require an explicit publication command",
      );
      reportStage("editor.available");

      const publication = within(draftRegion);
      expect(
        publication.getByRole("button", { name: "Publish Changes" }),
      ).toBeEnabled();
      expect(
        publication.getByRole("button", { name: "Unpublish" }),
      ).toBeEnabled();
      expect(screen.getByLabelText("Status", { exact: true })).toBeDisabled();
      expect(
        screen.getByLabelText("Publish date", { exact: true }),
      ).toBeDisabled();
      reportStage("public.controls.verified");

      const titleInput = screen.getByLabelText("Title", { exact: true });
      const saveButton = screen.getByLabelText("Save private draft", {
        selector: "button",
      });
      expect(saveButton).toBeVisible();
      fireEvent.change(titleInput, {
        target: { value: "Private changed" },
      });
      reportStage("title.edited");
      await act(async () => {
        fireEvent.click(saveButton);
        reportStage("save.clicked");
      });

      const saveRequests = draftRequests("PUT");
      expect(saveRequests).toHaveLength(1);
      reportStage("put.observed");

      const [saveRequest] = saveRequests;
      expect(saveRequest?.[0]).toBe("/api/private-drafts/page");
      const body = readDraftRequestBody(saveRequest?.[1]);
      expect(body).toMatchObject({
        expectedDraftVersion: 2,
        edit: { patch: { title: "Private changed" } },
      });
      expect(body).not.toHaveProperty("edit.patch.content");
      expect(screen.queryByText("Legacy Save")).not.toBeInTheDocument();

      expect(screen.getByRole("status")).toHaveTextContent(
        "Private draft saved · revision 3",
      );
      expect(screen.getByLabelText("Title", { exact: true })).toHaveValue(
        "Private changed",
      );
      reportStage("saved.title.verified");
    },
  );

  it("warns about unsaved edits and cancels autosave after confirmed discard", async () => {
    fetchMock.mockResolvedValue(Response.json(privateDraftFixture("PAGE", 1)));
    renderDraftBoundary("PAGE");
    await screen.findByRole("region", { name: "Private draft" });

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Title", { exact: true }), {
      target: { value: "Unsent" },
    });
    const refresh = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(refresh);
    expect(refresh.defaultPrevented).toBe(true);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Discard local changes",
      }),
    );
    expect(screen.getByLabelText("Title", { exact: true })).toHaveValue(
      "Unsent",
    );

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirm",
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Title", { exact: true })).toHaveValue(
      "Original",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(draftRequests("PUT")).toHaveLength(0);
  });

  it("warns that history is retained and reloads the server snapshot after reset", async () => {
    const reloadedDraft = privateDraftFixture("POST", 3);
    reloadedDraft.aggregate.snapshot.fields.title = "Live title";
    fetchMock
      .mockResolvedValueOnce(Response.json(privateDraftFixture("POST", 2)))
      .mockResolvedValueOnce(Response.json(privateDraftFixture("POST", 3)))
      .mockResolvedValueOnce(Response.json(reloadedDraft));

    renderDraftBoundary("POST");
    await screen.findByRole("region", { name: "Private draft" });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Reset private draft to live source",
      }),
    );
    const resetDialog = screen.getByRole("dialog");
    expect(resetDialog).toHaveTextContent("immutable historical storage");

    fireEvent.click(
      within(resetDialog).getByRole("button", { name: "Confirm" }),
    );

    expect(await screen.findByDisplayValue("Live title")).toBe(
      screen.getByLabelText("Title", { exact: true }),
    );
    const [resetRequest] = draftRequests("PUT");
    expect(readDraftRequestBody(resetRequest?.[1])).toMatchObject({
      operation: "RESET",
      edit: { patch: {} },
    });
    expect(draftRequests("GET")).toHaveLength(2);
  });
});
