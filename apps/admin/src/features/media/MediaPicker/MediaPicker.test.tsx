import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MediaPicker } from "./MediaPicker";

const asset = {
  id: "uploaded-image",
  url: "/media/uploaded-image",
  alt: null,
  mime: "image/png",
  width: 1,
  height: 1,
  filename: "cover.png",
  originalMime: "image/png",
  size: 128,
  caption: null,
  description: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: null,
};

vi.mock("../MediaDialog", () => ({
  MediaDialog: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
}));
vi.mock("../MediaBrowser/MediaBrowser", () => ({
  initialMediaQuery: {},
  MediaBrowser: ({
    onAsset,
    all,
  }: {
    onAsset: (value: typeof asset) => void;
    all?: boolean;
  }) => (
    <button type="button" data-mixed={all} onClick={() => onAsset(asset)}>
      Existing image
    </button>
  ),
}));
vi.mock("../MediaUploads/MediaUploads", () => ({
  MediaUploads: ({
    onUploaded,
  }: {
    onUploaded: (assets: (typeof asset)[], complete: boolean) => void;
  }) => (
    <>
      <button type="button" onClick={() => onUploaded([asset], true)}>
        Upload image
      </button>
      <button type="button" onClick={() => onUploaded([asset], false)}>
        Finish partial upload
      </button>
    </>
  ),
}));

describe("MediaPicker", () => {
  it("keeps library selection across views and selects a newly uploaded image", () => {
    const onConfirm = vi.fn();
    render(<MediaPicker onCancel={vi.fn()} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Existing image" }));
    expect(screen.getByRole("status")).toHaveTextContent("Selected 1 / 1");
    fireEvent.click(screen.getByRole("tab", { name: "Upload images" }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button", { name: "Use selection" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Upload image" }));

    expect(screen.getByRole("tab", { name: "Media Library" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("button", { name: "Use selection" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Use selection" }));
    expect(onConfirm).toHaveBeenCalledWith([asset]);
  });

  it("keeps the upload tab open after a partial batch and cancellation does not confirm", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<MediaPicker onCancel={onCancel} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("tab", { name: "Upload images" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Finish partial upload" }),
    );

    expect(screen.getByRole("tab", { name: "Upload images" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Use selection" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("enables mixed asset browsing only when explicitly configured", () => {
    const { rerender } = render(
      <MediaPicker mode="mixed" onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(
      screen.getByRole("button", { name: "Existing image" }),
    ).toHaveAttribute("data-mixed", "true");

    rerender(<MediaPicker onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Existing image" }),
    ).toHaveAttribute("data-mixed", "false");
  });
});
