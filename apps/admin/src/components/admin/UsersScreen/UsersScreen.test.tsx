import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import UsersScreen from "./UsersScreen";

const { useUsersScreenMock, createUserMock } = vi.hoisted(() => ({
  useUsersScreenMock: vi.fn(),
  createUserMock: vi.fn(),
}));

vi.mock("./UsersScreen.hooks", () => ({
  useUsersScreen: useUsersScreenMock,
}));

describe("UsersScreen creation form", () => {
  beforeEach(() => {
    createUserMock.mockReset();
    useUsersScreenMock.mockReturnValue({
      users: [],
      loading: false,
      error: null,
      creating: false,
      createForm: { email: "", name: "", role: "SUBSCRIBER", password: "" },
      setCreateForm: vi.fn(),
      createUser: createUserMock,
      createError: null,
      clearCreateError: vi.fn(),
      editingId: null,
      editingRole: "SUBSCRIBER",
      setEditingRole: vi.fn(),
      savingRoleId: null,
      startEdit: vi.fn(),
      cancelEdit: vi.fn(),
      saveRole: vi.fn(),
      deletingId: null,
      deleteUser: vi.fn(),
    });
  });

  it("submits user creation from a required email form", () => {
    render(<UsersScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Add user" }));
    const submit = screen.getByRole("button", { name: "Create user" });
    const email = screen.getByLabelText("Email");

    expect(email).toBeRequired();
    fireEvent.submit(submit.closest("form")!);

    expect(createUserMock).toHaveBeenCalledOnce();
  });
});
