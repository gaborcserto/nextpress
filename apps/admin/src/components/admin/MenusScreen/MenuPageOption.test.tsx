import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MenuPageOption } from "./MenuPageOption";

const pageTitle =
  "A very long page title that should remain on one line and show its full text in a tooltip";

class ResizeObserverMock implements ResizeObserver {
  static latest: ResizeObserverMock | null = null;

  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: readonly number[] = [];
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.latest = this;
  }

  observe(_target: Element, _options?: ResizeObserverOptions) {}

  unobserve(_target: Element) {}

  disconnect() {}

  trigger() {
    this.callback([], this);
  }
}

function setTitleDimensions(
  title: HTMLElement,
  clientWidth: number,
  scrollWidth: number,
) {
  Object.defineProperties(title, {
    clientWidth: { configurable: true, value: clientWidth },
    scrollWidth: { configurable: true, value: scrollWidth },
  });

  act(() => {
    ResizeObserverMock.latest?.trigger();
  });
}

function renderPageOption(titleText: string) {
  render(
    <div className="max-h-20 overflow-auto">
      <MenuPageOption
        id="page-1"
        title={titleText}
        checked={false}
        onCheckedChange={vi.fn()}
      />
    </div>,
  );

  return {
    checkbox: screen.getByRole("checkbox", { name: titleText }),
    title: screen.getByText(titleText),
  };
}

describe("MenuPageOption", () => {
  beforeEach(() => {
    ResizeObserverMock.latest = null;
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows a delayed tooltip only when rendered dimensions show a truncated title", async () => {
    const { checkbox, title } = renderPageOption(pageTitle);

    expect(title).toHaveClass(
      "overflow-hidden",
      "text-ellipsis",
      "whitespace-nowrap",
    );
    setTitleDimensions(title, 80, 240);

    fireEvent.pointerEnter(checkbox, { pointerType: "mouse" });

    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(pageTitle);
    expect(checkbox).toHaveAttribute(
      "aria-describedby",
      "menu-page-title-tooltip-page-1",
    );
    expect(document.body).toContainElement(screen.getByRole("tooltip"));
  });

  it("does not show a tooltip for a fully visible title", () => {
    vi.useFakeTimers();

    const { checkbox, title } = renderPageOption("Home");

    setTitleDimensions(title, 100, 100);
    fireEvent.pointerEnter(checkbox, { pointerType: "mouse" });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(checkbox).toHaveAccessibleName("Home");
  });

  it("rechecks truncation when the available width changes", async () => {
    const { checkbox, title } = renderPageOption(pageTitle);

    setTitleDimensions(title, 240, 240);
    fireEvent.mouseEnter(checkbox);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByRole("tooltip")).toBeNull();

    setTitleDimensions(title, 60, 240);
    fireEvent.focus(checkbox);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(pageTitle);
  });

  it("opens on keyboard focus, keeps the full checkbox name, and closes on Escape", () => {
    const { checkbox, title } = renderPageOption(pageTitle);

    setTitleDimensions(title, 80, 240);
    fireEvent.focus(checkbox);

    expect(screen.getByRole("tooltip")).toHaveTextContent(pageTitle);
    expect(checkbox).toHaveAccessibleName(pageTitle);
    expect(checkbox).toHaveAttribute(
      "aria-describedby",
      "menu-page-title-tooltip-page-1",
    );

    fireEvent.keyDown(checkbox, { key: "Escape" });

    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(checkbox).not.toHaveAttribute("aria-describedby");
  });

  it("preserves page selection changes", () => {
    const onCheckedChange = vi.fn();

    render(
      <MenuPageOption
        id="page-1"
        title={pageTitle}
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: pageTitle }));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("shows the page publication status in the destination picker", () => {
    render(
      <MenuPageOption
        id="draft-page"
        title="Test"
        status="DRAFT"
        checked={false}
        onCheckedChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /TestDraft/ })).toBeVisible();
  });

  it("shows the system page badge beside the title without replacing publication status", () => {
    render(
      <MenuPageOption
        id="home-page"
        title="Home"
        systemPage
        status="PUBLISHED"
        checked={false}
        onCheckedChange={vi.fn()}
      />,
    );

    expect(screen.getByText("System page")).toHaveClass("admin-badge-info");
    expect(screen.getByText("Published")).toBeVisible();
  });
});
