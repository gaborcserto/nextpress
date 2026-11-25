"use client";

import { useState } from "react";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import { useSession } from "@/lib/auth/auth-client";
import { ROLES } from "@/lib/auth/roles";
import { useAdminLocale } from "@/lib/i18n/admin-locale";
import RecordId from "@/ui/components/DataList/RecordId";
import { RoleBadge } from "@/ui/components/RoleBadge";
import { Alert, Button, LinkButton, Section, Select } from "@/ui/primitives";
import { AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import { DisplayNameForm } from "../ProfileScreen/ProfileScreen";

import type { RoleName } from "@/lib/auth/roles";

import type { UserRow } from "./UsersScreen.types";

const endpoint = "/api/admin/users";
const roles = ROLES.map((role) => ({ value: role, label: role }));

export function UserEditScreen({ id }: { id: string }) {
  const hu = useAdminLocale() === "hu";
  const { data: session } = useSession();
  const [savingProfile, setSavingProfile] = useState(false);
  const { data, error, mutate } = useSWR(endpoint, jsonFetcher<UserRow[]>);
  const user = data?.find((entry) => entry.id === id);
  const [pendingRole, setPendingRole] = useState<RoleName | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const currentRole = user?.roleName ?? "SUBSCRIBER";
  const role = pendingRole ?? currentRole;

  async function save() {
    if (!user || saving || role === currentRole) {
      return;
    }

    setSaving(true);
    setFailed(false);
    setSaved(false);

    try {
      await jsonFetcher(`${endpoint}/${encodeURIComponent(id)}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      await mutate(
        (users) =>
          users?.map((entry) =>
            entry.id === id ? { ...entry, roleName: role } : entry,
          ),
        { revalidate: false },
      );
      setPendingRole(null);
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageLayout
      title={hu ? "Felhasználó szerkesztése" : "Edit user"}
      actions={
        <>
          <LinkButton href="/admin/users" variant="ghost">
            {hu ? "Vissza" : "Back to users"}
          </LinkButton>
          <Button
            type="submit"
            form="edit-user"
            color="primary"
            loading={saving}
            disabled={!user || role === currentRole || saving}
          >
            {hu ? "Mentés" : "Save"}
          </Button>
        </>
      }
    >
      {error && (
        <Alert
          status="error"
          message={
            hu ? "A fiók betöltése sikertelen." : "Unable to load the account."
          }
        />
      )}
      {!data && !error && <p role="status">{hu ? "Betöltés…" : "Loading…"}</p>}
      {data && !user && (
        <p role="alert">
          {hu ? "A fiók nem található." : "Account not found."}
        </p>
      )}
      {user && (
        <Section title={user.name ?? user.email ?? id}>
          <RecordId id={user.id} />
          <form
            id="edit-user"
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            {user.email && <p>{user.email}</p>}
            <p className="flex items-center gap-2">
              <span>{hu ? "Jelenlegi szerepkör:" : "Current role:"}</span>
              <RoleBadge role={currentRole} />
            </p>
            <Select
              label={hu ? "Szerepkör" : "Role"}
              value={role}
              options={roles}
              disabled={saving}
              onChangeAction={(value) => {
                const option = roles.find((entry) => entry.value === value);
                setPendingRole(option?.value ?? null);
                setSaved(false);
              }}
            />
            {failed && (
              <Alert
                status="error"
                message={
                  hu
                    ? "A szerepkör mentése sikertelen."
                    : "Unable to save the role. Check the account permissions and try again."
                }
              />
            )}
            {saved && (
              <p role="status">{hu ? "Szerepkör mentve." : "Role saved."}</p>
            )}
          </form>
          {session?.user.id === user.id && (
            <div className="mt-4 grid justify-items-start gap-2">
              <DisplayNameForm
                key={id}
                initialName={user.name ?? ""}
                onSavingChangeAction={setSavingProfile}
                onSavedAction={(name) => {
                  void mutate(
                    (users) =>
                      users?.map((entry) =>
                        entry.id === id ? { ...entry, name } : entry,
                      ),
                    { revalidate: false },
                  );
                }}
              />
              <Button
                type="submit"
                form="admin-profile-form"
                variant="outline"
                loading={savingProfile}
              >
                {hu ? "Megjelenített név mentése" : "Save display name"}
              </Button>
            </div>
          )}
        </Section>
      )}
    </AdminPageLayout>
  );
}
