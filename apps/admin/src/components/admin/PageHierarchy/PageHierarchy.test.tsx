import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { PageHierarchy } from "./PageHierarchy";

const fetchMock = vi.fn<typeof fetch>();

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function openHierarchy(id?: string) {
  vi.stubGlobal("fetch", fetchMock);
  render(<PageHierarchy id={id} />);
  const summary = screen.getByText(/^(Page hierarchy|Oldalhierarchia)$/);
  const details = summary.closest("details");

  if (!details) {
    throw new Error("Hierarchy disclosure is missing");
  }

  details.open = true;
  fireEvent(details, new Event("toggle"));

  return summary;
}

it("recovers from a failed hierarchy read without offering an empty result", async () => {
  fetchMock
    .mockResolvedValueOnce(
      Response.json({ error: "upstream" }, { status: 503 }),
    )
    .mockResolvedValueOnce(Response.json([]));

  const summary = openHierarchy();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Loading Page hierarchy",
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to load Page hierarchy.",
  );
  expect(screen.queryByText("No Pages found.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));

  expect(summary).toHaveFocus();
  expect(await screen.findByText("No Pages found.")).toBeVisible();
});

it("announces denied access in Hungarian", async () => {
  vi.stubGlobal("navigator", { language: "hu-HU" });
  fetchMock.mockResolvedValue(Response.json({}, { status: 403 }));
  openHierarchy();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Nincs jogosultsága az oldalhierarchia megtekintéséhez.",
  );
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});

it("keeps the existing parent selected and excludes the current Page and its descendants", async () => {
  fetchMock.mockResolvedValue(
    Response.json([
      {
        id: "root",
        slug: "root",
        title: "Root",
        layout: "STANDARD",
        parentId: null,
        siblingOrder: 0,
      },
      {
        id: "current",
        slug: "current",
        title: "Current",
        layout: "STANDARD",
        parentId: "root",
        siblingOrder: 0,
      },
      {
        id: "child",
        slug: "child",
        title: "Child",
        layout: "STANDARD",
        parentId: "current",
        siblingOrder: 0,
      },
    ]),
  );
  openHierarchy("current");

  const select = await screen.findByRole("combobox", { name: "Parent Page" });
  expect(select).toHaveValue("root");
  expect(
    screen.getAllByRole("option").map((option) => option.textContent),
  ).toEqual(["Top level", "Root"]);
});
