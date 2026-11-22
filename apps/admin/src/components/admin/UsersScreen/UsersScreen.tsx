"use client";

import {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "@nextpress/shared/auth-policy";
import { useState, type FormEvent, type SyntheticEvent } from "react";
import { FaEdit, FaPlus, FaSave, FaTimes, FaTrash } from "react-icons/fa";

import { ROLES } from "@/lib/auth/roles";
import { AdminTimestamp } from "@/lib/settings/admin-date-time";
import {
  DataListEmptyRow,
  DataListLoading,
  DataListSurface,
} from "@/ui/components/DataList";
import {
  SortableHeader,
  useTableSort,
  sortableTimestamp,
} from "@/ui/components/DataList/SortableHeader";
import { useModalDialog } from "@/ui/hooks/useModalDialog";
import {
  ConfirmDialog,
  Alert,
  Button,
  Field,
  FormGrid12,
  IconButton,
  Input,
  Select,
  useConfirmDialog,
} from "@/ui/primitives";
import { Badge } from "@/ui/primitives/Badge";
import { AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import { useUsersScreen } from "./UsersScreen.hooks";

import type { RoleName } from "@/lib/auth/roles";

import type { UserRow } from "./UsersScreen.types";

type RoleOption = { value: RoleName; label: string };
const ROLE_OPTIONS: RoleOption[] = ROLES.map((r) => ({ value: r, label: r }));

type ConfirmPayload = { id: string; title: string };

export default function UsersScreen() {
  const {
    users,
    loading,
    error,

    creating,
    createForm,
    setCreateForm,
    createUser,
    createError,
    clearCreateError,

    editingId,
    editingRole,
    setEditingRole,
    savingRoleId,
    startEdit,
    cancelEdit,
    saveRole,

    deletingId,
    deleteUser,
  } = useUsersScreen();

  const sort = useTableSort<"account" | "role" | "verified" | "created">(
    "created",
    "descending",
  );
  const sortedUsers = sort.sortRows(users, {
    account: (user) => user.name ?? null,
    role: (user) => user.roleName ?? "SUBSCRIBER",
    verified: (user) => Number(user.emailVerified),
    created: (user) => sortableTimestamp(user.createdAt),
  });
  const confirm = useConfirmDialog<ConfirmPayload>();
  const [createOpen, setCreateOpen] = useState(false);
  const createDialogRef = useModalDialog(createOpen);

  function openCreateUser() {
    clearCreateError();
    setCreateOpen(true);
  }

  function closeCreateUser() {
    setCreateOpen(false);
  }

  function cancelCreateDialog(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();

    if (!creating) {
      closeCreateUser();
    }
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (await createUser()) {
      closeCreateUser();
    }
  }

  const askDelete = (u: UserRow) => {
    confirm.show({
      id: u.id,
      title: u.email ?? u.name ?? "this user",
    });
  };

  const confirmDelete = () => {
    void confirm.run(({ id }) => deleteUser(id));
  };

  return (
    <AdminPageLayout
      title="Users"
      description="Manage accounts and their access to NextPress. Sorting applies to the loaded accounts."
      actions={
        <Button type="button" color="primary" onClick={openCreateUser}>
          <FaPlus aria-hidden="true" />
          Add user
        </Button>
      }
    >
      <Alert status="error" message={error} />
      {loading ? (
        <DataListLoading label="users" />
      ) : (
        <DataListSurface>
          <table
            className="table admin-responsive-table w-full"
            role="table"
            aria-label="All users"
          >
            <thead role="rowgroup">
              <tr role="row">
                <SortableHeader column="account" sort={sort}>
                  Account
                </SortableHeader>
                <SortableHeader column="role" sort={sort}>
                  Role
                </SortableHeader>
                <SortableHeader column="verified" sort={sort}>
                  Verified
                </SortableHeader>
                <SortableHeader column="created" sort={sort}>
                  Created
                </SortableHeader>
                <th
                  role="columnheader"
                  scope="col"
                  className="whitespace-nowrap text-right"
                >
                  Actions
                </th>
              </tr>
            </thead>

            <tbody role="rowgroup">
              {users.length ? (
                sortedUsers.map((u) => {
                  const isEditing = editingId === u.id;
                  const role = (u.roleName ?? "SUBSCRIBER") as RoleName;

                  return (
                    <tr key={u.id} role="row">
                      <td role="cell" className="admin-table-identity">
                        <strong>{u.name ?? "Unnamed user"}</strong>
                        <div className="text-sm text-(--text-muted)">
                          {u.email}
                        </div>
                      </td>

                      <td
                        role="cell"
                        className={
                          isEditing ? "admin-table-actions" : undefined
                        }
                      >
                        {isEditing ? (
                          <form
                            id={`edit-user-role-${u.id}`}
                            onSubmit={(event) => {
                              event.preventDefault();
                              void saveRole(u.id);
                            }}
                          >
                            <Select
                              label={`Role for ${u.email ?? u.name ?? "user"}`}
                              disabled={savingRoleId === u.id}
                              value={editingRole}
                              options={ROLE_OPTIONS}
                              onChangeAction={(value) =>
                                setEditingRole(value as RoleName)
                              }
                            />
                          </form>
                        ) : (
                          <>
                            <span
                              className="admin-cell-label"
                              aria-hidden="true"
                            >
                              Role
                            </span>
                            <Badge>{role}</Badge>
                          </>
                        )}
                      </td>

                      <td role="cell">
                        <span className="admin-cell-label" aria-hidden="true">
                          Verified
                        </span>
                        <Badge
                          className={
                            u.emailVerified ? undefined : "admin-badge-muted"
                          }
                        >
                          {u.emailVerified ? "Verified" : "Unverified"}
                        </Badge>
                      </td>

                      <td role="cell">
                        <span className="admin-cell-label" aria-hidden="true">
                          Created
                        </span>
                        <AdminTimestamp value={u.createdAt} />
                      </td>

                      <td
                        role="cell"
                        className="admin-table-actions text-right"
                      >
                        <div className="flex flex-wrap justify-end gap-2">
                          {isEditing ? (
                            <>
                              <IconButton
                                type="submit"
                                form={`edit-user-role-${u.id}`}
                                icon={FaSave}
                                size="sm"
                                color="primary"
                                variant="soft"
                                loading={savingRoleId === u.id}
                                disabled={savingRoleId === u.id}
                                aria-label="Save role"
                              >
                                Save
                              </IconButton>

                              <IconButton
                                type="button"
                                icon={FaTimes}
                                size="sm"
                                variant="soft"
                                disabled={savingRoleId === u.id}
                                aria-label="Cancel"
                                onClick={cancelEdit}
                              >
                                Cancel
                              </IconButton>
                            </>
                          ) : (
                            <>
                              <IconButton
                                type="button"
                                icon={FaEdit}
                                size="sm"
                                variant="soft"
                                aria-label="Edit role"
                                disabled={Boolean(savingRoleId)}
                                onClick={() => startEdit(u)}
                              >
                                Edit
                              </IconButton>

                              <IconButton
                                type="button"
                                icon={FaTrash}
                                size="sm"
                                color="error"
                                variant="soft"
                                loading={deletingId === u.id}
                                disabled={Boolean(deletingId)}
                                aria-label="Delete user"
                                onClick={() => askDelete(u)}
                              >
                                Delete
                              </IconButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <DataListEmptyRow colSpan={5}>No users found.</DataListEmptyRow>
              )}
            </tbody>
          </table>
        </DataListSurface>
      )}
      <dialog
        ref={createDialogRef}
        className="admin-dialog"
        aria-labelledby="create-user-title"
        onCancel={cancelCreateDialog}
      >
        <h2 id="create-user-title" className="mb-4 text-lg font-semibold">
          Create user
        </h2>
        <form onSubmit={(event) => void submitUser(event)}>
          <fieldset disabled={creating}>
            <FormGrid12>
              <Field label="Email" htmlFor="create-user-email" span={12}>
                <Input
                  id="create-user-email"
                  fullWidth
                  type="email"
                  required
                  maxLength={320}
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Name" htmlFor="create-user-name" span={12}>
                <Input
                  id="create-user-name"
                  fullWidth
                  maxLength={200}
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Role" htmlFor="create-user-role" span={12}>
                <Select
                  id="create-user-role"
                  fullWidth
                  value={createForm.role}
                  options={ROLE_OPTIONS}
                  onChangeAction={(value) =>
                    setCreateForm((current) => ({
                      ...current,
                      role: value as RoleName,
                    }))
                  }
                />
              </Field>

              <Field
                label="Password (optional)"
                htmlFor="create-user-password"
                hint="Without a password this account cannot sign in. Password recovery is unavailable."
                span={12}
              >
                <Input
                  id="create-user-password"
                  type="password"
                  fullWidth
                  minLength={MIN_PASSWORD_LENGTH}
                  maxLength={MAX_PASSWORD_LENGTH}
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
              </Field>
            </FormGrid12>

            <Alert status="error" message={createError} />

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeCreateUser}>
                Cancel
              </Button>
              <Button
                type="submit"
                color="primary"
                loading={creating}
                disabled={creating}
              >
                <FaPlus aria-hidden="true" />
                Create user
              </Button>
            </div>
          </fieldset>
        </form>
      </dialog>

      <ConfirmDialog
        open={confirm.open}
        error={confirm.error}
        title="Delete user?"
        confirmLabel="Delete"
        confirmColor="error"
        loading={confirm.pending}
        onCancelAction={confirm.hide}
        onConfirmAction={confirmDelete}
      >
        {confirm.payload ? (
          <p>
            You are about to delete{" "}
            <span className="font-medium">{confirm.payload.title}</span>.
          </p>
        ) : null}
      </ConfirmDialog>
    </AdminPageLayout>
  );
}
