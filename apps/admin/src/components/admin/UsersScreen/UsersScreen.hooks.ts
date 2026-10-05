import { useCallback, useEffect, useRef, useState } from "react";

import type { CreateUserValues, UserRow } from "./UsersScreen.types";
import { jsonFetcher } from "@/lib/api";
import type { RoleName } from "@/lib/auth/roles";
import { showToast } from "@/ui/utils";

export function useUsersScreen() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultRole, setDefaultRole] = useState<RoleName>("SUBSCRIBER");

  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [createForm, setCreateForm] = useState<CreateUserValues>({
    email: "",
    name: "",
    role: "SUBSCRIBER",
    password: "",
  });

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletingRef = useRef<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<RoleName>("SUBSCRIBER");
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const savingRoleRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jsonFetcher<UserRow[]>("/api/admin/users", {
        cache: "no-store",
      });
      setUsers(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void jsonFetcher<{ defaultUserRole: RoleName }>("/api/admin/settings", {
      cache: "no-store",
    })
      .then((settings) => {
        setDefaultRole(settings.defaultUserRole);
        setCreateForm((current) => ({
          ...current,
          role: settings.defaultUserRole,
        }));
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to load the default user role.",
        );
      });
  }, []);

  const createUser = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setError(null);
    try {
      await jsonFetcher("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createForm.email,
          name: createForm.name || null,
          role: createForm.role,
          password: createForm.password || undefined,
        }),
      });

      setCreateForm({ email: "", name: "", role: defaultRole, password: "" });
      await load();
      showToast("User created.", "success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create user.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const startEdit = (u: UserRow) => {
    setEditingId(u.id);
    setEditingRole((u.roleName ?? "SUBSCRIBER") as RoleName);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSavingRoleId(null);
  };

  const saveRole = async (userId: string) => {
    if (savingRoleRef.current) return;
    savingRoleRef.current = userId;
    setSavingRoleId(userId);
    setError(null);

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, roleName: editingRole } : u))
    );

    try {
      await jsonFetcher(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editingRole }),
      });

      setEditingId(null);
      showToast("User role updated.", "success");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to update role.";
      await load();
      setError(message);
    } finally {
      savingRoleRef.current = null;
      setSavingRoleId(null);
    }
  };

  const deleteUser = async (userId: string) => {
    if (deletingRef.current) return;
    deletingRef.current = userId;
    setDeletingId(userId);
    setError(null);
    try {
      await jsonFetcher(`/api/admin/users/${userId}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      showToast("User deleted.", "success");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to delete user.";
      await load();
      setError(message);
    } finally {
      deletingRef.current = null;
      setDeletingId(null);
    }
  };

  return {
    // data
    users,
    loading,
    error,

    // create
    creating,
    createForm,
    setCreateForm,
    createUser,

    // edit role
    editingId,
    editingRole,
    setEditingRole,
    savingRoleId,
    startEdit,
    cancelEdit,
    saveRole,

    // delete
    deletingId,
    deleteUser,

    // reload
    reload: load,
  };
}
