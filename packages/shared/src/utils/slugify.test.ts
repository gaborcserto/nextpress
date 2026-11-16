import { describe, expect, it } from "vitest";

import { slugify } from "./slugify";

describe("slugify", () => {
  it.each([
    ["Hello World!", "hello-world"],
    [
      "\u00c1rv\u00edzt\u0171r\u0151 t\u00fck\u00f6rf\u00far\u00f3g\u00e9p",
      "arvizturo-tukorfurogep",
    ],
    ["  Cr\u00e8me br\u00fbl\u00e9e: News!  ", "creme-brulee-news"],
    ["Cafe\u0301 \uff26\uff4f\uff4f", "cafe-foo"],
    ["multiple   spaces---here", "multiple-spaces-here"],
    ["--Already--normalized--", "-already-normalized-"],
    ["a_b & c/d", "ab-cd"],
    ["!? ", ""],
    ["", ""],
    ["\u4e2d\u6587", ""],
    ["already-normalized", "already-normalized"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
