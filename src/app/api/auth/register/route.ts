import { NextRequest, NextResponse } from "next/server";
import {
  createVerificationCode,
  isValidEmail,
  sendVerificationEmail,
} from "@/lib/serverStore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "");
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const code = createVerificationCode(email);
  const mail = await sendVerificationEmail(email, code);
  const payload: Record<string, unknown> = {
    ok: true,
    message: mail.sent
      ? "Check your inbox for a 6-digit code."
      : "Verification code generated. Check server logs if email is not configured.",
    emailSent: mail.sent,
  };
  // Only expose code when Resend is not configured (local/demo)
  if (!mail.sent && process.env.NODE_ENV !== "production") {
    payload.devCode = code;
  }
  // In production without Resend, still allow verify if operator reads logs;
  // optionally expose only with ALLOW_DEV_CODE=1
  if (!mail.sent && process.env.ALLOW_DEV_CODE === "1") {
    payload.devCode = code;
  }
  return NextResponse.json(payload);
}
