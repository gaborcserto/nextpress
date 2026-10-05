import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataListEmptyRow, DataListLoading, DataListSurface } from "./DataList";

describe("data list presentation", () => {
  it("keeps a clear loading message inside the list surface", () => {
    render(<DataListLoading label="users" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading users…");
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
