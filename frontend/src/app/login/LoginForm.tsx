"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Flame, Lock, Mail, ShieldCheck } from "lucide-react";
import { StoreName } from "@/components/StoreName";
import { homeFor, resolveLoginRedirect, useAuth } from "@/lib/auth";
import { PRODUCT_NAME, storeDisplayName } from "@/lib/branding";
import { useStore } from "@/lib/store";
import { DEMO_LOGIN_ACCOUNTS, isDemoLoginEnabled } from "@/lib/demo-login";

export default function LoginForm({ staff = false }: { staff?: boolean }) {
  const store = useStore();
  const brand = storeDisplayName(store?.settings) || PRODUCT_NAME;
  const { user, loading, login, verifyTwoFactor } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const resetDone = useSearchParams().get("reset") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (!staff && user.role !== "CUSTOMER") {
      router.replace(homeFor(user.role));
      return;
    }
    if (staff && user.role === "CUSTOMER") {
      router.replace("/menu");
      return;
    }
    router.replace(resolveLoginRedirect(user.role, next));
  }, [loading, user, next, router, staff]);

  async function signIn(asEmail: string, asPassword: string, ignoreNext = false) {
    setBusy(true);
    setError("");
    try {
      const result = await login(asEmail, asPassword);
      if ("requiresTwoFactor" in result && result.requiresTwoFactor) {
        setChallenge(result.challengeToken);
        return;
      }
      const dest = ignoreNext ? homeFor(result.user.role) : resolveLoginRedirect(result.user.role, next);
      router.replace(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (challenge) {
      setBusy(true);
      setError("");
      try {
        const user = await verifyTwoFactor(challenge, otp);
        router.replace(resolveLoginRedirect(user.role, next));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid code");
      } finally {
        setBusy(false);
      }
      return;
    }
    await signIn(email, password);
  }

  return (
    <div className="grid min-h-screen bg-[#fffaf5] lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/carousel/carousel-zinger.png)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-stone-950/90 via-stone-950/55 to-brand-900/35" />
        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-3 text-white">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 shadow-lg">
              <Flame size={22} />
            </span>
            <div>
              <p className="font-display text-2xl leading-none">{brand}</p>
              <p className="mt-1 text-sm text-orange-100/80">{PRODUCT_NAME}</p>
            </div>
          </div>

          <div className="max-w-md text-white">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-300">Staff access</p>
            <h2 className="font-display mt-3 text-4xl leading-tight xl:text-5xl">
              Run the kitchen.
              <br />
              <span className="text-brand-400">Deliver hot.</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-stone-300">
              Sign in to manage orders, update the menu, and keep the kitchen moving.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {["Live orders", "Menu control", "Rider dispatch"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-stone-200 backdrop-blur-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs text-stone-400">© {brand}</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 lg:px-10 lg:py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 transition hover:text-brand-700"
          >
            <ArrowLeft size={16} />
            Back to menu
          </Link>
          <div className="flex items-center gap-2 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
              <Flame size={18} />
            </span>
            <StoreName className="font-display text-lg" fallback={PRODUCT_NAME} />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-10 pt-2 lg:px-10">
          <div className="w-full max-w-md">
            <div className="rounded-3xl border border-orange-100/80 bg-white p-6 shadow-[0_12px_40px_rgba(28,25,23,0.06)] sm:p-8">
              <div className="mb-6">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
                  <ShieldCheck size={14} />
                  Secure sign in
                </div>
                <h1 className="font-display text-3xl text-stone-900 sm:text-4xl">Welcome back</h1>
                <p className="mt-2 text-sm text-stone-500">
                  {staff ? "Staff sign in for the kitchen, counter, and riders." : "Sign in to track orders and reorder faster."}
                </p>
              </div>

              {resetDone && (
                <p className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Password updated. Sign in with your new password.
                </p>
              )}

              {error && (
                <p className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <form onSubmit={onSubmit} className="space-y-4">
                {challenge ? (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Authenticator code
                    </span>
                    <input
                      className="input"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      required
                    />
                  </label>
                ) : (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Email
                      </span>
                      <div className="flex overflow-hidden rounded-2xl border border-stone-200 bg-white transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
                        <span className="grid w-12 shrink-0 place-items-center border-r border-stone-100 bg-stone-50 text-stone-400">
                          <Mail size={16} />
                        </span>
                        <input
                          className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-stone-400"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          type="email"
                          autoComplete="email"
                          placeholder="you@email.com"
                          required
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Password
                      </span>
                      <div className="flex overflow-hidden rounded-2xl border border-stone-200 bg-white transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
                        <span className="grid w-12 shrink-0 place-items-center border-r border-stone-100 bg-stone-50 text-stone-400">
                          <Lock size={16} />
                        </span>
                        <input
                          className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-stone-400"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          type="password"
                          autoComplete="current-password"
                          placeholder="••••••••"
                          required
                        />
                      </div>
                    </label>
                  </>
                )}

                <button className="btn-primary h-12 w-full text-base shadow-float" disabled={busy}>
                  {busy ? "Signing in…" : challenge ? "Verify code" : "Sign in"}
                </button>
              </form>

              {isDemoLoginEnabled() && !challenge && (
                <div className="mt-4 rounded-2xl border border-dashed border-stone-200 bg-stone-50/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Dev quick sign-in</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DEMO_LOGIN_ACCOUNTS.map((acct) => (
                      <button
                        key={acct.email}
                        type="button"
                        disabled={busy}
                        className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-brand-300 hover:text-brand-800"
                        onClick={() => void signIn(acct.email, acct.password, staff)}
                      >
                        {acct.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link href="/forgot-password" className="font-semibold text-brand-700 hover:underline">
                  Forgot password?
                </Link>
                <Link
                  href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
                  className="font-semibold text-stone-600 hover:text-brand-700 hover:underline"
                >
                  Create customer account
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
