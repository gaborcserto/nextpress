import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignInForm from "./SignInForm";

const { emailSignIn, routerPush } = vi.hoisted(() => ({
  emailSignIn: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/auth/auth-client", () => ({
  signIn: { email: emailSignIn, social: vi.fn() },
}));

describe("SignInForm", () => {
  beforeEach(() => {
    emailSignIn.mockReset();
    routerPush.mockReset();
  });

  it("starts with empty credentials and reports validation beside each field", () => {
    render(<SignInForm providers={[]} />);

    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");

    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(emailSignIn).not.toHaveBeenCalled();
  });

  it("submits valid credentials through the form and ignores a duplicate submit", async () => {
    let finishSignIn: ((result: { error: null }) => void) | undefined;
    emailSignIn.mockImplementation(
      () => new Promise((resolve) => { finishSignIn = resolve; }),
    );
    render(<SignInForm providers={[]} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret1" },
    });

    const form = screen.getByRole("button", { name: "Sign in" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(emailSignIn).toHaveBeenCalledOnce());
    finishSignIn?.({ error: null });
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/admin"));
  });
});
