"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { SettingsSection } from "@/components/admin/SettingsSection";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function TwoFactorSettings() {
  const { user } = useAuth();
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");
  const [enabled, setEnabled] = useState(Boolean(user?.totpEnabled));
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEnabled(Boolean(user?.totpEnabled));
  }, [user?.totpEnabled]);

  function notify(text: string, tone: "ok" | "err" = "ok") {
    setMsg(text);
    setMsgTone(tone);
  }

  async function setup() {
    notify("");
    try {
      const data = await api<{ qrDataUrl: string; secret: string }>("/auth/2fa/setup", { method: "POST" });
      setQr(data.qrDataUrl);
      setSecret(data.secret);
      setCode("");
      setRecoveryCodes([]);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not start setup.", "err");
    }
  }

  async function enable() {
    notify("");
    try {
      const data = await api<{ ok: boolean; recoveryCodes?: string[] }>("/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setEnabled(true);
      setQr("");
      setSecret("");
      setCode("");
      setRecoveryCodes(data.recoveryCodes || []);
      notify("Two-factor is on. Save your recovery codes below — they will not be shown again.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Invalid code.", "err");
    }
  }

  async function disable() {
    notify("");
    try {
      await api("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ code }) });
      setEnabled(false);
      setCode("");
      setRecoveryCodes([]);
      notify("Authenticator disabled.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not disable.", "err");
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify("Could not copy secret.", "err");
    }
  }

  return (
    <SettingsSection
      id="setting-my-account-two-factor"
      icon={Shield}
      title="Google Authenticator"
      description="Add a 6-digit app code for admin sign-in. Required after setup on every login."
    >
      {enabled && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
            <ShieldCheck size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-900">Two-factor authentication is active</p>
            <p className="mt-0.5 text-xs text-emerald-700/80">Your account requires an authenticator code at sign-in.</p>
          </div>
        </div>
      )}

      {msg && (
        <p
          className={`mb-4 rounded-2xl px-4 py-3 text-sm font-medium ${
            msgTone === "err" ? "bg-red-50 text-red-800" : "bg-brand-50 text-brand-900"
          }`}
        >
          {msg}
        </p>
      )}

      {recoveryCodes.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-[#fffaf5]">
          <div className="border-b border-amber-100 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-950">
              <KeyRound size={16} className="text-amber-700" />
              Recovery codes — save these now
            </p>
            <p className="mt-0.5 text-xs text-amber-800/80">
              Each code works once if you lose your phone. Store them somewhere safe offline.
            </p>
          </div>
          <ul className="grid gap-2 p-4 sm:grid-cols-2">
            {recoveryCodes.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-amber-100 bg-white px-3 py-2 font-mono text-sm tracking-wide text-stone-800 shadow-sm"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {enabled ? (
        <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 sm:p-5">
          <p className="text-sm font-semibold text-stone-900">Disable authenticator</p>
          <p className="mt-1 text-xs text-stone-500">Enter a current code from your app to turn off 2FA.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                Authenticator code
              </label>
              <input
                className="input text-center font-mono tracking-[0.3em]"
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <button type="button" onClick={disable} className="btn-ghost shrink-0 text-red-700 hover:bg-red-50 hover:text-red-800">
              <Trash2 size={16} />
              Disable 2FA
            </button>
          </div>
        </div>
      ) : !qr ? (
        <div className="overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-[#fffaf5] via-white to-brand-50/40 dark:border-stone-700 dark:from-stone-900 dark:via-stone-900 dark:to-stone-800">
          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-50">Secure your admin account</p>
              <p className="mt-1 max-w-lg text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                Use Google Authenticator, Authy, or any TOTP app. Setup takes about a minute.
              </p>
              <ol className="mt-4 space-y-2.5">
                {[
                  { step: "1", text: "Tap set up and scan the QR code" },
                  { step: "2", text: "Enter the 6-digit code to confirm" },
                  { step: "3", text: "Save the one-time recovery codes" },
                ].map(({ step, text }) => (
                  <li key={step} className="flex items-center gap-3 text-sm text-stone-700 dark:text-stone-300">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-900/50 dark:text-brand-300">
                      {step}
                    </span>
                    {text}
                  </li>
                ))}
              </ol>
            </div>
            <button type="button" onClick={setup} className="btn-primary h-12 shrink-0 px-6 shadow-md shadow-brand-500/20">
              <Smartphone size={18} />
              Set up authenticator
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-800">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-stone-500">Scan QR code</p>
            <div className="mx-auto grid place-items-center rounded-xl bg-white p-2 ring-1 ring-stone-100 dark:bg-stone-900 dark:ring-stone-600">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Authenticator QR code" className="h-40 w-40 sm:h-44 sm:w-44" />
            </div>
            <p className="mt-3 text-center text-[11px] text-stone-400">Google Authenticator · Authy · 1Password</p>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
              <p className="text-sm font-semibold text-stone-900">Can&apos;t scan?</p>
              <p className="mt-1 text-xs text-stone-500">Enter this key manually in your authenticator app.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <code className="min-w-0 flex-1 break-all rounded-xl border border-stone-200 bg-white px-3 py-2.5 font-mono text-xs text-stone-800">
                  {secret}
                </code>
                <button
                  type="button"
                  onClick={copySecret}
                  className="btn-ghost shrink-0 justify-center sm:w-auto"
                >
                  <Copy size={16} />
                  {copied ? "Copied" : "Copy key"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                Step 2 — Enter 6-digit code
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <input
                  className="input max-w-xs text-center font-mono text-lg tracking-[0.35em]"
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <button
                  type="button"
                  onClick={enable}
                  disabled={code.length !== 6}
                  className="btn-primary h-12 shrink-0 px-6 disabled:opacity-50"
                >
                  <CheckCircle2 size={18} />
                  Confirm and enable
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
