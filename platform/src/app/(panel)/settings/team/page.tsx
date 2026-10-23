"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { ForbiddenPage } from "@/components/RequirePermission";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";
import { DataTable } from "@/components/DataTable";
import { roleLabel } from "@/lib/permissions";
import type { PlatformRole } from "@/lib/types";
import { BackLink } from "@/components/BackLink";

type TeamUser = {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  isActive: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
};

const ROLES: PlatformRole[] = ["SUPER_ADMIN", "ADMIN", "BILLING", "SUPPORT", "READONLY"];

export default function TeamPage() {
  const { can } = usePlatformAuth();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [matrix, setMatrix] = useState<Array<{ role: PlatformRole; permissions: string[] }>>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function reload() {
    void api<{ users: TeamUser[] }>("/users").then((r) => setUsers(r.users)).catch(() => setError("Could not load team."));
    void api<{ matrix: Array<{ role: PlatformRole; permissions: string[] }> }>("/users/matrix")
      .then((r) => setMatrix(r.matrix))
      .catch(() => undefined);
  }

  useEffect(() => {
    reload();
  }, []);

  if (!can("platform_users:read")) return <ForbiddenPage />;

  async function createUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!can("platform_users:write")) return;
    setMessage("");
    const form = new FormData(e.currentTarget);
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({
          email: String(form.get("email") || ""),
          name: String(form.get("name") || ""),
          role: String(form.get("role") || "READONLY"),
          password: String(form.get("password") || ""),
        }),
      });
      setMessage("User created.");
      e.currentTarget.reset();
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not create user.");
    }
  }

  async function patchUser(id: string, patch: Record<string, unknown>) {
    if (!can("platform_users:write")) return;
    try {
      await api(`/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Update failed.");
    }
  }

  return (
    <div className="space-y-6">
      <BackLink href="/settings" label="Settings" />
      <PageHeader eyebrow="System" title="Platform team" description="Operator accounts and role permissions (super admin only)" />

      {can("platform_users:write") ? (
        <PanelCard title="Invite user">
          <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="field-label">Email</span>
              <input name="email" type="email" className="input" required />
            </label>
            <label className="text-sm">
              <span className="field-label">Name</span>
              <input name="name" className="input" required />
            </label>
            <label className="text-sm">
              <span className="field-label">Role</span>
              <select name="role" className="input" defaultValue="READONLY">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="field-label">Temporary password</span>
              <input name="password" type="password" className="input" minLength={12} required />
            </label>
            <button type="submit" className="btn-primary sm:col-span-2">Create user</button>
          </form>
        </PanelCard>
      ) : null}

      <DataTable>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>2FA</th>
            <th>Last login</th>
            {can("platform_users:write") ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <p className="font-medium">{u.name}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </td>
              <td>{roleLabel(u.role)}</td>
              <td>{u.isActive ? "Active" : "Inactive"}</td>
              <td>{u.totpEnabled ? "On" : "Off"}</td>
              <td className="text-xs text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
              {can("platform_users:write") ? (
                <td className="space-x-2 text-xs">
                  <select
                    className="input max-w-[8rem] py-1 text-xs"
                    value={u.role}
                    onChange={(e) => void patchUser(u.id, { role: e.target.value })}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{roleLabel(r)}</option>
                    ))}
                  </select>
                  <button type="button" className="text-accent-400 hover:underline" onClick={() => void patchUser(u.id, { isActive: !u.isActive })}>
                    {u.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    className="text-accent-400 hover:underline"
                    onClick={() => {
                      const password = window.prompt("New password (min 12 chars)");
                      if (password && password.length >= 12) {
                        void api(`/users/${u.id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }).then(reload);
                      }
                    }}
                  >
                    Reset password
                  </button>
                  <button type="button" className="text-accent-400 hover:underline" onClick={() => void api(`/users/${u.id}/force-logout`, { method: "POST" }).then(() => setMessage("Sessions revoked."))}>
                    Force logout
                  </button>
                  <button type="button" className="text-accent-400 hover:underline" onClick={() => void api(`/users/${u.id}/reset-2fa`, { method: "POST" }).then(reload)}>
                    Reset 2FA
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </DataTable>

      <PanelCard title="Role permissions">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.role} className="border-t border-white/5">
                  <td className="py-2 pr-4 font-medium">{roleLabel(row.role)}</td>
                  <td className="py-2 text-slate-400">{row.permissions.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>

      {message ? <p className="text-sm text-accent-400">{message}</p> : null}
      {error ? <p className="flash-error">{error}</p> : null}
      <p className="text-xs text-slate-500">
        <Link href="/settings" className="text-accent-400 hover:underline">Back to settings</Link>
      </p>
    </div>
  );
}
