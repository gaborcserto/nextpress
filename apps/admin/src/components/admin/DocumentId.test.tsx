import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DocumentId from "./DocumentId";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DocumentId", () => {
  it("copies the full document ID from its labeled control", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<DocumentId id="document-record-123456789" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy document ID" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("document-record-123456789"),
    );
  });
});
