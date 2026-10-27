import { NextRequest, NextResponse } from "next/server";
import { createSession, isValidEmail, verifyCode } from "@/lib/serverStore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "");
  const code = String(body.code || "");
  if (!isValidEmail(email) || !code) {
    return NextResponse.json({ error: "Email and code required." }, { status: 400 });
  }
  if (!verifyCode(email, code)) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
  }
  const token = createSession(email);
  const res = NextResponse.json({ ok: true, email: email.trim().toLowerCase() });
  res.cookies.set("lumen_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
