import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "vocta",
    status: "ready",
    scaffold: {
      app: "next",
      database: "prisma-sqlite",
      queue: "bullmq-redis",
      storage: process.env.STORAGE_DRIVER ?? "local",
      providerMode: process.env.PROVIDER_MODE ?? "fake"
    },
    checks: {
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      redisConfigured: Boolean(process.env.REDIS_URL),
      manualAiActionsOnly: true
    }
  });
}
