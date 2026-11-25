import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SlateEditor from "./SlateEditor";

vi.mock("@/components/admin/Media/MediaPicker", () => ({
  MediaPicker: ({ onCancel }: { onCancel: () => void }) => (
    <div role="dialog" aria-label="Media Library">
      <button type="button" onClick={onCancel}>
        Cancel picker
      </button>
    </div>
  ),
}));

describe("SlateEditor", () => {
  it("provides the unified file action through the shared toolbar", () => {
    render(
      <SlateEditor
        value={[{ type: "paragraph", children: [{ text: "Content" }] }]}
        onChangeAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Insert file" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Add link" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove link" })).toBeDisabled();
  });

  it("opens and cancels the picker when the editor has no active selection", () => {
    render(
      <SlateEditor
        value={[{ type: "paragraph", children: [{ text: "Content" }] }]}
        onChangeAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Insert file" }));
    expect(screen.getByRole("dialog", { name: "Media Library" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cancel picker" }));
    expect(screen.queryByRole("dialog", { name: "Media Library" })).toBeNull();
  });

  it("uses the shared link controls and renders linked content as an anchor", () => {
    render(
      <SlateEditor
        value={[
          {
            type: "paragraph",
            children: [{ text: "Report", href: "/media/report-id" }],
          },
        ]}
        onChangeAction={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Add link" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove link" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Report" })).toHaveAttribute(
      "href",
      "/media/report-id",
    );
  });

  it("prevents editing while the parent form is submitting", () => {
    render(
      <SlateEditor
        readOnly
        value={[{ type: "paragraph", children: [{ text: "Original" }] }]}
        onChangeAction={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Content")).toHaveAttribute(
      "contenteditable",
      "false",
    );
  });
  it("activates code view through the button click and preserves invalid drafts", async () => {
    const onChange = vi.fn();
    render(
      <SlateEditor
        value={[{ type: "paragraph", children: [{ text: "Original" }] }]}
        onChangeAction={onChange}
      />,
    );
    expect(
      screen.getByRole("textbox", { name: "Content" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "JSON code view" }));
    const code = screen.getByRole("textbox", { name: "Slate JSON" });
    fireEvent.change(code, { target: { value: "[" } });
    expect(code).toHaveValue("[");
    expect(code).toBeInvalid();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter valid Slate JSON.",
    );
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(code, { target: { value: "[]" } });
    expect(screen.getByRole("alert")).toHaveTextContent("non-empty array");
    const updated = [{ type: "paragraph", children: [{ text: "Updated" }] }];
    fireEvent.change(code, { target: { value: JSON.stringify(updated) } });
    expect(code).not.toBeInvalid();
    expect(onChange).toHaveBeenCalledWith(updated);
    fireEvent.click(screen.getByRole("button", { name: "Back to editor" }));
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Content" }),
      ).toHaveTextContent("Updated"),
    );
  });
});
