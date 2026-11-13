import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n/client";

import { HeaderSearch } from "./HeaderSearch";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/en/",
}));

it("opens, focuses, accepts typing and closes with Escape while restoring focus", () => {
  render(<HeaderSearch />);
  const trigger = screen.getByRole("button", { name: "Search" });
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  fireEvent.click(trigger);
  const input = screen.getByRole("searchbox");
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: "editorial" } });
  expect(input).toHaveValue("editorial");
  fireEvent.keyDown(input, { key: "Escape" });
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(screen.getByRole("search", { hidden: true })).toHaveAttribute("inert");
});

it("dismisses outside and on focus leaving the control", () => {
  render(<HeaderSearch />);
  const trigger = screen.getByRole("button");
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(trigger);
  fireEvent.blur(screen.getByRole("searchbox"), {
    relatedTarget: document.body,
  });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});

it("rejects blank submissions and navigates in the current locale", () => {
  render(
    <LocaleProvider locale="hu">
      <HeaderSearch />
    </LocaleProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Keresés" }));
  const form = screen.getByRole("search");
  const input = screen.getByRole("searchbox");
  expect(form).toHaveAttribute("action", "/hu/search");
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.submit(form);
  expect(push).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "  cikk & hír  " } });
  expect(fireEvent.submit(form)).toBe(false);
  expect(push).toHaveBeenCalledWith(
    `/hu/search?${new URLSearchParams({ q: "cikk & h\u00edr" })}`,
  );
});
