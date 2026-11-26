// @vitest-environment node

import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";

import PublicationDatePicker from "./PublicationDatePicker";

it("server-renders the picker without a browser or local date assumptions", () => {
  const markup = renderToString(
    <PublicationDatePicker
      id="publish-at"
      value="2026-12-01T12:30:45.678Z"
      onChange={vi.fn()}
    />,
  );

  expect(markup).toContain('aria-label="Publish date and Publish time"');
  expect(markup).toContain('value="12/01/2026 12:30"');
});
