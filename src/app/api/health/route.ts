import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "vocta",
    providerMode: process.env.PROVIDER_MODE ?? "fake"
  });
}

