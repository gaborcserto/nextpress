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
    window.localStorage.clear();
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

  it("remembers only the email after successful sign-in and prefills it on a later visit", async () => {
    emailSignIn.mockResolvedValue({ error: null });
    const { unmount } = render(<SignInForm providers={[]} />);
    const rememberEmail = screen.getByRole("checkbox", { name: "Remember email" });
    rememberEmail.focus();
    expect(rememberEmail).toHaveFocus();
    fireEvent.click(rememberEmail);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Ada@Example.com " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret1" } });
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");

    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/admin"));
    expect(window.localStorage.getItem("nextpress.admin.remembered-email")).toBe("ada@example.com");
    expect(window.localStorage).toHaveLength(1);
    expect([...Array(window.localStorage.length)].map((_, index) => window.localStorage.key(index)))
      .toEqual(["nextpress.admin.remembered-email"]);

    unmount();
    emailSignIn.mockClear();
    render(<SignInForm providers={[]} />);
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "Remember email" })).toBeChecked();
    expect(emailSignIn).not.toHaveBeenCalled();
  });

  it("clears a remembered email when the user opts out", () => {
    window.localStorage.setItem("nextpress.admin.remembered-email", "ada@example.com");
    const { unmount } = render(<SignInForm providers={[]} />);
    const rememberEmail = screen.getByRole("checkbox", { name: "Remember email" });
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    fireEvent.click(rememberEmail);
    expect(window.localStorage.getItem("nextpress.admin.remembered-email")).toBeNull();

    unmount();
    render(<SignInForm providers={[]} />);
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "Remember email" })).not.toBeChecked();
  });

  it("does not save a new email after a failed sign-in", async () => {
    emailSignIn.mockResolvedValue({ error: { message: "Invalid credentials" } });
    render(<SignInForm providers={[]} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Remember email" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret1" } });

    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(window.localStorage.getItem("nextpress.admin.remembered-email")).toBeNull();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("keeps email remembering independent from Better Auth session persistence", async () => {
    emailSignIn.mockResolvedValue({ error: null });
    render(<SignInForm providers={[]} />);
    const rememberEmail = screen.getByRole("checkbox", { name: "Remember email" });
    expect(rememberEmail).not.toBeChecked();
    fireEvent.click(rememberEmail);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret1" } });

    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    await waitFor(() => expect(emailSignIn).toHaveBeenCalledOnce());
    expect(emailSignIn.mock.calls[0]?.[0]).not.toHaveProperty("rememberMe");
    expect(emailSignIn.mock.calls[0]?.[0]).toMatchObject({ email: "ada@example.com", password: "secret1" });
  });

  it("ignores and clears a corrupted remembered email", () => {
    window.localStorage.setItem("nextpress.admin.remembered-email", "not-an-email");
    render(<SignInForm providers={[]} />);
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "Remember email" })).not.toBeChecked();
    expect(window.localStorage.getItem("nextpress.admin.remembered-email")).toBeNull();
  });

  it("keeps the login form usable when browser storage is unavailable", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    render(<SignInForm providers={[]} />);
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "Remember email" })).not.toBeChecked();
    getItem.mockRestore();

    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    emailSignIn.mockResolvedValue({ error: null });
    fireEvent.click(screen.getByRole("checkbox", { name: "Remember email" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/admin"));
    setItem.mockRestore();
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
