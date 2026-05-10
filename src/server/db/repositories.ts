import {
  AssetType,
  ExportPackageStatus,
  GenerationJobType,
  JobStatus,
  Prisma,
  PrismaClient,
  ProjectStatus,
  PromptPurpose,
  SourceMaterialType
} from "@prisma/client";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export const DEFAULT_PROJECT_ASPECT_RATIO = "9:16";
export const MVP_ENTITY_TYPES = ["character", "place", "object"] as const;

type CreateProjectInput = {
  teamId: string;
  createdById: string;
  title: string;
  slug: string;
  description?: string | null;
  aspectRatio?: string;
};

export async function createProject(db: DbClient, input: CreateProjectInput) {
  return db.project.create({
    data: {
      teamId: input.teamId,
      createdById: input.createdById,
      title: input.title,
      slug: input.slug,
      description: input.description,
      aspectRatio: input.aspectRatio ?? DEFAULT_PROJECT_ASPECT_RATIO,
      modelStack: { create: {} },
      styleBible: { create: {} }
    },
    include: {
      modelStack: true,
      styleBible: true
    }
  });
}

export async function listProjects(db: DbClient, teamId: string) {
  return db.project.findMany({
    where: { teamId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          scenes: true,
          panels: true,
          generatedAssets: true
        }
      }
    }
  });
}

export async function getProjectWorkspace(db: DbClient, projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    include: {
      modelStack: true,
      styleBible: true,
      sourceMaterials: { orderBy: { createdAt: "asc" } },
      entities: { orderBy: [{ type: "asc" }, { name: "asc" }] },
      scenes: {
        orderBy: { orderIndex: "asc" },
        include: {
          panels: { orderBy: { orderIndex: "asc" } }
        }
      }
    }
  });
}

export async function archiveProject(db: DbClient, projectId: string) {
  return db.project.update({
    where: { id: projectId },
    data: { status: ProjectStatus.ARCHIVED }
  });
}

type AddSourceMaterialInput = {
  projectId: string;
  createdById: string;
  type: SourceMaterialType;
  title: string;
  bodyText?: string | null;
  url?: string | null;
  fileAssetId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function addSourceMaterial(db: DbClient, input: AddSourceMaterialInput) {
  return db.sourceMaterial.create({
    data: {
      projectId: input.projectId,
      createdById: input.createdById,
      type: input.type,
      title: input.title,
      bodyText: input.bodyText,
      url: input.url,
      fileAssetId: input.fileAssetId,
      metadata: input.metadata ?? {}
    }
  });
}

export async function listSourceMaterials(db: DbClient, projectId: string) {
  return db.sourceMaterial.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { fileAsset: true }
  });
}

type StyleBiblePatchInput = {
  charactersText?: string | null;
  placesText?: string | null;
  objectsText?: string | null;
  visualStyle?: string | null;
  colorPalette?: string | null;
  lightingStyle?: string | null;
  cameraStyle?: string | null;
  negativePromptRules?: string | null;
  globalReferenceAssetIds?: Prisma.InputJsonValue;
  notes?: string | null;
};

export async function upsertStyleBible(db: DbClient, projectId: string, data: StyleBiblePatchInput) {
  return db.styleBible.upsert({
    where: { projectId },
    update: data,
    create: {
      projectId,
      ...data
    }
  });
}

export async function getStyleBible(db: DbClient, projectId: string) {
  return db.styleBible.findUnique({ where: { projectId } });
}

type CreateEntityInput = {
  projectId: string;
  name: string;
  type: string;
  description?: string | null;
  visualPromptBlock?: string | null;
  notes?: string | null;
  selectedReferenceAssetId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function createEntity(db: DbClient, input: CreateEntityInput) {
  return db.entity.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      type: input.type,
      description: input.description,
      visualPromptBlock: input.visualPromptBlock,
      notes: input.notes,
      selectedReferenceAssetId: input.selectedReferenceAssetId,
      metadata: input.metadata ?? {}
    }
  });
}

