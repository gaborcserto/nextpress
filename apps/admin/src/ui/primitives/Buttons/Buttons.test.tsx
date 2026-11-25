import { fireEvent, render, screen } from "@testing-library/react";
import { FaSave } from "react-icons/fa";
import { expect, it, vi } from "vitest";

import { Button } from "./Buttons";

it("retains the action name and prevents submission while pending", () => {
  const submit = vi.fn((event) => event.preventDefault());
  const { rerender } = render(
    <form onSubmit={submit}>
      <Button type="submit" loading>
        Save changes
      </Button>
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
      <Button type="submit">Save changes</Button>
    </form>,
  );

  fireEvent.click(button);
  expect(submit).toHaveBeenCalledOnce();
});

it("reserves space for localized loading content and replaces the idle icon", () => {
  const { rerender } = render(
    <Button loadingLabel="Saving changes...">
      <FaSave aria-hidden="true" />
      Save
    </Button>,
  );
  const button = screen.getByRole("button", { name: "Save" });
  const content = button.querySelector(".admin-button-content");

  expect(content?.children).toHaveLength(2);

  rerender(
    <Button loading loadingLabel="Saving changes...">
      <FaSave aria-hidden="true" />
      Save
    </Button>,
  );

  expect(
    screen.getByRole("button", { name: "Saving changes..." }),
  ).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");
  expect(content?.children).toHaveLength(2);
  expect(content?.children[0]).toHaveAttribute("aria-hidden", "true");
  expect(content?.children[1]).not.toHaveAttribute("aria-hidden");
  expect(
    content?.children[1].querySelector(".loading-spinner"),
  ).toBeInTheDocument();
});
