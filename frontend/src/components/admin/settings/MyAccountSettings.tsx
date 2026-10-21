"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, LogOut, MonitorSmartphone, UserCircle } from "lucide-react";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { ApprovalPinSettings } from "@/components/admin/ApprovalPinSettings";
import { TwoFactorSettings } from "@/components/admin/TwoFactorSettings";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import { api } from "@/lib/api";
import { dashboardLabel, useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";
import { settingsPath } from "@/modules/settings/ia";

function roleBadgeClass(role: User["role"]) {
  if (role === "ADMIN") return "bg-brand-100 text-brand-900";
  if (role === "MANAGER") return "bg-violet-100 text-violet-900";
  return "bg-stone-100 text-stone-800";
}

function AccountProfileCard() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <SettingsSection
      id="setting-my-account-profile"
      icon={UserCircle}
      title="Profile"
      description="Your staff login identity. Name and role are managed by an admin under Staff."
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-stone-900 dark:text-stone-50">{user.name}</p>
          <p className="mt-0.5 truncate text-sm text-stone-600 dark:text-stone-300">{user.email}</p>
          {user.phone ? (
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{user.phone}</p>
          ) : null}
        </div>
        <span
          className={`inline-flex shrink-0 self-start rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${roleBadgeClass(user.role)}`}
        >
          {dashboardLabel(user.role)}
        </span>
      </div>
    </SettingsSection>
  );
}

function PasswordChangeSettings() {
  const { refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setMsg("");
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    setSaving(true);
    try {
      await api<{ user: User; message?: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await refreshUser();
      setMsg("Password updated. Other devices were signed out.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    currentPassword.length > 0 && newPassword.length >= 8 && confirmPassword.length > 0 && !saving;

  return (
    <SettingsSection
      id="setting-my-account-password"
      icon={KeyRound}
      title="Password"
      description="Change the password you use to sign in. This signs out other browsers and devices."
    >
      <p className="text-xs text-stone-600">
        Forgot your password? Use{" "}
        <Link href="/forgot-password" className="font-semibold text-brand-700 hover:underline">
          reset via email
        </Link>{" "}
        from the sign-in page.
      </p>
      <div className="grid max-w-md gap-3">
        <SettingsField label="Current password">
          <input
            type="password"
            className="input"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </SettingsField>
        <SettingsField label="New password" hint="At least 8 characters.">
          <input
            type="password"
            className="input"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </SettingsField>
        <SettingsField label="Confirm new password">
          <input
            type="password"
            className="input"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </SettingsField>
      </div>
      {msg && <p className="text-sm font-medium text-emerald-700">{msg}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button type="button" className="btn-primary mt-1" disabled={!canSave} onClick={() => void save()}>
        {saving ? "Updating…" : "Update password"}
      </button>
    </SettingsSection>
  );
}

function SessionSecuritySettings() {
  const { logout, logoutEverywhere } = useAuth();
  const router = useRouter();
  const [everywhereOpen, setEverywhereOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOutEverywhere() {
    setSigningOut(true);
    try {
      await logoutEverywhere();
      router.push("/login");
    } finally {
      setSigningOut(false);
      setEverywhereOpen(false);
    }
  }

  return (
    <>
      <SettingsSection
        id="setting-my-account-sessions"
        icon={MonitorSmartphone}
        title="Sessions"
        description="Control where your account stays signed in."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-2"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            <LogOut size={16} />
            Sign out on this device
          </button>
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-2 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            onClick={() => setEverywhereOpen(true)}
          >
            <LogOut size={16} />
            Sign out everywhere
          </button>
        </div>
        <p className="text-xs text-stone-500">
          &quot;Sign out everywhere&quot; invalidates all sessions, including POS tablets and other browsers.
        </p>
      </SettingsSection>

      <ConfirmSheet
        open={everywhereOpen}
        title="Sign out everywhere?"
        message="You will need to sign in again on this device. All other active sessions will stop immediately."
        confirmLabel="Sign out everywhere"
        danger
        saving={signingOut}
        onClose={() => !signingOut && setEverywhereOpen(false)}
        onConfirm={() => void signOutEverywhere()}
      />
    </>
  );
}

export function MyAccountSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <AccountProfileCard />
      <PasswordChangeSettings />
      <SessionSecuritySettings />
      <ApprovalPinSettings />
      {isAdmin ? (
        <p className="text-xs text-stone-600">
          Store-wide approval rules (who needs a manager PIN) are under{" "}
          <Link href={settingsPath("pos-controls-approvals")} className="font-semibold text-brand-700 hover:underline">
            POS controls and approvals
          </Link>
          .
        </p>
      ) : null}
      <TwoFactorSettings />
    </div>
  );
}
