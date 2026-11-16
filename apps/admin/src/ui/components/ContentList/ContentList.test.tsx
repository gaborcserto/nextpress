import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ContentList from "./ContentList";

const props = {
  heading: "Pages",
  createHref: "/admin/pages/new",
  createLabel: "Create Page",
  editHrefAction: (id: string) => `/admin/pages/${id}`,
  items: [
    { id: "page-1", title: "Home", slug: "home", status: "DRAFT" as const },
  ],
};

describe("ContentList", () => {
  it("keeps pending and failed deletion in the dialog and allows retry", async () => {
    let reject: (error: Error) => void = () => undefined;
    const remove = vi.fn(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    );
    render(<ContentList {...props} onDeleteAction={remove} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Home" }));
    fireEvent.click(screen.getByRole("button", { name: /Delete$/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete$/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Delete$/ }));
    expect(remove).toHaveBeenCalledExactlyOnceWith("page-1");
    await act(async () => {
      reject(new Error("Unable to delete page."));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to delete page.",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    remove.mockResolvedValue(undefined);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Delete$/ }));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows load failures instead of an empty state", () => {
    render(<ContentList {...props} items={[]} error="Unable to load pages." />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load pages.",
    );
    expect(screen.queryByText("No items found.")).not.toBeInTheDocument();
  });

  it("requires confirmation and disables deletion while another item is pending", () => {
    const onDelete = vi.fn();
    const view = render(<ContentList {...props} onDeleteAction={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Home" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Delete$/ }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith("page-1");
    view.rerender(
      <ContentList {...props} onDeleteAction={onDelete} deletingId="page-2" />,
    );
    expect(screen.getByRole("button", { name: "Delete Home" })).toBeDisabled();
  });
});
