import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { MenuDisclosure } from "./MenuDisclosure";

afterEach(() => {
  vi.restoreAllMocks();
});

function setDesktop(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query === "(min-width: 56rem)" && matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function renderDisclosure() {
  render(
    <MenuDisclosure label="Open submenu for Section" title="Section">
      <ul>
        <li>
          <a href="https://example.test/section/child">Child page</a>
        </li>
      </ul>
    </MenuDisclosure>,
  );

  return {
    disclosure: screen.getByText("Section").closest("details") as HTMLElement,
    toggle: screen.getByLabelText("Open submenu for Section"),
  };
}

it("opens on desktop hover and closes after the pointer leaves", () => {
  setDesktop(true);
  const { disclosure } = renderDisclosure();

  fireEvent.pointerEnter(disclosure, { pointerType: "mouse" });
  expect(disclosure).toHaveAttribute("open");

  fireEvent.pointerLeave(disclosure, { pointerType: "mouse" });
  expect(disclosure).not.toHaveAttribute("open");
});

it("opens by touch and keyboard, closes on Escape and outside interaction", () => {
  setDesktop(false);
  const { disclosure, toggle } = renderDisclosure();

  fireEvent.pointerEnter(disclosure, { pointerType: "touch" });
  expect(disclosure).not.toHaveAttribute("open");

  fireEvent.click(toggle);
  expect(disclosure).toHaveAttribute("open");

  fireEvent.keyDown(disclosure, { key: "Escape" });
  expect(disclosure).not.toHaveAttribute("open");
  expect(toggle).toHaveFocus();

  fireEvent.click(toggle);
  fireEvent.pointerDown(document.body);
  expect(disclosure).not.toHaveAttribute("open");
});
