"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import { Shield } from "lucide-react";

export function ApprovalPinSettings() {
  const { user } = useAuth();
  const allowed = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!allowed) return null;

  async function save() {
    setSaving(true);
    setMsg("");
    setError("");
    try {
      await api("/admin/staff/me/approval-pin", {
        method: "PATCH",
        body: JSON.stringify({ pin }),
      });
      setMsg("Approval PIN updated.");
      setPin("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save PIN.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      icon={Shield}
      title="Manager approval PIN"
      description="4–6 digit PIN used to approve voids, discounts, and refunds at the POS."
    >
      <SettingsField label="New PIN" hint="Never share this PIN with cashiers.">
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          className="input max-w-xs"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
      </SettingsField>
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button type="button" className="btn-primary mt-2" disabled={saving || pin.length < 4} onClick={() => void save()}>
        {saving ? "Saving…" : "Save PIN"}
      </button>
    </SettingsSection>
  );
}
