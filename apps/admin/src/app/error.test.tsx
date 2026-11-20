import { serviceUnavailableDigest } from "@nextpress/shared/service-unavailable";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import AdminRouteError from "./admin/error";
import AdminError from "./error";

it("shows a controlled failure and retries without presenting a signed-out session", () => {
  const retry = vi.fn();
  render(<AdminError error={new Error("private error")} retry={retry} />);
  expect(screen.getByRole("heading")).toHaveTextContent(
    "Unable to load the administration",
  );
  expect(screen.queryByText("private error")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
});

it("shows a standalone outage when session discovery cannot reach the service", () => {
  const error = Object.assign(new Error("private upstream details"), {
    digest: serviceUnavailableDigest(),
  });
  render(<AdminError error={error} retry={vi.fn()} />);

  expect(screen.getByRole("main")).toHaveTextContent("503");
  expect(screen.getByRole("heading")).toHaveTextContent(
    "Service temporarily unavailable",
  );
  expect(
    screen.queryByText("private upstream details"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
});

it("lets an authenticated route recover inside the existing main landmark", () => {
  const retry = vi.fn();
  render(
    <main aria-label="Admin shell">
      <AdminRouteError error={new Error("private failure")} retry={retry} />
    </main>,
  );

  expect(screen.getAllByRole("main")).toHaveLength(1);
  expect(screen.getByRole("main")).toHaveTextContent("500");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledOnce();
});
