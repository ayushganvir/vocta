import { NextRequest, NextResponse } from "next/server";

import { LocalStorageDriver } from "@/server/storage/local";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const storagePath = path.join("/");
  const storage = new LocalStorageDriver();

  try {
    const object = await storage.getObject(storagePath);
    const contentType = inferContentType(object.path);

    return new NextResponse(object.bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60"
      }
    });
  } catch {
    return NextResponse.json({ error: "Stored object not found." }, { status: 404 });
  }
}

function inferContentType(path: string) {
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".mp3")) return "audio/mpeg";
  if (path.endsWith(".wav")) return "audio/wav";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".csv")) return "text/csv";
  return "application/octet-stream";
}
