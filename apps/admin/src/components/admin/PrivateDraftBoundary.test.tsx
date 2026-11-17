import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  privatePageValues,
  privatePostValues,
} from "@/lib/content/private-draft.client";
import { privateDraftFixture } from "@/lib/content/private-draft.fixtures";

import { PrivateDraftBoundary } from "./PrivateDraftBoundary";

const { fetchMock, push } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
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

describe("server-admitted private editors", () => {
  it("uses current tag labels while retaining canonical relationship identities", () => {
    const draft = privateDraftFixture();
    draft.aggregate.snapshot.relationships.tagIds = ["tag"];
    draft.tagLabels = [
      { id: "tag", name: "Readable tag", slug: "readable-tag" },
    ];
    expect(privatePageValues(draft).tags).toEqual(draft.tagLabels);
    expect(privatePostValues(draft).tags).toEqual(draft.tagLabels);
  });
  it("uses legacy editing only after an explicit server gate refusal", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "PRIVATE_DRAFT_DISABLED" }), {
        status: 503,
      }),
    );
    render(
      <PrivateDraftBoundary id="page" kind="PAGE">
        <button>Legacy Save</button>
      </PrivateDraftBoundary>,
    );
    expect(screen.queryByText("Legacy Save")).not.toBeInTheDocument();
    expect(await screen.findByText("Legacy Save")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Private draft" }),
    ).not.toBeInTheDocument();
  });

  it("does not expose legacy Save after an uncertain admission or authorization failure", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 403 }));
    render(
      <PrivateDraftBoundary id="page" kind="PAGE">
        <button>Legacy Save</button>
      </PrivateDraftBoundary>,
    );
    expect(
      await screen.findByText(/Private editing could not be loaded/),
    ).toBeVisible();
    expect(screen.queryByText("Legacy Save")).not.toBeInTheDocument();
  });

  it.each(["PAGE", "POST"] as const)(
    "loads and explicitly saves %s only through private PUT, preserving public controls",
    async (kind) => {
      const initial = privateDraftFixture(kind, 2);
      fetchMock.mockImplementation(async (_path: string, init: RequestInit) => {
        const draft =
          init.method === "PUT" ? privateDraftFixture(kind, 3) : initial;

        return new Response(JSON.stringify(draft), { status: 200 });
      });
      render(
        <StrictMode>
          <PrivateDraftBoundary id="page" kind={kind}>
            <button>Legacy Save</button>
          </PrivateDraftBoundary>
        </StrictMode>,
      );
      expect(
        await screen.findByRole("region", { name: "Private draft" }),
      ).toHaveTextContent("Publishing is unavailable");
      expect(screen.getByLabelText("Status", { exact: true })).toBeDisabled();
      expect(
        screen.getByLabelText("Publish date", { exact: true }),
      ).toBeDisabled();
      fireEvent.change(screen.getByLabelText("Title", { exact: true }), {
        target: { value: "Private changed" },
      });
      await act(async () =>
        fireEvent.click(
          screen.getByRole("button", {
            name: "Save private draft",
          }),
        ),
      );
      const calls = fetchMock.mock.calls.filter(
        (call) => call[1]?.method === "PUT",
      );
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[0]).toBe("/api/private-drafts/page");
      expect(JSON.parse(calls[0]?.[1].body)).toMatchObject({
        expectedDraftVersion: 2,
        edit: { patch: { title: "Private changed" } },
      });
      expect(JSON.parse(calls[0]?.[1].body).edit.patch).not.toHaveProperty(
        "content",
      );
      expect(screen.queryByText("Legacy Save")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Title", { exact: true })).toHaveValue(
        "Private changed",
      );
    },
  );

  it("confirms local discard, cancels autosave, and warns on refresh before acknowledgment", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(privateDraftFixture("PAGE", 1)), {
        status: 200,
      }),
    );
    render(
      <PrivateDraftBoundary id="page" kind="PAGE">
        <button>Legacy Save</button>
      </PrivateDraftBoundary>,
    );
    await screen.findByRole("region", { name: "Private draft" });
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Title", { exact: true }), {
      target: { value: "Unsent" },
    });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Discard local changes",
      }),
    );
    expect(screen.getByLabelText("Title", { exact: true })).toHaveValue(
      "Unsent",
    );
    await act(async () =>
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Confirm",
        }),
      ),
    );
    expect(screen.getByLabelText("Title", { exact: true })).toHaveValue(
      "Original",
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(
      fetchMock.mock.calls.filter((call) => call[1]?.method === "PUT"),
    ).toHaveLength(0);
  });

  it("confirms persisted reset with retained history and remounts from the server snapshot", async () => {
    fetchMock.mockImplementation(
      async (_path: string, init: RequestInit) =>
        new Response(
          JSON.stringify(
            privateDraftFixture("POST", init.method === "PUT" ? 3 : 2),
          ),
          { status: 200 },
        ),
    );
    render(
      <PrivateDraftBoundary id="page" kind="POST">
        <button>Legacy Save</button>
      </PrivateDraftBoundary>,
    );
    await screen.findByRole("region", { name: "Private draft" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Reset private draft to live source",
      }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "immutable historical storage",
    );
    await act(async () =>
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Confirm",
        }),
      ),
    );
    const call = fetchMock.mock.calls.find((item) => item[1]?.method === "PUT");
    expect(JSON.parse(call?.[1].body)).toMatchObject({
      operation: "RESET",
      edit: { patch: {} },
    });
    expect(
      fetchMock.mock.calls.filter((item) => item[1]?.method === "GET"),
    ).toHaveLength(2);
  });
});
