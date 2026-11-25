import { render, screen, within } from "@testing-library/react";
import { FaBeer } from "react-icons/fa";
import { expect, it } from "vitest";

import { EmptyState } from "./EmptyState";

it("announces the empty result and renders an optional action", () => {
  render(
    <EmptyState
      icon={FaBeer}
      heading="No menu items yet"
      description="Add pages, custom links or groups to build your navigation."
      action={<button type="button">Add item</button>}
    />,
  );

  const status = screen.getByRole("status");
  expect(status).toHaveAttribute("data-empty-state", "panel");
  expect(
    within(status).getByRole("heading", { name: "No menu items yet" }),
  ).toBeVisible();
  expect(status).toHaveTextContent(
    "Add pages, custom links or groups to build your navigation.",
  );
  expect(
    within(status).getByRole("button", { name: "Add item" }),
  ).toBeVisible();
  expect(status.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});

it("renders the plain variant without the panel decoration", () => {
  render(
    <EmptyState
      variant="plain"
      icon={FaBeer}
      heading="No items yet"
      description="Add an item to get started."
    />,
  );

  const status = screen.getByRole("status");
  expect(status).toHaveAttribute("data-empty-state", "plain");
  expect(status).not.toHaveClass("border-dashed");
  expect(status).not.toHaveClass("bg-(--surface-rail)");
  expect(
    within(status).getByRole("heading", { name: "No items yet" }),
  ).toBeVisible();
});
