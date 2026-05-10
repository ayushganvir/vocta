import { NextResponse } from "next/server";
import { z } from "zod";

import { checkProviderHealth } from "@/server/providers/health-check";

const providerHealthCheckSchema = z.object({
  provider: z.string().trim().min(1),
  kind: z.enum(["text", "image", "video", "audio"]),
  model: z.string().trim().min(1).optional(),
  live: z.boolean().optional()
});

export async function POST(request: Request) {
  const parsed = providerHealthCheckSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider health-check payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await checkProviderHealth(parsed.data);
  const status = result.status === "failed" ? 400 : 200;

  return NextResponse.json(result, { status });
}
