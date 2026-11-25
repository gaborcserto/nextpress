import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MediaUploads } from "./MediaUploads";

const { jsonFetcher } = vi.hoisted(() => ({ jsonFetcher: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  jsonFetcher,
}));
const pdf = new File(["%PDF"], "report.pdf", { type: "application/pdf" });
const asset = {
  id: "report",
  url: "/media/report",
  alt: null,
  mime: pdf.type,
  width: null,
  height: null,
  filename: pdf.name,
  originalMime: pdf.type,
  size: pdf.size,
  caption: null,
  description: null,
  createdAt: "2026-11-24T12:00:00.000Z",
  updatedAt: null,
};

beforeEach(() => {
  jsonFetcher.mockReset();
});

describe("MediaUploads", () => {
  it("rejects multiple files in single-file mode before uploading", () => {
    const { container } = render(
      <MediaUploads multiple={false} documents onUploaded={vi.fn()} />,
    );
    const input = container.querySelector("input");
    const dropZone = container.querySelector("section");

    expect(input).not.toHaveAttribute("multiple");
    expect(dropZone).toHaveClass(
      "w-full",
      "border-dashed",
      "bg-(--surface-rail)",
    );
    const browseButton = screen.getByRole("button", { name: "Browse file" });
    const browseAction = browseButton.querySelector("span");
    expect(browseButton).toBeEnabled();
    expect(browseButton).toHaveClass(
      "inline-flex",
      "group",
      "focus-visible:outline-(--focus-color)",
    );
    expect(browseButton).not.toHaveClass("hover:underline");
    expect(browseAction).toHaveClass(
      "inline-flex",
      "items-center",
      "gap-2",
      "border-b",
      "border-transparent",
      "group-hover:border-current",
      "group-focus-visible:border-current",
    );
    expect(browseAction?.firstElementChild).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    fireEvent.drop(container.firstElementChild ?? container, {
      dataTransfer: { files: [pdf, pdf] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Choose one file.");
    expect(jsonFetcher).not.toHaveBeenCalled();
  });

  it("uses the document endpoint for a PDF in mixed mode and retries a transport failure", async () => {
    const onUploaded = vi.fn();
    jsonFetcher
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce(asset);
    const { container } = render(<MediaUploads all onUploaded={onUploaded} />);

    expect(container.querySelector("input")).toHaveAttribute("multiple");
    fireEvent.drop(container.firstElementChild ?? container, {
      dataTransfer: { files: [pdf] },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith([asset], true));
    expect(jsonFetcher).toHaveBeenLastCalledWith(
      "/api/documents?filename=report.pdf",
      expect.objectContaining({ method: "POST", body: pdf }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove from upload list report.pdf",
      }),
    );

    expect(screen.queryByText("report.pdf")).not.toBeInTheDocument();
    expect(jsonFetcher).toHaveBeenCalledTimes(2);
  });
});
