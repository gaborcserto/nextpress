import { fireEvent, render, screen } from "@testing-library/react";
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
