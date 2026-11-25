import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DataListEmptyRow,
  DataListLoading,
  DataListScrollableResults,
  DataListSurface,
} from "./DataList";

describe("data list presentation", () => {
  it("keeps a clear loading message inside the list surface", () => {
    render(<DataListLoading label="users" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading users…");
  });

  it("keeps the toolbar outside the scrolling results", () => {
    render(
      <DataListSurface label="Users">
        <form role="search">
          <input aria-label="Search users" />
        </form>
        <DataListScrollableResults>
          <table aria-label="Accounts" />
        </DataListScrollableResults>
      </DataListSurface>,
    );

    const surface = screen.getByRole("region", { name: "Users" });
    const toolbar = screen.getByRole("search");
    const results = screen.getByRole("table", {
      name: "Accounts",
    }).parentElement;
    expect(results).toHaveClass("overflow-x-auto");
    expect(results).not.toContainElement(toolbar);
    expect(surface).not.toHaveClass("overflow-x-auto");
    expect(surface).toContainElement(toolbar);
  });

  it("renders an empty message as a table row spanning its columns", () => {
    render(
      <DataListSurface>
        <table>
          <tbody>
            <DataListEmptyRow colSpan={3}>No users found.</DataListEmptyRow>
          </tbody>
        </table>
      </DataListSurface>,
    );

    expect(screen.getByText("No users found.")).toBeInTheDocument();
    expect(screen.getByRole("cell")).toHaveAttribute("colspan", "3");
  });
});
