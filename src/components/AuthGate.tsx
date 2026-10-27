"use client";

import { useEffect, useState } from "react";
import { Mail, ShieldCheck, Loader2 } from "lucide-react";

export interface AuthUser {
  email: string;
  freeRemaining: number;
  freeUsed: number;
}

export function AuthGate({
  onReady,
}: {
  onReady: (user: AuthUser | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) {
          onReady({ email: d.email, freeRemaining: d.freeRemaining, freeUsed: d.freeUsed });
        } else {
          onReady(null);
        }
      })
      .catch(() => onReady(null))
      .finally(() => setChecking(false));
  }, [onReady]);

  const requestCode = async () => {
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send code");
      setStep("code");
      setHint(
        data.devCode
          ? `Demo code: ${data.devCode} (email provider not configured)`
          : data.message
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      const me = await fetch("/api/auth/me").then((r) => r.json());
      onReady({
        email: me.email,
        freeRemaining: me.freeRemaining,
        freeUsed: me.freeUsed,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="flex h-40 items-center justify-center text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-lumen-200 bg-gradient-to-br from-lumen-50 to-white p-6 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lumen-100 text-lumen-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-ink-950">Verify your email to continue</h3>
          <p className="mt-1 text-sm text-ink-600">
            Free plan: <strong>1 analysis per month</strong> per verified email. This stops duplicate free accounts from the same inbox.
          </p>

          {step === "email" && (
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-ink-600">
                Email
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-lumen-400 focus:ring-2 focus:ring-lumen-100"
                  />
                </div>
              </label>
              <button
                disabled={busy || !email.includes("@")}
                onClick={requestCode}
                className="btn-primary w-full disabled:opacity-40"
              >
                {busy ? "Sending…" : "Send verification code"}
              </button>
            </div>
          )}

          {step === "code" && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-ink-500">Code sent to <strong>{email}</strong></p>
              {hint && <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{hint}</p>}
              <label className="block text-xs font-medium text-ink-600">
                6-digit code
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-center text-lg tracking-[0.3em] outline-none focus:border-lumen-400"
                />
              </label>
              <button disabled={busy || code.length < 6} onClick={verify} className="btn-primary w-full disabled:opacity-40">
                {busy ? "Checking…" : "Verify & continue"}
              </button>
              <button type="button" className="text-xs text-lumen-700 underline" onClick={() => setStep("email")}>
                Use a different email
              </button>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
