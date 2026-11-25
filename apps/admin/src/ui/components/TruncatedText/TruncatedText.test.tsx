import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { TruncatedText } from "./TruncatedText";

class ResizeObserverMock {
  static callback: ResizeObserverCallback;
  static instance: ResizeObserverMock;

  constructor(callback: ResizeObserverCallback) {
    ResizeObserverMock.callback = callback;
    ResizeObserverMock.instance = this;
  }

  observe() {}

  unobserve() {}

  disconnect() {}

  static resize(target: Element, width: number, contentWidth: number) {
    Object.defineProperties(target, {
      clientWidth: { configurable: true, value: width },
      scrollWidth: { configurable: true, value: contentWidth },
    });
    act(() => {
      this.callback([{ target } as ResizeObserverEntry], this.instance);
    });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it("opens the complete title from link focus and preserves the destination", () => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  const value = "Typography and structured content: a public style guide";
  render(<TruncatedText href="/admin/pages/page-1" value={value} />);
  const text = screen.getByText(value);
  const link = screen.getByRole("link", { name: value });

  ResizeObserverMock.resize(text, 60, 300);
  fireEvent.focus(link);

  expect(link).toHaveAttribute("href", "/admin/pages/page-1");
  expect(link).not.toHaveAttribute("title");
  expect(screen.getByRole("tooltip")).toHaveTextContent(value);

  fireEvent.keyDown(link, { key: "Escape" });

  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("adds a keyboard stop for plain overflowed text and removes it when the text fits", () => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  const value = "/parent/nested/long-unbroken-path";
  render(<TruncatedText value={value} />);
  const text = screen.getByText(value);
  expect(text).not.toHaveAttribute("tabindex");

  ResizeObserverMock.resize(text, 60, 200);
  expect(text).toHaveAttribute("tabindex", "0");
  fireEvent.focus(text);
  expect(screen.getByRole("tooltip")).toHaveTextContent(value);

  ResizeObserverMock.resize(text, 250, 200);
  expect(text).not.toHaveAttribute("tabindex");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});
