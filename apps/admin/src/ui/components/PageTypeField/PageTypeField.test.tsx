import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { jsonFetcher } = vi.hoisted(() => ({ jsonFetcher: vi.fn() }));
vi.mock("@/lib/api", () => ({ jsonFetcher }));

import PageTypeField from "./PageTypeField";

beforeEach(() => {
  vi.resetAllMocks();
});

it("disables Homepage when another page owns it and explains the restriction", async () => {
  jsonFetcher.mockResolvedValue({ id: "existing-home" });
  render(
    <PageTypeField
      id="page-type"
      value="STANDARD"
      onChange={() => undefined}
    />,
  );

  const selector = screen.getByRole("combobox");
  const homepage = within(selector).getByRole("option", {
    name: "Homepage — default landing page",
  });

  await waitFor(() => expect(homepage).toBeDisabled());
  expect(
    screen.getByText(
      "A Homepage already exists. Only one page can use this type.",
    ),
  ).toBeVisible();
});

it("keeps Homepage selectable when editing the existing page", async () => {
  jsonFetcher.mockResolvedValue({ id: "existing-home" });
  render(
    <PageTypeField
      id="page-type"
      pageId="existing-home"
      value="HOME"
      onChange={() => undefined}
    />,
  );

  const selector = screen.getByRole("combobox");
  const homepage = within(selector).getByRole("option", {
    name: "Homepage — default landing page",
  });

  await waitFor(() => expect(homepage).toBeEnabled());
  expect(selector).toHaveValue("HOME");
});
