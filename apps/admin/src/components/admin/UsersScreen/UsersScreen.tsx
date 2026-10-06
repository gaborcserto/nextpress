"use client";

import { FaEdit, FaPlus, FaSave, FaTimes, FaTrash } from "react-icons/fa";

import { useUsersScreen } from "./UsersScreen.hooks";
import type { UserRow } from "./UsersScreen.types";
import type { RoleName } from "@/lib/auth/roles";
import { ROLES } from "@/lib/auth/roles";
import { DataListEmptyRow, DataListLoading, DataListSurface } from "@/ui/components/DataList";
import {
  ConfirmDialog,
  Alert,
  Button,
  Field,
  FormGrid12,
  IconButton,
  Input,
  Section,
  Select,
  useConfirmDialog,
} from "@/ui/primitives";
import { AdminPageColumns, AdminPageLayout } from "@/ui/shell";

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
    <div className="space-y-6">
      <Alert status="error" message={error} />
      <AdminPageLayout title="Users" description="Create, delete, and manage roles.">
        <AdminPageColumns
          sidebar={
            <Section title="Create user" desc="Create a new user and set an initial role.">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void createUser();
                }}
              >
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
                      hint="Leave empty to rely on social login or reset flow."
                      span={12}
                    >
                      <Input
                        id="create-user-password"
                        type="password"
                        fullWidth
                        maxLength={128}
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

                  <div className="divider my-4" />

                  <div className="flex justify-end pt-1">
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
              </Section>
            }
          >

            <Section title="All users" desc="Edit roles or delete users.">
              {loading ? (
                <DataListLoading label="users" />
            ) : (
              <DataListSurface>
                <table className="table min-w-[760px] table-zebra w-full">
                    <thead className="bg-base-200">
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Verified</th>
                      <th>Created</th>
                      <th className="whitespace-nowrap text-right">Actions</th>
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
                                <span className={roleBadgeClass(role)}>{role}</span>
                              )}
                            </td>

                            <td>{u.emailVerified ? "Yes" : "No"}</td>

                            <td className="whitespace-nowrap">
                              {new Date(u.createdAt).toLocaleString()}
                            </td>

                            <td className="whitespace-nowrap text-right">
                              <div className="flex justify-end gap-2">
                                {isEditing ? (
                                  <>
                                    <IconButton
                                      type="submit"
                                      form={`edit-user-role-${u.id}`}
                                      icon={FaSave}
                                      size="sm"
                                      color="primary"
                                      variant="solid"
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
                                      variant="solid"
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
                    <DataListEmptyRow colSpan={6}>No users found.</DataListEmptyRow>
                  )}
                  </tbody>
                </table>
              </DataListSurface>
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
