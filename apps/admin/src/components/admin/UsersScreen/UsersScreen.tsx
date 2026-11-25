"use client";

import {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "@nextpress/shared/auth-policy";
import { useState, type FormEvent, type SyntheticEvent } from "react";
import { FaEdit, FaPlus, FaSearch, FaTrash } from "react-icons/fa";

import { ROLES } from "@/lib/auth/roles";
import { AdminTimestamp } from "@/lib/settings/admin-date-time";
import {
  DataListEmptyRow,
  DataListLoading,
  DataListSurface,
} from "@/ui/components/DataList";
import {
  MobileSortControl,
  SortableHeader,
  useTableSort,
  sortableTimestamp,
} from "@/ui/components/DataList/SortableHeader";
import { RoleBadge } from "@/ui/components/RoleBadge";
import { useModalDialog } from "@/ui/hooks/useModalDialog";
import {
  ConfirmDialog,
  Alert,
  Button,
  Field,
  FormGrid12,
  IconButton,
  LinkIconButton,
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
  const [search, setSearch] = useState("");
  const visibleUsers = sortedUsers.filter((user) =>
    `${user.name ?? ""} ${user.email ?? ""}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
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
          <form
            className="admin-list-toolbar"
            role="search"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="relative w-48 max-w-full">
              <Input
                aria-label="Search users"
                placeholder="Name or email"
                type="search"
                size="sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                rightIcon={<FaSearch size={14} />}
                className="w-full"
              />
            </div>
          </form>
          <MobileSortControl
            label="Sort by"
            directionLabel="Change sort direction"
            options={[
              { value: "account", label: "Account" },
              { value: "role", label: "Role" },
              { value: "verified", label: "Verified" },
              { value: "created", label: "Created" },
            ]}
            value={sort.column}
            direction={sort.direction === "ascending" ? "asc" : "desc"}
            onFieldAction={(column) =>
              sort.toggle(column as typeof sort.column)
            }
            onDirectionAction={() => sort.toggle(sort.column)}
          />
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
              {visibleUsers.length ? (
                visibleUsers.map((u) => {
                  const role = (u.roleName ?? "SUBSCRIBER") as RoleName;

                  return (
                    <tr key={u.id} role="row">
                      <td role="cell" className="admin-table-identity">
                        <strong>{u.name ?? "Unnamed user"}</strong>
                        <div className="text-sm text-(--text-muted)">
                          {u.email}
                        </div>
                      </td>

                      <td role="cell">
                        <span className="admin-cell-label" aria-hidden="true">
                          Role
                        </span>
                        <RoleBadge role={role} />
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
                          <LinkIconButton
                            href={`/admin/users/${encodeURIComponent(u.id)}/edit`}
                            icon={FaEdit}
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit ${u.name ?? u.email ?? "user"}`}
                            title={`Edit ${u.name ?? u.email ?? "user"}`}
                          >
                            Edit
                          </LinkIconButton>
                          <IconButton
                            type="button"
                            icon={FaTrash}
                            size="sm"
                            color="error"
                            variant="ghost"
                            loading={deletingId === u.id}
                            disabled={Boolean(deletingId)}
                            aria-label="Delete user"
                            title="Delete user"
                            onClick={() => askDelete(u)}
                          >
                            Delete
                          </IconButton>
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
