import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { PrivateDraftStatus } from "./PrivateDraftStatus";

import type { PrivateDraftControls } from "./usePrivateDraft";

it("expires the schedule control and refuses confirmation after the selected time", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T12:00:59.000Z"));
  const publication = vi.fn<PrivateDraftControls["publication"]>();
  const draft: PrivateDraftControls = {
    phase: "saved",
    dirty: false,
    pending: false,
    message: "",
    version: 1,
    savedAt: null,
    contentKey: 0,
    recovering: false,
    recover: vi.fn(),
    savedPreview: {
      title: "Test",
      slug: "test",
      content: "",
      excerpt: null,
      pageDocument: null,
      listingTagSlug: null,
      layout: "STANDARD",
    },
    publicState: { status: "DRAFT", publishedAt: null },
    pendingPrivateChanges: true,
    history: [],
    legacyHistory: [],
    release: undefined,
    publication,
    save: vi.fn(),
    discardLocal: vi.fn(),
    reset: vi.fn(),
    restore: vi.fn(),
    restoreLegacy: vi.fn(),
    reload: vi.fn(),
  };
  const { unmount } = render(<PrivateDraftStatus draft={draft} />);

  try {
    fireEvent.click(screen.getByText("Schedule publication", { exact: true }));
    const schedule = screen.getByRole("button", {
      name: "Schedule",
    });
    const dateTime = screen.getByLabelText("Publish date and Publish time");
    fireEvent.change(dateTime, { target: { value: "11/18/2026 12:01" } });
    fireEvent.blur(dateTime);
    expect(schedule).toBeEnabled();
    fireEvent.click(schedule);
    act(() => vi.advanceTimersByTime(1_000));
    expect(schedule).toBeDisabled();

    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Confirm" })),
    );
    expect(publication).not.toHaveBeenCalled();
    expect(
      screen.getByText("Choose a publication time in the future."),
    ).toBeVisible();
  } finally {
    unmount();
    vi.useRealTimers();
  }
});
