"use client";

import { FormEvent, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { PanelCard } from "@/components/PanelCard";

export function PlatformTwoFactorSettings() {
  const { user, refresh } = usePlatformAuth();
  const [secret, setSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function startSetup() {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const res = await api<{ secret: string; qrDataUrl: string }>("/auth/2fa/setup", { method: "POST" });
      setSecret(res.secret);
      setQrDataUrl(res.qrDataUrl);
      setMessage("Scan the QR code, then enter a code to enable.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start setup.");
    } finally {
      setBusy(false);
    }
  }

  async function enable(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api<{ recoveryCodes: string[] }>("/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setRecoveryCodes(res.recoveryCodes);
      setSecret("");
      setQrDataUrl("");
      setCode("");
      await refresh();
      setMessage("Two-factor authentication is on. Store your recovery codes somewhere safe.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid code.");
    } finally {
      setBusy(false);
    }
  }

  if (user?.totpEnabled) {
    return (
      <PanelCard title="Two-factor authentication">
        <p className="text-sm text-slate-500">Authenticator is enabled for your account.</p>
      </PanelCard>
    );
  }

  return (
    <PanelCard title="Two-factor authentication">
      {!qrDataUrl ? (
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void startSetup()}>
          Set up authenticator
        </button>
      ) : (
        <form onSubmit={enable} className="space-y-4">
          {qrDataUrl ? <img src={qrDataUrl} alt="Authenticator QR code" className="mx-auto rounded-lg bg-white p-2" width={220} height={220} /> : null}
          {secret ? (
            <p className="text-center font-mono text-xs text-slate-500">
              Manual key: <span className="select-all text-slate-300">{secret}</span>
            </p>
          ) : null}
          <label className="block text-sm">
            <span className="field-label">Verification code</span>
            <input className="input font-mono" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>Enable 2FA</button>
        </form>
      )}
      {recoveryCodes ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-200">Recovery codes (shown once)</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs text-amber-100">
            {recoveryCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-accent-400">{message}</p> : null}
      {error ? <p className="flash-error mt-3">{error}</p> : null}
    </PanelCard>
  );
}
