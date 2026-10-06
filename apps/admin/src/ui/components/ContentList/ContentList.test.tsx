import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ContentList from "./ContentList";

const props = {
  heading: "Pages",
  createHref: "/admin/pages/new",
  createLabel: "Create Page",
  editHrefAction: (id: string) => `/admin/pages/${id}`,
  items: [{ id: "page-1", title: "Home", slug: "home", status: "DRAFT" as const }],
};

describe("ContentList", () => {
  it("shows load failures instead of an empty state", () => {
    render(<ContentList {...props} items={[]} error="Unable to load pages." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load pages.");
    expect(screen.queryByText("No items found.")).not.toBeInTheDocument();
  });

  it("requires confirmation and disables deletion while another item is pending", () => {
    const onDelete = vi.fn();
    const view = render(<ContentList {...props} onDeleteAction={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Home" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith("page-1");
    view.rerender(<ContentList {...props} onDeleteAction={onDelete} deletingId="page-2" />);
    expect(screen.getByRole("button", { name: "Delete Home" })).toBeDisabled();
  });
});
