import { NextResponse } from "next/server";

import { listGoogleVoices } from "@/server/providers/google-voices";

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const result = await listGoogleVoices({
    language: search.get("language"),
    gender: search.get("gender"),
    family: search.get("family")
  });

  return NextResponse.json(result);
}
