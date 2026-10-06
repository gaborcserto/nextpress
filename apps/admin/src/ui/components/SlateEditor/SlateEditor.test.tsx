import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SlateEditor from "./SlateEditor";

describe("SlateEditor", () => {
  it("prevents editing while the parent form is submitting", () => {
    render(<SlateEditor readOnly value={[{ type: "paragraph", children: [{ text: "Original" }] }]} onChangeAction={vi.fn()} />);
    expect(screen.getByLabelText("Content")).toHaveAttribute("contenteditable", "false");
  });
  it("activates code view through the button click and preserves invalid drafts", async () => {
    const onChange = vi.fn();
    render(<SlateEditor value={[{ type: "paragraph", children: [{ text: "Original" }] }]} onChangeAction={onChange} />);
    expect(screen.getByRole("textbox", { name: "Content" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "JSON code view" }));
    const code = screen.getByRole("textbox", { name: "Slate JSON" });
    fireEvent.change(code, { target: { value: "[" } });
    expect(code).toHaveValue("[");
    expect(code).toBeInvalid();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter valid Slate JSON.");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(code, { target: { value: "[]" } });
    expect(screen.getByRole("alert")).toHaveTextContent("non-empty array");
    const updated = [{ type: "paragraph", children: [{ text: "Updated" }] }];
    fireEvent.change(code, { target: { value: JSON.stringify(updated) } });
    expect(code).not.toBeInvalid();
    expect(onChange).toHaveBeenCalledWith(updated);
    fireEvent.click(screen.getByRole("button", { name: "Back to editor" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Content" })).toHaveTextContent("Updated"));
  });
});
