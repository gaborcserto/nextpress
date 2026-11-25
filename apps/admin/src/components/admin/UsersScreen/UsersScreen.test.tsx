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

  it("keeps the integrated search toolbar and existing sortable user headers", () => {
    useUsersScreenMock.mockReturnValue({
      users: [
        {
          id: "newer",
          name: "Newer",
          email: "newer@example.com",
          emailVerified: true,
          roleName: "EDITOR",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
        },
        {
          id: "older",
          name: "Older",
          email: "older@example.com",
          emailVerified: false,
          roleName: "AUTHOR",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      loading: false,
      error: null,
      creating: false,
      createForm: { email: "", name: "", role: "SUBSCRIBER", password: "" },
      setCreateForm: vi.fn(),
      createUser: createUserMock,
      createError: null,
      clearCreateError: vi.fn(),
      deletingId: null,
      deleteUser: vi.fn(),
    });
    render(<UsersScreen />);

    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /Created/ }),
    ).toHaveAttribute("aria-sort", "descending");
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Newer");

    fireEvent.click(screen.getByRole("button", { name: "Account" }));

    expect(
      screen.getByRole("columnheader", { name: /Account/ }),
    ).toHaveAttribute("aria-sort", "ascending");
  });
});
