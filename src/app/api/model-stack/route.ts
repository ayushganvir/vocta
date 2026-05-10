import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { modelStackSchema } from "@/features/model-stack/schema";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const modelStack = await prisma.modelStack.upsert({
    where: { projectId },
    update: {},
    create: { projectId }
  });

  return NextResponse.json({ modelStack: serializeModelStack(modelStack) });
}

export async function PATCH(request: Request) {
  const parsed = modelStackSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid model stack payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { projectId, providerSettings, defaultVoiceId, ...data } = parsed.data;
  const modelStack = await prisma.modelStack.upsert({
    where: { projectId },
    create: {
      projectId,
      ...data,
      defaultVoiceId: defaultVoiceId?.trim() || null,
      providerSettings: providerSettings as Prisma.InputJsonValue
    },
    update: {
      ...data,
      defaultVoiceId: defaultVoiceId?.trim() || null,
      providerSettings: providerSettings as Prisma.InputJsonValue
    }
  });

  return NextResponse.json({ modelStack: serializeModelStack(modelStack) });
}

function serializeModelStack(modelStack: {
  id: string;
  projectId: string;
  textProvider: string;
  textModel: string;
  imageProvider: string;
  imageModel: string;
  videoProvider: string;
  videoModel: string;
  voiceProvider: string;
  voiceModel: string;
  defaultVoiceId: string | null;
  providerSettings: Prisma.JsonValue;
}) {
  return {
    ...modelStack,
    providerSettings: modelStack.providerSettings && typeof modelStack.providerSettings === "object" && !Array.isArray(modelStack.providerSettings)
      ? modelStack.providerSettings
      : {}
  };
}

