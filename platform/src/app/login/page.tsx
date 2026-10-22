"use client";

import { FormEvent, useState } from "react";
import { Shield } from "lucide-react";
import { usePlatformAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login, loading, user } = usePlatformAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent-900/40 via-slate-950 to-slate-950" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-600 text-white shadow-lg shadow-accent-600/30">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-white">Platform</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to manage tenants and billing</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur"
        >
          <label className="block text-sm">
            <span className="text-slate-300">Email</span>
            <input
              className="input mt-1.5 border-slate-700 bg-slate-950 text-white"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="mt-4 block text-sm">
            <span className="text-slate-300">Password</span>
            <input
              className="input mt-1.5 border-slate-700 bg-slate-950 text-white"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p> : null}
          <button type="submit" className="btn-primary mt-6 w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
