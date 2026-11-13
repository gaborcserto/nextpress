import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(cleanup);

// Geometry is exercised in browser checks; jsdom does not implement observers.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}

    disconnect() {}
  },
);

// jsdom has no media-query implementation; integration tests use desktop by default.
vi.stubGlobal(
  "matchMedia",
  vi.fn((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
);
