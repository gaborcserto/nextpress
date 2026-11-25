import { fireEvent, render, screen } from "@testing-library/react";
import { FaSave } from "react-icons/fa";
import { expect, it, vi } from "vitest";

import {
  AdminAsyncButton,
  AdminButton,
  AdminIconButton,
  AdminToggleButton,
} from "./Buttons";

it("retains the action name and prevents submission while pending", () => {
  const submit = vi.fn((event) => event.preventDefault());
  const { rerender } = render(
    <form onSubmit={submit}>
      <AdminAsyncButton type="submit" loading>
        Save changes
      </AdminAsyncButton>
    </form>,
  );
  const button = screen.getByRole("button", {
    name: "Save changes",
  });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");

  fireEvent.click(button);
  expect(submit).not.toHaveBeenCalled();

  rerender(
    <form onSubmit={submit}>
      <AdminAsyncButton type="submit" loading={false}>
        Save changes
      </AdminAsyncButton>
    </form>,
  );

  fireEvent.click(button);
  expect(submit).toHaveBeenCalledOnce();
});

it("keeps the idle label centered without an empty leading indicator", () => {
  const { rerender } = render(
    <AdminAsyncButton loading={false}>Save changes</AdminAsyncButton>,
  );
  const button = screen.getByRole("button", { name: "Save changes" });
  const idleGroup = button.querySelector(".admin-async-button-state");
  expect(idleGroup?.childElementCount).toBe(0);

  rerender(<AdminAsyncButton loading>Save changes</AdminAsyncButton>);

  expect(button).toHaveAccessibleName("Save changes");
  expect(idleGroup).toHaveAttribute("aria-hidden", "true");
  expect(
    button.querySelector(
      '.admin-async-button-state[aria-hidden="false"] .loading-spinner',
    ),
  ).toBeInTheDocument();
});

it("reserves space for localized loading content and replaces the idle icon", () => {
  const { rerender } = render(
    <AdminAsyncButton
      loading={false}
      loadingLabel="Saving changes..."
      icon={FaSave}
    >
      Save
    </AdminAsyncButton>,
  );
  const button = screen.getByRole("button", { name: "Save" });
  const content = button.querySelector(".admin-async-button-content");

  expect(content?.children).toHaveLength(2);
  expect(content?.querySelector(".loading-spinner")).toBeNull();

  rerender(
    <AdminAsyncButton loading loadingLabel="Saving changes..." icon={FaSave}>
      Save
    </AdminAsyncButton>,
  );

  expect(
    screen.getByRole("button", { name: "Saving changes..." }),
  ).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");
  expect(content?.children).toHaveLength(2);
  expect(content?.children[0]).toHaveAttribute("aria-hidden", "true");
  expect(content?.children[1]).toHaveAttribute("aria-hidden", "false");
  expect(
    content?.children[1].querySelector(".loading-spinner"),
  ).toBeInTheDocument();
});

it("renders a standard button with one icon and label and native button behavior", () => {
  const onClick = vi.fn();
  const onSubmit = vi.fn((event) => event.preventDefault());
  const { rerender } = render(
    <form onSubmit={onSubmit}>
      <AdminButton icon={FaSave} onClick={onClick}>
        Save changes
      </AdminButton>
    </form>,
  );

  const button = screen.getByRole("button", { name: "Save changes" });
  expect(button).toHaveTextContent(/^Save changes$/);
  expect(button.children).toHaveLength(1);
  expect(button.firstElementChild?.tagName).toBe("svg");
  expect(button).not.toHaveAttribute("aria-busy");

  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
  expect(onSubmit).not.toHaveBeenCalled();

  rerender(
    <form onSubmit={onSubmit}>
      <AdminButton disabled onClick={onClick}>
        Save changes
      </AdminButton>
    </form>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(onClick).toHaveBeenCalledOnce();
});

it("renders a named icon button with a single decorative SVG", () => {
  const onClick = vi.fn();
  const { rerender } = render(
    <AdminIconButton
      aria-label="Save"
      title="Save"
      icon={FaSave}
      onClick={onClick}
    />,
  );

  const button = screen.getByRole("button", { name: "Save" });
  expect(button).toHaveAttribute("title", "Save");
  expect(button.children).toHaveLength(1);
  expect(button.querySelector(":scope > svg")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  expect(button).not.toHaveAttribute("aria-busy");

  fireEvent.click(button);
  rerender(
    <AdminIconButton
      aria-label="Save"
      icon={FaSave}
      onClick={onClick}
      disabled
    />,
  );
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
});

it("exposes the controlled pressed state for icon and text toggles", () => {
  const { rerender } = render(
    <AdminToggleButton pressed={false} icon={FaSave} aria-label="Keep draft" />,
  );
  const button = screen.getByRole("button", {
    name: "Keep draft",
    pressed: false,
  });

  expect(button.children).toHaveLength(1);
  expect(button.querySelector(":scope > svg")).toBeInTheDocument();
  expect(button).not.toHaveAttribute("aria-busy");

  rerender(<AdminToggleButton pressed icon={FaSave} aria-label="Keep draft" />);
  expect(
    screen.getByRole("button", { name: "Keep draft", pressed: true }),
  ).toBe(button);

  rerender(<AdminToggleButton pressed>Keep draft</AdminToggleButton>);
  expect(
    screen.getByRole("button", { name: "Keep draft", pressed: true }).children,
  ).toHaveLength(0);
});
