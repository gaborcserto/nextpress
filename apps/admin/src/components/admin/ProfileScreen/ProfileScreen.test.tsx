import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProfileScreen from "./ProfileScreen";

const { useSessionMock, updateUser } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  useSession: useSessionMock,
  authClient: { updateUser },
}));

describe("ProfileScreen", () => {
  beforeEach(() => {
    updateUser.mockReset();
    useSessionMock.mockReturnValue({
      data: {
        user: {
          id: "profile-user",
          name: "Ada Lovelace",
          email: "ada@example.com",
          image: null,
        },
      },
      isPending: false,
    });
  });

  it("validates the display name and sends only the normalized name", async () => {
    updateUser.mockResolvedValue({ error: null });
    render(<ProfileScreen />);

    const name = screen.getByRole("textbox", { name: "Display name" });
    const save = screen.getByRole("button", { name: "Save profile" });
    expect(name).toHaveValue("Ada Lovelace");
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    fireEvent.change(name, { target: { value: "   " } });
    fireEvent.click(save);
    expect(name).toBeInvalid();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a display name.",
    );
    expect(updateUser).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: "  Ada Byron  " } });
    fireEvent.click(save);
    expect(await screen.findByText("Profile saved.")).toHaveAttribute(
      "role",
      "status",
    );
    expect(updateUser).toHaveBeenCalledWith({ name: "Ada Byron" });
    expect(name).toHaveValue("Ada Byron");
  });

  it("announces a rejected update and preserves the entered name", async () => {
    updateUser.mockResolvedValue({ error: { status: 401 } });
    render(<ProfileScreen />);

    const name = screen.getByRole("textbox", { name: "Display name" });
    fireEvent.change(name, { target: { value: "A new name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to save your profile.",
    );
    expect(name).toHaveValue("A new name");
  });

  it("opens an empty display name for accounts created without a name", () => {
    useSessionMock.mockReturnValue({
      data: {
        user: { id: "unnamed", name: null, email: "unnamed@example.com" },
      },
      isPending: false,
    });
    render(<ProfileScreen />);

    expect(screen.getByRole("textbox", { name: "Display name" })).toHaveValue(
      "",
    );
  });
});
