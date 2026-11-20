import { act, fireEvent, render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ContentList from "./ContentList";

import type { ReactNode } from "react";

const auth = vi.hoisted(() => ({ role: "ADMIN" }));
vi.mock("@/lib/api", () => ({
  jsonFetcher: async () => ({
    user: { id: "user", name: "User", role: auth.role },
  }),
}));

const props = {
  heading: "Pages",
  createHref: "/admin/pages/new",
  createLabel: "Create Page",
  editHrefAction: (id: string) => `/admin/pages/${id}`,
  items: [
    {
      id: "page-1",
      title: "Home",
      slug: "home",
      status: "DRAFT" as const,
      publishedAt: null,
      publicationState: "DRAFT" as const,
    },
  ],
};

function renderList(children: ReactNode) {
  const cache = new Map();

  return render(
    <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>,
  );
}

describe("ContentList", () => {
  beforeEach(() => {
    auth.role = "ADMIN";
  });

  it.each(["ADMIN", "EDITOR"])("offers Delete to %s", async (role) => {
    auth.role = role;
    renderList(<ContentList {...props} onDeleteAction={vi.fn()} />);
    expect(
      await screen.findByRole("button", { name: "Delete Home" }),
    ).toBeVisible();
  });

  it.each(["AUTHOR", "SUBSCRIBER"])("hides Delete from %s", async (role) => {
    auth.role = role;
    renderList(<ContentList {...props} onDeleteAction={vi.fn()} />);
    await screen.findByRole("table", { name: "Pages" });
    expect(screen.queryByRole("button", { name: "Delete Home" })).toBeNull();
  });

  it("keeps pending and failed deletion in the dialog and allows retry", async () => {
    let reject: (error: Error) => void = () => undefined;
    const remove = vi.fn(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    );
    renderList(<ContentList {...props} onDeleteAction={remove} />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete Home" }));
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
    renderList(
      <ContentList {...props} items={[]} error="Unable to load pages." />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load pages.",
    );
    expect(screen.queryByText("No items found.")).not.toBeInTheDocument();
  });

  it("requires confirmation and disables deletion while another item is pending", async () => {
    const onDelete = vi.fn();
    const view = renderList(
      <ContentList {...props} onDeleteAction={onDelete} />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Delete Home" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Delete$/ }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith("page-1");
    view.rerender(
      <SWRConfig value={{ provider: () => new Map() }}>
        <ContentList {...props} onDeleteAction={onDelete} deletingId="page-2" />
      </SWRConfig>,
    );
    expect(screen.getByRole("button", { name: "Delete Home" })).toBeDisabled();
  });
});

it("shows a scheduled date separately from record dates and hides a retained draft publication date", () => {
  const createdAt = "2026-01-01T10:00:00.000Z";
  const updatedAt = "2026-02-01T10:00:00.000Z";
  const scheduledAt = "2099-03-01T10:00:00.000Z";
  const retainedDate = "2025-04-01T10:00:00.000Z";

  renderList(
    <ContentList
      {...props}
      items={[
        {
          ...props.items[0],
          id: "scheduled",
          title: "Upcoming",
          status: "PUBLISHED",
          publicationState: "SCHEDULED",
          publishedAt: scheduledAt,
          scheduledAt,
          createdAt,
          updatedAt,
        },
        { ...props.items[0], publishedAt: retainedDate },
        {
          ...props.items[0],
          id: "live",
          title: "Live",
          status: "PUBLISHED",
          publicationState: "PUBLISHED",
          publishedAt: retainedDate,
        },
      ]}
    />,
  );

  const upcomingRow = screen.getByRole("row", { name: /Upcoming/ });
  expect(upcomingRow).toHaveTextContent("Scheduled");
  expect(
    Array.from(upcomingRow.querySelectorAll("time"), (time) => time.dateTime),
  ).toEqual([scheduledAt, createdAt, updatedAt]);
  const draftRow = screen.getByRole("row", { name: /Home/ });
  expect(draftRow).toHaveTextContent("Draft");
  expect(draftRow.querySelector("time")).toBeNull();
  expect(
    screen.getByRole("row", { name: /Live/ }).querySelector("time"),
  ).toHaveAttribute("datetime", retainedDate);
});
