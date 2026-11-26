import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { expect, it } from "vitest";

import { BlogWordmark } from "./BlogWordmark";

it("presents the NextPress wordmark without changing its accessible name", () => {
  render(
    <Link href="/">
      <BlogWordmark siteName="NextPress" />
    </Link>,
  );
  expect(screen.getByRole("link", { name: "NextPress" })).toHaveTextContent(
    "NextPress.",
  );
});

it("preserves custom publication names and Hungarian characters", () => {
  const siteName =
    "\u00c1rv\u00edzt\u0171r\u0151 t\u00fck\u00f6rf\u00far\u00f3g\u00e9p";
  render(
    <Link href="/">
      <BlogWordmark siteName={siteName} />
    </Link>,
  );
  expect(screen.getByRole("link", { name: siteName })).toHaveTextContent(
    siteName,
  );
  expect(screen.getByRole("link").textContent).toBe(siteName);
});
