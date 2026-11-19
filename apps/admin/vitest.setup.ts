import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

/* jsdom omits the native dialog API. Chromium exercises its modal behavior. */
const previousDialogFocus = new WeakMap<HTMLDialogElement, Element | null>();

if (
  typeof HTMLDialogElement !== "undefined" &&
  !HTMLDialogElement.prototype.showModal
) {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        previousDialogFocus.set(this, document.activeElement);
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        const previous = previousDialogFocus.get(this);
        this.open = false;
        previousDialogFocus.delete(this);

        if (previous instanceof HTMLElement) {
          previous.focus();
        }
      },
    },
  });
}
