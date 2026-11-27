import { act, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { IoGlobeOutline } from "react-icons/io5";
import { expect, it, vi } from "vitest";

import { LocaleProvider, PreferenceProvider } from "@/lib/i18n/client";

import { VisitorControls } from "../VisitorControls";
import { PreferenceChoice } from "./PreferenceChoice";

function renderChoice() {
  const onChange = vi.fn();

  const choice = (value: string) => (
    <PreferenceChoice
      label="Language"
      value={value}
      icon={<IoGlobeOutline aria-hidden="true" />}
      options={[
        { value: "en", label: "English" },
        { value: "hu", label: "Magyar" },
      ]}
      onChange={onChange}
    />
  );
  const { rerender } = render(choice("en"));

  return {
    onChange,
    rerenderChoice: (value: string) => rerender(choice(value)),
  };
}

it("keeps the closing panel mounted but immediately removes it from interaction and accessibility", () => {
  renderChoice();
  const trigger = screen.getByRole("button", { name: "Language" });
  const panel = screen.getByRole("menu", { hidden: true });
  expect(trigger).toHaveAttribute("aria-controls", panel.id);
  expect(panel).toHaveAttribute("inert");
  fireEvent.click(trigger);
  expect(screen.getByRole("menu")).toBe(panel);
  expect(panel).not.toHaveAttribute("inert");
  expect(screen.getByRole("menuitemradio", { name: "English" })).toHaveFocus();
  fireEvent.keyDown(panel, { key: "Escape" });
  expect(panel).toBeInTheDocument();
  expect(panel).toHaveAttribute("aria-hidden", "true");
  expect(panel).toHaveAttribute("inert");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  expect(screen.getByRole("menu")).toBe(panel);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(trigger, { key: "Escape" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});

it("restores focus after selection and reflects the value accepted by its parent", () => {
  const { onChange, rerenderChoice } = renderChoice();
  const trigger = screen.getByRole("button", { name: "Language" });
  fireEvent.click(trigger);

  fireEvent.click(screen.getByRole("menuitemradio", { name: "Magyar" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith("hu");
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");

  rerenderChoice("hu");
  fireEvent.click(trigger);

  expect(
    screen.getByRole("menuitemradio", { name: "Magyar", checked: true }),
  ).toHaveFocus();
  expect(onChange).toHaveBeenCalledTimes(1);
});

it("dismisses from an outside pointer without editing the controlled value", () => {
  const { onChange } = renderChoice();
  const trigger = screen.getByRole("button", { name: "Language" });
  fireEvent.click(trigger);

  fireEvent.pointerDown(document.body);

  expect(trigger).toHaveFocus();
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

it("dismisses when focus leaves the menu without emitting a choice", () => {
  const { onChange } = renderChoice();
  const trigger = screen.getByRole("button", { name: "Language" });
  fireEvent.click(trigger);

  fireEvent.blur(
    screen.getByRole("menuitemradio", { name: "English", checked: true }),
    {
      relatedTarget: document.body,
    },
  );

  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(onChange).not.toHaveBeenCalled();
});

import type { Root } from "react-dom/client";

it.each(["en", "hu"] as const)(
  "keeps the closed %s menu identical in SSR and the initial hydrated tree",
  async (locale) => {
    for (const mode of ["light", "dark", "system"]) {
      const ui = (
        <LocaleProvider locale={locale}>
          <PreferenceProvider mode={mode}>
            <VisitorControls />
          </PreferenceProvider>
        </LocaleProvider>
      );
      const container = document.createElement("div");
      const recoverable = vi.fn();
      let root: Root | undefined;
      document.body.append(container);

      try {
        container.innerHTML = renderToString(ui);
        const serverMenu = container.querySelector('[role="menu"]');
        expect(serverMenu).not.toBeNull();
        expect(serverMenu).toHaveAttribute("data-open", "false");
        expect(serverMenu).toHaveAttribute("inert");
        const serverMarkup = serverMenu?.outerHTML;

        await act(async () => {
          root = hydrateRoot(container, ui, {
            onRecoverableError: recoverable,
          });
        });

        expect(recoverable).not.toHaveBeenCalled();
        expect(container.querySelector('[role="menu"]')).toBe(serverMenu);
        expect(container.querySelector('[role="menu"]')?.outerHTML).toBe(
          serverMarkup,
        );
        const trigger = container.querySelector('button[aria-haspopup="menu"]');
        expect(trigger).toHaveAttribute("aria-controls", serverMenu?.id);
      } finally {
        await act(async () => root?.unmount());
        container.remove();
      }
    }
  },
);
it("detects the reported stale-server case when the always-mounted menu is absent from server HTML", async () => {
  const ui = (
    <LocaleProvider locale="hu">
      <PreferenceProvider mode="dark">
        <VisitorControls />
      </PreferenceProvider>
    </LocaleProvider>
  );
  const container = document.createElement("div");
  const recoverable = vi.fn();
  let root: Root | undefined;
  document.body.append(container);

  try {
    container.innerHTML = renderToString(ui);
    container.querySelector('[role="menu"]')?.remove();

    await act(async () => {
      root = hydrateRoot(container, ui, { onRecoverableError: recoverable });
    });

    expect(recoverable).toHaveBeenCalled();
    expect(container.querySelector('[role="menu"]')).toHaveAttribute(
      "aria-label",
      "Nyelv",
    );
  } finally {
    await act(async () => root?.unmount());
    container.remove();
  }
});
