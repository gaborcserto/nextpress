import { useCallback, useEffect, useMemo, useState } from "react";

import type { CreateUserValues, UserRow } from "./UsersScreen.types";
import type { RoleName } from "@/lib/auth/roles";

async function api<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { ...init, cache: "no-store" });
  if (!res.ok) throw new Error(await res.text().catch(() => "Request failed"));
  return (await res.json()) as T;
}

export function useUsersScreen() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultRole, setDefaultRole] = useState<RoleName>("SUBSCRIBER");

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserValues>({
    email: "",
    name: "",
    role: "SUBSCRIBER",
    password: "",
  });

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<RoleName>("SUBSCRIBER");
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<UserRow[]>("/api/admin/users");
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api<{ defaultUserRole: RoleName }>("/api/admin/settings").then((settings) => {
      setDefaultRole(settings.defaultUserRole);
      setCreateForm((current) => ({
        ...current,
        role: settings.defaultUserRole,
      }));
    });
  }, []);

  const sorted = useMemo(() => users, [users]);

  const createUser = async () => {
    setCreating(true);
    try {
      await api("/api/admin/users/create", {
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
    } finally {
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
    setSavingRoleId(userId);

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, roleName: editingRole } : u))
    );

    try {
      await api(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editingRole }),
      });

      setEditingId(null);
    } catch (e) {
      await load();
      throw e;
    } finally {
      setSavingRoleId(null);
    }
  };

  const deleteUser = async (userId: string) => {
    setDeletingId(userId);
    try {
      await api(`/api/admin/users/${userId}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e) {
      await load();
      throw e;
    } finally {
      setDeletingId(null);
    }
  };

  return {
    // data
    users: sorted,
    loading,

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
