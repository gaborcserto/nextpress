import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import AdminError from "./error";

it("shows a controlled failure and retries without presenting a signed-out session", () => {
  const reset = vi.fn();
  render(<AdminError reset={reset} />);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "service may be unavailable",
  );
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(reset).toHaveBeenCalledOnce();
  expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
});