export async function listEntities(db: DbClient, projectId: string) {
  return db.entity.findMany({
    where: { projectId },
    orderBy: [{ type: "asc" }, { name: "asc" }]
  });
}

export async function createScene(
  db: DbClient,
  input: Prisma.SceneUncheckedCreateInput
) {
  return db.scene.create({ data: input });
}

export async function listScenesWithPanels(db: DbClient, projectId: string) {
  return db.scene.findMany({
    where: { projectId },
    orderBy: { orderIndex: "asc" },
    include: {
      panels: {
        orderBy: { orderIndex: "asc" },
        include: {
          generatedAssets: { orderBy: { createdAt: "desc" } },
          generationJobs: { orderBy: { createdAt: "desc" }, take: 12 }
        }
      }
    }
  });
}

type CreatePanelInput = {
  projectId: string;
  sceneId: string;
  title: string;
  orderIndex?: number;
  narrationText?: string | null;
  visualIntent?: string | null;
  motionIntent?: string | null;
  notes?: string | null;
};

export async function createPanel(db: DbClient, input: CreatePanelInput) {
  const orderIndex =
    input.orderIndex ??
    ((await db.panel.count({ where: { sceneId: input.sceneId } })) + 1);

  return db.panel.create({
    data: {
      projectId: input.projectId,
      sceneId: input.sceneId,
      orderIndex,
      title: input.title,
      narrationText: input.narrationText,
      visualIntent: input.visualIntent,
      motionIntent: input.motionIntent,
      notes: input.notes
    }
  });
}

export async function reorderScenePanels(
  db: DbClient,
  sceneId: string,
  orderedPanelIds: string[]
) {
  for (const [index, panelId] of orderedPanelIds.entries()) {
    await db.panel.update({
      where: { id: panelId },
      data: { orderIndex: -(index + 1) }
    });
  }

  return db.panel.findMany({
    where: { sceneId },
    orderBy: { orderIndex: "desc" }
  }).then(async (panels) => {
    for (const [index, panel] of panels.entries()) {
      await db.panel.update({
        where: { id: panel.id },
        data: { orderIndex: index + 1 }
      });
    }

    return db.panel.findMany({
      where: { sceneId },
      orderBy: { orderIndex: "asc" }
    });
  });
}

export async function listPanels(db: DbClient, sceneId: string) {
  return db.panel.findMany({
    where: { sceneId },
    orderBy: { orderIndex: "asc" },
    include: {
      generatedAssets: { orderBy: { createdAt: "desc" } },
      generationJobs: { orderBy: { createdAt: "desc" }, take: 12 }
    }
  });
}

export async function addPromptLayer(
  db: DbClient,
  data: Prisma.PromptLayerUncheckedCreateInput
) {
  return db.promptLayer.create({ data });
}

