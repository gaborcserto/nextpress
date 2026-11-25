import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { CoverMediaField } from "./EditorMediaFields";

import type { EditorImage } from "@nextpress/shared/media";

vi.mock("./MediaBrowser", () => ({ MediaThumbnail: () => null }));
vi.mock("./MediaUploads", () => ({
  MediaUploads: () => <div>Upload dropzone</div>,
}));
vi.mock("./MediaPicker", () => ({
  MediaPicker: ({
    onConfirm,
  }: {
    onConfirm: (assets: EditorImage[]) => void;
  }) => (
    <div role="dialog">
      <button
        type="button"
        onClick={() =>
          onConfirm([{ id: "picked-image", url: "/media/picked-image" }])
        }
      >
        Choose image
      </button>
    </div>
  ),
}));

it("opens the shared picker from a centered ghost button and selects an image", () => {
  const onChange = vi.fn();
  render(<CoverMediaField value={null} onChange={onChange} />);

  const selectButton = screen.getByRole("button", {
    name: "Select from Media Library",
  });

  expect(selectButton).toHaveClass("btn-ghost");
  expect(selectButton.querySelector("svg")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  expect(selectButton.parentElement).toHaveClass("items-center");
  expect(selectButton.parentElement?.parentElement).toHaveClass("space-y-2");

  fireEvent.click(selectButton);
  fireEvent.click(screen.getByRole("button", { name: "Choose image" }));

  expect(onChange).toHaveBeenCalledWith({
    id: "picked-image",
    url: "/media/picked-image",
  });
});
