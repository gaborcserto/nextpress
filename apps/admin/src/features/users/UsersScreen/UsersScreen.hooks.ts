import { useCallback, useEffect, useRef, useState } from "react";

import { jsonFetcher } from "@/lib/api";
import { showToast } from "@/ui/utils";

import type { RoleName } from "@/lib/auth/roles";

import type { CreateUserValues, UserRow } from "./UsersScreen.types";

export function useUsersScreen() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
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

  const usersRequest = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    usersRequest.current?.abort();
    const controller = new AbortController();
    usersRequest.current = controller;

    return jsonFetcher<UserRow[]>("/api/admin/users", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setUsers(data);
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error ? caught.message : "Failed to load users.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
  }, []);

  const reload = async () => {
    setLoading(true);
    setError(null);
    await load();
  };

  useEffect(() => {
    void load();

    return () => usersRequest.current?.abort();
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    void jsonFetcher<{ defaultUserRole: RoleName }>("/api/admin/settings", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((settings) => {
        if (controller.signal.aborted) {
          return;
        }

        setDefaultRole(settings.defaultUserRole);
        setCreateForm((current) => ({
          ...current,
          role: settings.defaultUserRole,
        }));
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Failed to load the default user role.",
          );
        }
      });

    return () => controller.abort();
  }, []);

  const createUser = async () => {
    if (creatingRef.current) {
      return false;
    }

    creatingRef.current = true;
    setCreating(true);
    setCreateError(null);

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
      await reload();
      showToast("User created.", "success");

      return true;
    } catch (caught) {
      setCreateError(
        caught instanceof Error ? caught.message : "Failed to create user.",
      );

      return false;
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
    if (savingRoleRef.current) {
      return;
    }

    savingRoleRef.current = userId;
    setSavingRoleId(userId);
    setError(null);

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, roleName: editingRole } : u)),
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
      await reload();
      setError(message);
    } finally {
      savingRoleRef.current = null;
      setSavingRoleId(null);
    }
  };

  const deleteUser = async (userId: string) => {
    if (deletingRef.current) {
      return;
    }

    deletingRef.current = userId;
    setDeletingId(userId);
    setError(null);

    try {
      await jsonFetcher(`/api/admin/users/${userId}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      showToast("User deleted.", "success");
    } catch {
      throw new Error(
        "Unable to delete user. You may not have permission, or this may be the last administrator.",
      );
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
    createError,
    clearCreateError: () => setCreateError(null),

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
    reload,
  };
}
