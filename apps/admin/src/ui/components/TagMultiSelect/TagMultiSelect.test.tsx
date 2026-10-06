import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TagMultiSelect } from "./TagMultiSelect";

describe("TagMultiSelect", () => {
  it("reports search failures instead of offering creation from incomplete results", async () => {
    const createTag = vi.fn();
    render(<TagMultiSelect value={[]} onChangeAction={vi.fn()} loadOptionsAction={async () => { throw new Error("offline"); }} createTagAction={createTag} />);
    const input = screen.getByRole("textbox", { name: "Tag selector" });
    fireEvent.change(input, { target: { value: "news" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to search tags.");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(createTag).not.toHaveBeenCalled();
  });
  it("selects a search result through native button activation", async () => {
    const tag = { id: "tag-1", name: "News", slug: "news" };
    const onChange = vi.fn();
    render(<TagMultiSelect value={[]} onChangeAction={onChange} loadOptionsAction={async () => [tag]} createTagAction={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Tag selector" }), { target: { value: "ne" } });
    const option = await screen.findByRole("button", { name: "News" });
    await waitFor(() => expect(option).not.toBeDisabled());
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledExactlyOnceWith([tag]);
  });

  it("prevents duplicate creation and reports failure", async () => {
    let rejectRequest: (error: Error) => void = () => undefined;
    const createTag = vi.fn().mockReturnValue(new Promise((_, reject) => { rejectRequest = reject; }));
    render(<TagMultiSelect value={[]} onChangeAction={vi.fn()} loadOptionsAction={async () => []} createTagAction={createTag} />);
    const input = screen.getByRole("textbox", { name: "Tag selector" });
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(createTag).toHaveBeenCalledExactlyOnceWith("x");
    expect(input).toBeDisabled();
    rejectRequest(new Error("offline"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to create tag.");
    expect(input).not.toBeDisabled();
  });
});
