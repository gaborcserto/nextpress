import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  privatePageValues,
  privatePostValues,
} from "@/lib/content/private-draft.client";
import { privateDraftFixture } from "@/lib/content/private-draft.fixtures";

import { PrivateDraftBoundary } from "./PrivateDraftBoundary";

type DraftKind = ReturnType<typeof privateDraftFixture>["aggregate"]["kind"];
type DraftResponses = {
  get: () => Response;
  put?: () => Response;
};

const draftEndpoint = "/api/private-drafts/page";
const unexpectedRequests: string[] = [];
const { fetchMock, jsonFetcher, push } = vi.hoisted(() => ({
  fetchMock: vi.fn<typeof import("@/lib/api").apiFetch>(),
  jsonFetcher: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiFetch: fetchMock, jsonFetcher }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/ui/components/SlateEditor", () => ({
  SlateEditor: () => null,
  EMPTY_SLATE_VALUE: [{ type: "paragraph", children: [{ text: "" }] }],
}));
vi.mock("@/ui/components/TagsField", () => ({ TagsField: () => null }));

beforeEach(() => {
  fetchMock.mockReset();
  jsonFetcher.mockResolvedValue({ id: null });
  push.mockReset();
  unexpectedRequests.length = 0;
});

afterEach(() => {
  try {
    cleanup();
  } finally {
    vi.useRealTimers();
  }

  // Admission and save catch transport errors, so also surface them in teardown.
  expect(unexpectedRequests, "Unexpected private draft API requests").toEqual(
    [],
  );
});

function requestMethod(init?: RequestInit) {
  return (init?.method ?? "GET").toUpperCase();
}

function mockDraftRequests({ get, put }: DraftResponses) {
  fetchMock.mockImplementation(async (path, init) => {
    const method = requestMethod(init);

    if (path === draftEndpoint && method === "GET") {
      return get();
    }

    if (path === draftEndpoint && method === "PUT" && put) {
      return put();
    }

    const request = `${method} ${path}`;
    unexpectedRequests.push(request);
    throw new Error(`Unexpected private draft API request: ${request}`);
  });
}

function renderDraftBoundary(kind: DraftKind, wrapper?: typeof StrictMode) {
  render(
    <PrivateDraftBoundary id="page" kind={kind}>
      <button>Legacy Save</button>
    </PrivateDraftBoundary>,
    { wrapper },
  );
}

function openPrivateEditor(kind: DraftKind) {
  mockDraftRequests({
    get: () => Response.json(privateDraftFixture(kind, 2)),
  });
  renderDraftBoundary(kind);

  return screen.findByRole("region", { name: "Private draft" });
}

function draftRequests(method: "GET" | "PUT") {
  return fetchMock.mock.calls.filter(
    ([, init]) => requestMethod(init) === method,
  );
}

function readSingleDraftPutBody(): unknown {
  const requests = draftRequests("PUT");
  expect(requests).toHaveLength(1);
  const [path, init] = requests[0] ?? [];
  expect(path).toBe(draftEndpoint);

  if (typeof init?.body !== "string") {
    throw new Error("Expected a JSON body for the private draft request");
  }

  return JSON.parse(init.body);
}

function openDraftRecoveryDialog(action: string, title: string) {
  fireEvent.click(
    screen.getByText("Draft recovery and history", { exact: true }),
  );
  fireEvent.click(screen.getByRole("button", { name: action }));

  return screen.getByRole("dialog", { name: title });
}

function beforeUnloadIsPrevented() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);

  return event.defaultPrevented;
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
    mockDraftRequests({
      get: () =>
        Response.json({ code: "PRIVATE_DRAFT_DISABLED" }, { status: 503 }),
    });

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
    mockDraftRequests({ get: () => Response.json({}, { status: 403 }) });
    renderDraftBoundary("PAGE");

    expect(
      await screen.findByText(/Private editing could not be loaded/),
    ).toBeVisible();
    expect(screen.queryByText("Legacy Save")).not.toBeInTheDocument();
  });
});

