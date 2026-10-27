import { NextRequest, NextResponse } from "next/server";
import { countryFromHeaders, localizePrice } from "@/lib/geo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const country = countryFromHeaders(req.headers);
  const price = localizePrice(country);
  return NextResponse.json(price);
}
