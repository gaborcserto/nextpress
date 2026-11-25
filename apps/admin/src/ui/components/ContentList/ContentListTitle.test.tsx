import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ContentListTitle } from "./ContentListTitle";

class ResizeObserverMock {
  observe() {}

  disconnect() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it("shows the full title tooltip only when the title is truncated", () => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  render(
    <ContentListTitle
      id="page-1"
      href="/admin/pages/page-1"
      title="A long page title"
    />,
  );

  const title = screen.getByText("A long page title");
  const link = screen.getByRole("link", { name: "A long page title" });
  Object.defineProperties(title, {
    clientWidth: { configurable: true, value: 60 },
    scrollWidth: { configurable: true, value: 180 },
  });
  fireEvent(window, new Event("resize"));
  fireEvent.focus(link);

  expect(screen.getByRole("tooltip")).toHaveTextContent("A long page title");
});

it("does not show a tooltip when the title fits", () => {
  render(
    <ContentListTitle id="page-2" href="/admin/pages/page-2" title="Home" />,
  );

  fireEvent.focus(screen.getByRole("link", { name: "Home" }));

  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});
