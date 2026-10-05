"use client";


import { FaEdit, FaPlus, FaSave, FaTimes, FaTrash } from "react-icons/fa";

import { useUsersScreen } from "./UsersScreen.hooks";
import type { UserRow } from "./UsersScreen.types";
import type { RoleName } from "@/lib/auth/roles";
import { ROLES } from "@/lib/auth/roles";
import {
  ConfirmDialog,
  Field,
  FormGrid12,
  IconButton,
  LinkIconButton,
  Input,
  Section,
  Select,
  useConfirmDialog,
} from "@/ui/primitives";
import { AdminPageColumns, AdminPageLayout } from "@/ui/shell";
import type { MouseEvent } from "react";

type RoleOption = { value: RoleName; label: string };
const ROLE_OPTIONS: RoleOption[] = ROLES.map((r) => ({ value: r, label: r }));

type ConfirmPayload = { id: string; title: string };

function roleBadgeClass(role: RoleName | null | undefined) {
  switch (role) {
    case "ADMIN":
      return "badge badge-error";
    case "EDITOR":
      return "badge badge-info";
    case "AUTHOR":
      return "badge badge-success";
    case "SUBSCRIBER":
      return "badge badge-neutral";
    default:
      return "badge";
  }
}

export default function UsersScreen() {
  const {
    users,
    loading,
    error,

    creating,
    createForm,
    setCreateForm,
    createUser,

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

  const confirm = useConfirmDialog<ConfirmPayload>();

  const askDelete = (u: UserRow) => {
    confirm.show({
      id: u.id,
      title: u.email ?? u.name ?? "this user",
    });
  };

  const confirmDelete = async () => {
    if (!confirm.payload) return;
    await deleteUser(confirm.payload.id);
    confirm.hide();
  };

  return (
    <div className="space-y-6 w-full">
      {error ? (
        <div role="alert" className="alert alert-error">
          {error}
        </div>
      ) : null}
      <AdminPageLayout title="Users" description="Create, delete, and manage roles.">
        <AdminPageColumns sidebar={
          <>
          <Section title="Create user" desc="Create a new user and set an initial role.">
            <FormGrid12>
              <Field label="Email" span={12}>
                <Input
                  fullWidth
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, email: e.target.value }))
                  }
                  required
                />
              </Field>

              <Field label="Name" span={12}>
                <Input
                  fullWidth
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </Field>

              <Field label="Role" span={12}>
                <Select
                  fullWidth
                  value={createForm.role}
                  options={ROLE_OPTIONS as unknown as { value: string; label: string }[]}
                  onChangeAction={(value) =>
                    setCreateForm((p) => ({ ...p, role: value as RoleName }))
                  }
                />
              </Field>

              <Field
                label="Password (optional)"
                hint="Leave empty to rely on social login or reset flow."
                span={12}
              >
                <Input
                  type="password"
                  fullWidth
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, password: e.target.value }))
                  }
                />
              </Field>
            </FormGrid12>

            {/* divider + spacing */}
            <div className="divider my-4" />

            {/* right-aligned button with top padding */}
            <div className="flex justify-end pt-1">
              <LinkIconButton
                href="#"
                color="primary"
                icon={FaPlus}
                aria-label="Create user"
                onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                  e.preventDefault();
                  void createUser();
                }}
                disabled={creating}
              >
                Create user
              </LinkIconButton>
            </div>
          </Section>
          </>
        }>

          <Section title="All users" desc="Edit roles or delete users.">
            {loading && (
              <div className="flex items-center gap-2">
                <span className="loading loading-spinner" />
                <span>Loading…</span>
              </div>
            )}

            {!loading && (
              <div className="overflow-x-auto w-full bg-base-100 rounded-lg shadow border border-base-300">
                <table className="table table-zebra w-full">
                  <thead className="bg-base-200">
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Verified</th>
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                  </thead>

                  <tbody>
                  {users.length ? (
                    users.map((u) => {
                      const isEditing = editingId === u.id;
                      const role = (u.roleName ?? "SUBSCRIBER") as RoleName;

                      return (
                        <tr key={u.id}>
                          <td className="whitespace-nowrap">{u.name ?? "—"}</td>
                          <td className="whitespace-nowrap">{u.email ?? "—"}</td>

                          <td className="whitespace-nowrap">
                            {isEditing ? (
                              <Select
                                value={editingRole}
                                options={ROLE_OPTIONS as unknown as { value: string; label: string }[]}
                                onChangeAction={(value) =>
                                  setEditingRole(value as RoleName)
                                }
                              />
                            ) : (
                              <span className={roleBadgeClass(role)}>{role}</span>
                            )}
                          </td>

                          <td>{u.emailVerified ? "Yes" : "No"}</td>

                          <td className="whitespace-nowrap">
                            {new Date(u.createdAt).toLocaleString()}
                          </td>

                          <td className="text-right">
                            <div className="flex justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <IconButton
                                    icon={FaSave}
                                    size="sm"
                                    color="primary"
                                    variant="solid"
                                    loading={savingRoleId === u.id}
                                    aria-label="Save role"
                                    onClick={() => void saveRole(u.id)}
                                  >
                                    Save
                                  </IconButton>

                                  <IconButton
                                    icon={FaTimes}
                                    size="sm"
                                    variant="soft"
                                    aria-label="Cancel"
                                    onClick={cancelEdit}
                                  >
                                    Cancel
                                  </IconButton>
                                </>
                              ) : (
                                <>
                                  <IconButton
                                    icon={FaEdit}
                                    size="sm"
                                    variant="soft"
                                    aria-label="Edit role"
                                    onClick={() => startEdit(u)}
                                  >
                                    Edit
                                  </IconButton>

                                  <IconButton
                                    icon={FaTrash}
                                    size="sm"
                                    color="error"
                                    variant="solid"
                                    loading={deletingId === u.id}
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
                    <tr>
                      <td colSpan={6} className="text-center py-6 opacity-50">
                        No users found.
                      </td>
                    </tr>
                  )}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </AdminPageColumns>
      </AdminPageLayout>

      <ConfirmDialog
        open={confirm.open}
        title="Delete user?"
        confirmLabel="Delete"
        confirmColor="error"
        loading={!!deletingId && deletingId === confirm.payload?.id}
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
    </div>
  );
}
