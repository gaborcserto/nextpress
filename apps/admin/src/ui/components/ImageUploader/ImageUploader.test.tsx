import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ImageUploader from "./ImageUploader";

describe("ImageUploader", () => {
  it("disables selection when the owning feature has no upload implementation", () => {
    const onChange = vi.fn();

    render(<ImageUploader value={null} onChangeAction={onChange} />);

    expect(screen.getByText("Image uploads are not configured")).toBeInTheDocument();
    expect(screen.getByLabelText("Upload image")).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not render a persisted protocol-relative image as an external request", () => {
    render(<ImageUploader value={{ id: "media-1", url: "//evil.example/image", alt: "Unsafe preview" }} onChangeAction={vi.fn()} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders legitimate persisted HTTPS media", () => {
    render(<ImageUploader value={{ id: "media-1", url: "https://media.example/photo.png", alt: "Preview" }} onChangeAction={vi.fn()} />);
    expect(screen.getByRole("img", { name: "Preview" })).toHaveAttribute("src", "https://media.example/photo.png");
  });
});
