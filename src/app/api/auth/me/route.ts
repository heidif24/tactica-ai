import { NextRequest, NextResponse } from "next/server";
import { getUsage, sessionEmail } from "@/lib/serverStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("lumen_session")?.value;
  const email = sessionEmail(token);
  if (!email) {
    return NextResponse.json({ authenticated: false });
  }
  const usage = getUsage(email);
  return NextResponse.json({
    authenticated: true,
    email,
    freeRemaining: usage.remaining,
    freeUsed: usage.count,
    month: usage.month,
  });
}