describe.each<DraftKind>(["PAGE", "POST"])("%s private editor", (kind) => {
  it("offers the saved recovery revision before mounting editable content", async () => {
    const draft = privateDraftFixture(kind, 2);
    draft.pendingPrivateChanges = true;
    draft.aggregate.savedAt = "2026-11-20T10:00:00Z";
    draft.aggregate.snapshot.fields.title = "Recovered title";
    mockDraftRequests({ get: () => Response.json(draft) });

    renderDraftBoundary(kind);
    const recovery = await screen.findByRole("region", {
      name: "Recover private draft",
    });

    expect(within(recovery).getByText(/Private revision 2/)).toBeVisible();
    expect(recovery.querySelector("time")).toHaveAttribute(
      "datetime",
      draft.aggregate.savedAt,
    );
    expect(
      screen.queryByRole("textbox", { name: "Title" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(recovery).getByRole("button", { name: "Recover private draft" }),
    );

    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
      "Recovered title",
    );
    expect(draftRequests("PUT")).toHaveLength(0);
  });

  it("renders the admitted draft with accessible publication guidance", async () => {
    const draftRegion = await openPrivateEditor(kind);

    expect(draftRegion).toBeVisible();
    expect(draftRegion).toHaveTextContent(
      "require an explicit publication command",
    );
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
      "Original",
    );
    expect(
      screen.getByRole("button", { name: "Save private draft" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Legacy Save" }),
    ).not.toBeInTheDocument();
  });

  it("requires separate confirmation to publish a saved draft", async () => {
    const publication = within(await openPrivateEditor(kind));
    const publish = publication.getByRole("button", {
      name: "Publish Changes",
    });

    expect(publish).toBeEnabled();
    expect(
      publication.getByRole("button", { name: "Unpublish" }),
    ).toBeEnabled();

    fireEvent.click(publish);

    expect(
      screen.getByRole("dialog", {
        name: "Publish accepted private revision?",
      }),
    ).toBeVisible();
    expect(draftRequests("PUT")).toHaveLength(0);
  });

  it("disables the legacy Status and Publish date fields", async () => {
    await openPrivateEditor(kind);

    expect(screen.getByLabelText("Status", { exact: true })).toBeDisabled();
    expect(
      screen
        .getAllByLabelText("Publish date", { exact: true })
        .find((field) => field.id !== "private-schedule-date"),
    ).toBeDisabled();
  });

  it("sends one private title update and displays the acknowledged revision", async () => {
    const editedTitle = "Private changed";
    const savedDraft = privateDraftFixture(kind, 3);
    savedDraft.aggregate.snapshot.fields.title = editedTitle;
    mockDraftRequests({
      get: () => Response.json(privateDraftFixture(kind, 2)),
      put: () => Response.json(savedDraft),
    });
    renderDraftBoundary(kind, StrictMode);
    const title = await screen.findByRole("textbox", { name: "Title" });

    const save = screen.getByRole("button", { name: "Save private draft" });
    fireEvent.change(title, { target: { value: editedTitle } });
    expect(draftRequests("PUT")).toHaveLength(0);
    fireEvent.click(save);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /^Private draft saved · revision 3$/,
      );
    });
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
      editedTitle,
    );
    expect(
      screen.queryByRole("button", { name: "Legacy Save" }),
    ).not.toBeInTheDocument();

    const body = readSingleDraftPutBody();
    expect(body).toMatchObject({
      expectedDraftVersion: 2,
      edit: { patch: { title: editedTitle } },
    });
    expect(body).not.toHaveProperty("edit.patch.content");
    expect(body).not.toHaveProperty("operation");
  });
});

describe("private draft recovery", () => {
  it("warns about unsaved edits until confirmed discard cancels autosave", async () => {
    await openPrivateEditor("PAGE");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const title = screen.getByRole("textbox", { name: "Title" });

    fireEvent.change(title, { target: { value: "Unsent" } });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Unsaved private changes",
    );
    expect(beforeUnloadIsPrevented()).toBe(true);

    const dialog = openDraftRecoveryDialog(
      "Discard local changes",
      "Discard local changes?",
    );
    expect(title).toHaveValue("Unsent");

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
      "Original",
    );
    expect(beforeUnloadIsPrevented()).toBe(false);

    act(() => vi.advanceTimersByTime(1_000));
    expect(draftRequests("PUT")).toHaveLength(0);
  });

  it("warns that history is retained and reloads the server snapshot after reset", async () => {
    const reloadedDraft = privateDraftFixture("POST", 3);
    reloadedDraft.aggregate.snapshot.fields.title = "Live title";
    const getDraft = vi.fn(() => Response.json(reloadedDraft));
    getDraft.mockImplementationOnce(() =>
      Response.json(privateDraftFixture("POST", 2)),
    );
    mockDraftRequests({
      get: getDraft,
      put: () => Response.json(privateDraftFixture("POST", 3)),
    });

    renderDraftBoundary("POST");
    await screen.findByRole("region", { name: "Private draft" });

    const resetDialog = openDraftRecoveryDialog(
      "Reset private draft to live source",
      "Reset persisted private draft?",
    );
    expect(resetDialog).toHaveTextContent("immutable historical storage");

    fireEvent.click(
      within(resetDialog).getByRole("button", { name: "Confirm" }),
    );

    expect(await screen.findByDisplayValue("Live title")).toBe(
      screen.getByRole("textbox", { name: "Title" }),
    );
    expect(fetchMock.mock.calls.map(([, init]) => requestMethod(init))).toEqual(
      ["GET", "PUT", "GET"],
    );
    expect(readSingleDraftPutBody()).toMatchObject({
      operation: "RESET",
      edit: { patch: {} },
    });
  });
});
