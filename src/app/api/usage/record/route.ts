import { NextRequest, NextResponse } from "next/server";
import { recordUsage, sessionEmail } from "@/lib/serverStore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("lumen_session")?.value;
  const email = sessionEmail(token);
  if (!email) {
    return NextResponse.json({ error: "Sign in with a verified email first." }, { status: 401 });
  }
  // Pro flag from body (demo) — production should check Stripe subscription by email
  const body = await req.json().catch(() => ({}));
  const isPro = Boolean(body.isPro);
  if (isPro) {
    return NextResponse.json({ ok: true, remaining: Infinity, pro: true });
  }
  const result = recordUsage(email);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "Free allowance used for this month (1 analysis). Upgrade to Pro for unlimited runs.",
        remaining: 0,
      },
      { status: 402 }
    );
  }
  return NextResponse.json({ ok: true, remaining: result.remaining });
}
