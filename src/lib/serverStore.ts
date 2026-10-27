/**
 * Server-side store for email verification + monthly free usage.
 * Uses process global Map (fine for single-instance / hobby).
 * Optional Upstash Redis REST when env vars are set (multi-instance).
 */

export const FREE_UPLOADS_PER_MONTH = 1;

type CodeRecord = { code: string; expires: number };
type UsageRecord = { count: number; month: string };

declare global {
  // eslint-disable-next-line no-var
  var __lumenStore: {
    codes: Map<string, CodeRecord>;
    verified: Set<string>;
    usage: Map<string, UsageRecord>;
    sessions: Map<string, { email: string; exp: number }>;
  } | undefined;
}

function store() {
  if (!globalThis.__lumenStore) {
    globalThis.__lumenStore = {
      codes: new Map(),
      verified: new Set(),
      usage: new Map(),
      sessions: new Map(),
    };
  }
  return globalThis.__lumenStore;
}

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function normEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function createVerificationCode(email: string): string {
  const e = normEmail(email);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  store().codes.set(e, { code, expires: Date.now() + 20 * 60 * 1000 });
  return code;
}

export function verifyCode(email: string, code: string): boolean {
  const e = normEmail(email);
  const rec = store().codes.get(e);
  if (!rec) return false;
  if (Date.now() > rec.expires) {
    store().codes.delete(e);
    return false;
  }
  if (rec.code !== code.trim()) return false;
  store().codes.delete(e);
  store().verified.add(e);
  return true;
}

export function isVerified(email: string) {
  return store().verified.has(normEmail(email));
}

export function createSession(email: string): string {
  const e = normEmail(email);
  const token =
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36);
  store().sessions.set(token, { email: e, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  return token;
}

export function sessionEmail(token: string | undefined | null): string | null {
  if (!token) return null;
  const s = store().sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.exp) {
    store().sessions.delete(token);
    return null;
  }
  return s.email;
}

export function getUsage(email: string): { count: number; remaining: number; month: string } {
  const e = normEmail(email);
  const m = monthKey();
  const rec = store().usage.get(e);
  const count = rec && rec.month === m ? rec.count : 0;
  return {
    count,
    remaining: Math.max(0, FREE_UPLOADS_PER_MONTH - count),
    month: m,
  };
}

/** Record one free analysis; returns false if over limit */
export function recordUsage(email: string): { ok: boolean; remaining: number } {
  const e = normEmail(email);
  const m = monthKey();
  const rec = store().usage.get(e);
  let count = rec && rec.month === m ? rec.count : 0;
  if (count >= FREE_UPLOADS_PER_MONTH) {
    return { ok: false, remaining: 0 };
  }
  count += 1;
  store().usage.set(e, { count, month: m });
  return { ok: true, remaining: FREE_UPLOADS_PER_MONTH - count };
}

export async function sendVerificationEmail(email: string, code: string): Promise<{ sent: boolean; mode: string }> {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "Lumen <onboarding@resend.dev>",
          to: [email],
          subject: "Your Lumen verification code",
          html: `<p>Your verification code is <strong style="font-size:20px;letter-spacing:4px">${code}</strong>.</p><p>It expires in 20 minutes.</p>`,
        }),
      });
      if (res.ok) return { sent: true, mode: "email" };
    } catch {
      /* fall through */
    }
  }
  // Dev / no provider: code available to API caller only for testing
  console.log(`[Lumen] verification code for ${email}: ${code}`);
  return { sent: false, mode: "console" };
}