export async function listPanelPromptLayers(db: DbClient, panelId: string) {
  return db.promptLayer.findMany({
    where: { panelId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
}

export async function createPromptCompilation(
  db: DbClient,
  data: Prisma.PromptCompilationUncheckedCreateInput
) {
  return db.promptCompilation.create({ data });
}

type CreateGenerationJobInput = {
  projectId: string;
  panelId?: string | null;
  type: GenerationJobType;
  provider: string;
  model: string;
  createdById?: string | null;
  compiledPrompt?: string | null;
  inputLayers?: Prisma.InputJsonValue;
  attachedReferenceAssetIds?: Prisma.InputJsonValue;
  requestPayload?: Prisma.InputJsonValue;
};

export async function createGenerationJob(db: DbClient, input: CreateGenerationJobInput) {
  return db.generationJob.create({
    data: {
      projectId: input.projectId,
      panelId: input.panelId,
      type: input.type,
      provider: input.provider,
      model: input.model,
      createdById: input.createdById,
      compiledPrompt: input.compiledPrompt,
      inputLayers: input.inputLayers ?? [],
      attachedReferenceAssetIds: input.attachedReferenceAssetIds ?? [],
      requestPayload: input.requestPayload ?? {}
    }
  });
}

export async function updateGenerationJobStatus(
  db: DbClient,
  id: string,
  status: JobStatus,
  patch: Omit<Prisma.GenerationJobUncheckedUpdateInput, "status"> = {}
) {
  const timestamps: Prisma.GenerationJobUncheckedUpdateInput = {};

  if (status === JobStatus.RUNNING) {
    timestamps.startedAt = new Date();
  }

  if (
    status === JobStatus.COMPLETED ||
    status === JobStatus.FAILED ||
    status === JobStatus.CANCELLED
  ) {
    timestamps.completedAt = new Date();
  }

  return db.generationJob.update({
    where: { id },
    data: {
      ...patch,
      ...timestamps,
      status
    }
  });
}

type CreateGeneratedAssetInput = {
  projectId: string;
  panelId?: string | null;
  entityId?: string | null;
  generationJobId?: string | null;
  assetType: AssetType;
  fileUrl: string;
  previewUrl?: string | null;
  storagePath: string;
  mimeType: string;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  isSelected?: boolean;
  metadata?: Prisma.InputJsonValue;
};

export async function createGeneratedAsset(db: DbClient, input: CreateGeneratedAssetInput) {
  return db.generatedAsset.create({
    data: {
      projectId: input.projectId,
      panelId: input.panelId,
      entityId: input.entityId,
      generationJobId: input.generationJobId,
      assetType: input.assetType,
      fileUrl: input.fileUrl,
      previewUrl: input.previewUrl,
      storagePath: input.storagePath,
      mimeType: input.mimeType,
      durationSeconds: input.durationSeconds,
      width: input.width,
      height: input.height,
      isSelected: input.isSelected ?? false,
      metadata: input.metadata ?? {}
    }
  });
}

export async function selectPanelAsset(
  db: DbClient,
  panelId: string,
  assetId: string,
  assetType: AssetType
) {
  await db.generatedAsset.updateMany({
    where: { panelId, assetType },
    data: { isSelected: false }
  });

  const asset = await db.generatedAsset.update({
    where: { id: assetId },
    data: { isSelected: true }
  });

  const panelSelection = panelSelectionField(assetType);
  if (panelSelection) {
    await db.panel.update({
      where: { id: panelId },
      data: { [panelSelection]: assetId }
    });
  }

  return asset;
}

function panelSelectionField(assetType: AssetType) {
  if (assetType === AssetType.IMAGE) return "selectedImageAssetId";
  if (assetType === AssetType.VIDEO) return "selectedVideoAssetId";
  if (assetType === AssetType.AUDIO) return "selectedAudioAssetId";
  return null;
}

export async function createChatThread(
  db: DbClient,
  data: Prisma.ChatThreadUncheckedCreateInput
) {
  return db.chatThread.create({ data });
}

export async function addChatMessage(
  db: DbClient,
  data: Prisma.ChatMessageUncheckedCreateInput
) {
  return db.chatMessage.create({ data });
}

export async function createTimelineManifest(
  db: DbClient,
  data: Prisma.TimelineManifestUncheckedCreateInput
) {
  return db.timelineManifest.create({ data });
}

export async function createExportPackage(
  db: DbClient,
  input: Omit<Prisma.ExportPackageUncheckedCreateInput, "status"> & {
    status?: ExportPackageStatus;
  }
) {
  return db.exportPackage.create({
    data: {
      ...input,
      status: input.status ?? ExportPackageStatus.QUEUED
    }
  });
}

export function promptPurposeForAssetType(assetType: AssetType): PromptPurpose {
  if (assetType === AssetType.IMAGE) return PromptPurpose.IMAGE;
  if (assetType === AssetType.VIDEO) return PromptPurpose.VIDEO;
  if (assetType === AssetType.AUDIO) return PromptPurpose.AUDIO;
  return PromptPurpose.TEXT;
}
