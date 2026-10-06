import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignInForm from "./SignInForm";

const { emailSignIn, socialSignIn, routerPush, query } = vi.hoisted(() => ({
  emailSignIn: vi.fn(),
  socialSignIn: vi.fn(),
  routerPush: vi.fn(),
  query: { value: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => new URLSearchParams(query.value),
}));
vi.mock("@/lib/auth/auth-client", () => ({
  signIn: { email: emailSignIn, social: socialSignIn },
}));

describe("SignInForm", () => {
  beforeEach(() => {
    emailSignIn.mockReset();
    socialSignIn.mockReset();
    routerPush.mockReset();
    query.value = "";
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

  it.each([
    { callback: "/admin/profile?source=a%26b", expected: "/admin/profile?source=a%26b" },
    { callback: "/%2f%2fevil.example", expected: "/admin" },
  ])("uses the same safe destination for credentials, OAuth, and navigation: $callback", async ({ callback, expected }) => {
    query.value = new URLSearchParams({ callbackUrl: callback }).toString();
    emailSignIn.mockResolvedValue({ error: null });
    socialSignIn.mockResolvedValue({ error: null });
    render(<SignInForm providers={["google"]} />);
    fireEvent.click(screen.getByRole("button", { name: "google" }));
    await waitFor(() => expect(socialSignIn).toHaveBeenCalledWith({ provider: "google", callbackURL: expected }));

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    await waitFor(() => expect(emailSignIn).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: expected })));
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith(expected));
  });
});
