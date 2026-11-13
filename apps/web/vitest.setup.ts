import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Mirror next.config's manual locale-home trailing-slash handling in Next Link.
vi.stubEnv("__NEXT_MANUAL_TRAILING_SLASH", "true");

afterEach(cleanup);

// Geometry is exercised in browser checks; jsdom does not implement observers.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}

    unobserve() {}

    disconnect() {}
  },
);

vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}

    unobserve() {}

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
