import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, it, expect, vi } from "vitest";

let LivePreview: typeof import("./LivePreview").default;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_PREVIEW_ORIGIN", "https://frontend.example.test");
  ({ default: LivePreview } = await import("./LivePreview"));
});

afterEach(() => vi.restoreAllMocks());

describe("Live Preview editing", () => {
  it("uses the acknowledged private snapshot without requesting legacy history", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ available: true }));

    try {
      render(
        <LivePreview
          id="draft"
          privateSnapshot={{
            title: "Acknowledged private title",
            slug: "draft",
            content: "",
            excerpt: null,
            layout: "GALLERY",
            pageDocument: null,
          }}
          values={{ title: "Unsaved title", slug: "draft", type: "GALLERY" }}
        />,
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Live Preview" }),
        ).toBeVisible(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Live Preview" }));
      const live = screen.getByRole("checkbox", {
        name: "Unsaved live updates",
      });

      expect(live).toBeEnabled();
      fireEvent.click(live);
      expect(live).not.toBeChecked();
      expect(fetch).toHaveBeenCalledWith("/api/frontend-availability", {
        cache: "no-store",
      });
      expect(fetch).not.toHaveBeenCalledWith(
        "/api/pages/draft/revisions",
        expect.anything(),
      );
    } finally {
      fetch.mockRestore();
    }
  });

  it("preserves unsaved fields across viewport and panel switches", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ available: true }),
    );
    render(
      <LivePreview>
        <input aria-label="Draft title" defaultValue="Original" />
      </LivePreview>,
    );
    const input = screen.getByLabelText("Draft title");
    fireEvent.change(input, { target: { value: "Unsaved" } });
    await screen.findByRole("button", { name: "Live Preview" });
    fireEvent.click(screen.getByRole("button", { name: "Live Preview" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Viewport" }), {
      target: { value: "375px" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show editing" }));
    fireEvent.click(screen.getByRole("button", { name: "Show preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Live Preview" }));
    expect(input).toHaveValue("Unsaved");
  });

  it("enters fullscreen preview and restores the workspace on Escape", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ available: true }),
    );
    render(<LivePreview />);

    await screen.findByRole("button", { name: "Live Preview" });
    fireEvent.click(screen.getByRole("button", { name: "Live Preview" }));
    const fullscreen = screen.getByRole("button", {
      name: "Fullscreen preview",
    });
    fireEvent.click(fullscreen);

    expect(screen.getByRole("dialog", { name: "Live Preview" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Exit fullscreen" }),
    ).toBeVisible();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Live Preview" })).toBeNull();
    expect(fullscreen).toHaveFocus();
  });

  it("closes an active preview when the frontend becomes unreachable", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ available: true }))
      .mockRejectedValueOnce(new TypeError("Network unavailable"))
      .mockResolvedValueOnce(Response.json({ available: true }));

    try {
      render(<LivePreview />);
      await act(async () => Promise.resolve());
      fireEvent.click(screen.getByRole("button", { name: "Live Preview" }));
      expect(
        screen.getByRole("region", { name: "Live Preview" }),
      ).toBeVisible();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      expect(screen.queryByRole("region", { name: "Live Preview" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Live Preview" })).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      expect(
        screen.getByRole("button", { name: "Live Preview" }),
      ).toBeVisible();
      expect(fetch).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
