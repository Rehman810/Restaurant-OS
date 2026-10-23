"use client";

import { FormEvent, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { usePlatformAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login, verifyTwoFactor, loading, user } = usePlatformAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [step, setStep] = useState<"password" | "2fa">("password");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (step === "2fa") {
        await verifyTwoFactor(challengeToken, otp.trim());
        return;
      }
      const result = await login(email.trim(), password);
      if (!result.completed) {
        setChallengeToken(result.challengeToken);
        setStep("2fa");
        setOtp("");
        return;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel-surface relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-lg shadow-accent-600/30">
            <UtensilsCrossed className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-white">Restaurant OS</h1>
          <p className="mt-1 text-sm text-slate-400">Operator platform · sign in to manage tenants</p>
        </div>
        <form onSubmit={onSubmit} className="surface-card p-8">
          {step === "password" ? (
            <>
              <label className="block text-sm">
                <span className="field-label">Email</span>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="mt-4 block text-sm">
                <span className="field-label">Password</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
            </>
          ) : (
            <label className="block text-sm">
              <span className="field-label">Authenticator code</span>
              <input
                className="input font-mono tracking-widest"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code or recovery code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
              <p className="mt-2 text-xs text-slate-500">Use your authenticator app or a one-time recovery code.</p>
            </label>
          )}
          {error ? <p className="flash-error mt-4">{error}</p> : null}
          <button type="submit" className="btn-primary mt-6 w-full" disabled={submitting}>
            {submitting ? "Signing in…" : step === "2fa" ? "Verify" : "Sign in"}
          </button>
          {step === "2fa" ? (
            <button
              type="button"
              className="btn-ghost mt-3 w-full text-xs"
              onClick={() => {
                setStep("password");
                setChallengeToken("");
                setOtp("");
              }}
            >
              Back to password
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
