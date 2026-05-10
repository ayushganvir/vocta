import { NextResponse } from "next/server";

import { getProviderCapabilityMatrix } from "@/server/providers/capabilities";
import { providerModeFromEnv } from "@/server/providers/registry";

export async function GET() {
  return NextResponse.json({
    providerMode: providerModeFromEnv(),
    capabilities: getProviderCapabilityMatrix()
  });
}
