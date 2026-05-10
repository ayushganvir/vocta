import { AssetType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { serializePanel } from "@/app/api/scenes/_helpers";
import { prisma, selectPanelAsset } from "@/server/db";

const selectAssetSchema = z.object({
  panelId: z.string().min(1),
  assetId: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = selectAssetSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid asset selection payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const asset = await prisma.generatedAsset.findFirst({
    where: {
      id: parsed.data.assetId,
      panelId: parsed.data.panelId
    }
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found for panel." }, { status: 404 });
  }

  if (asset.assetType === AssetType.IMAGE) {
    const frameRole = readFrameRole(asset.metadata);

    if (frameRole === "first_frame") {
      await selectFrameAsset(parsed.data.panelId, asset.id, "firstFrameAssetId");
    } else if (frameRole === "last_frame") {
      await selectFrameAsset(parsed.data.panelId, asset.id, "lastFrameAssetId");
    } else {
      await selectPrimaryImageAsset(parsed.data.panelId, asset.id);
    }
  } else if (asset.assetType === AssetType.VIDEO || asset.assetType === AssetType.AUDIO) {
    await selectPanelAsset(prisma, parsed.data.panelId, asset.id, asset.assetType);
  } else {
    return NextResponse.json({ error: "Only image, video, and audio assets can be selected for export." }, { status: 400 });
  }

  const panel = await prisma.panel.findUniqueOrThrow({
    where: { id: parsed.data.panelId },
    include: {
      generatedAssets: { orderBy: { createdAt: "desc" } },
      generationJobs: { orderBy: { createdAt: "desc" }, take: 12 }
    }
  });

  return NextResponse.json({ panel: serializePanel(panel) });
}

async function selectFrameAsset(
  panelId: string,
  assetId: string,
  field: "firstFrameAssetId" | "lastFrameAssetId"
) {
  const current = await prisma.panel.findUnique({
    where: { id: panelId },
    select: { firstFrameAssetId: true, lastFrameAssetId: true }
  });
  const currentAssetId = field === "firstFrameAssetId" ? current?.firstFrameAssetId : current?.lastFrameAssetId;

  if (currentAssetId) {
    await prisma.generatedAsset.update({
      where: { id: currentAssetId },
      data: { isSelected: false }
    }).catch(() => null);
  }

  await prisma.generatedAsset.update({
    where: { id: assetId },
    data: { isSelected: true }
  });
  await prisma.panel.update({
    where: { id: panelId },
    data: { [field]: assetId }
  });
}

async function selectPrimaryImageAsset(panelId: string, assetId: string) {
  const current = await prisma.panel.findUnique({
    where: { id: panelId },
    select: { selectedImageAssetId: true }
  });

  if (current?.selectedImageAssetId) {
    await prisma.generatedAsset.update({
      where: { id: current.selectedImageAssetId },
      data: { isSelected: false }
    }).catch(() => null);
  }

  await prisma.generatedAsset.update({
    where: { id: assetId },
    data: { isSelected: true }
  });
  await prisma.panel.update({
    where: { id: panelId },
    data: { selectedImageAssetId: assetId }
  });
}

function readFrameRole(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const frameRole = (metadata as Record<string, unknown>).frameRole;
  return typeof frameRole === "string" ? frameRole : "";
}
