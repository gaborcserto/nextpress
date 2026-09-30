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
});
