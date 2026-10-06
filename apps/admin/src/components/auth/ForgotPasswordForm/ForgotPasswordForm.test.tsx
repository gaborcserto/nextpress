import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "./ForgotPasswordForm";

const { resetRequest } = vi.hoisted(() => ({ resetRequest: vi.fn() }));
vi.mock("@/lib/auth/auth-client", () => ({ requestPasswordReset: resetRequest }));
beforeEach(() => { resetRequest.mockReset(); });

it.each(["response", "network"])("does not claim delivery after a %s failure", async (failure) => {
  if (failure === "response") resetRequest.mockResolvedValue({ error: { code: "ACCOUNT_EMAIL_UNAVAILABLE" } });
  else resetRequest.mockImplementation(async () => { throw new Error("offline"); });
  render(<ForgotPasswordForm />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
  fireEvent.submit(screen.getByRole("button", { name: "Send reset link" }).closest("form")!);
  await waitFor(() => expect(screen.getByText("Password recovery is unavailable. Contact an administrator.")).toBeInTheDocument());
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send reset link" })).toBeEnabled();
});
