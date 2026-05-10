import { AssetType, ExportPackageStatus, Prisma } from "@prisma/client";

import {
  createExportPackage,
  createGeneratedAsset,
  createTimelineManifest,
  type DbClient
} from "@/server/db/repositories";
import { createQueues, enqueueGenerationJob, type VoctaQueueMap } from "@/server/jobs/queues";
import type { ExportJobPayload, ExportJobResult } from "@/server/jobs/types";
import { LocalStorageDriver } from "@/server/storage/local";
import type { StorageDriver } from "@/server/storage/types";
import { staleWarnings } from "@/server/stale/service";

import { createUncompressedZip, type ZipEntry } from "./zip";

type SelectedAsset = {
  id: string;
  assetType: AssetType;
  fileUrl: string;
  storagePath: string;
  mimeType: string;
  durationSeconds: number | null;
  generationJobId: string | null;
  metadata: Prisma.JsonValue;
};

type PanelForExport = {
  id: string;
  orderIndex: number;
  title: string;
  narrationText: string | null;
  targetDurationSeconds: number | null;
  notes: string | null;
  mappedEntityIds: Prisma.JsonValue;
  staleState: Prisma.JsonValue;
  selectedImageAsset: SelectedAsset | null;
  selectedVideoAsset: SelectedAsset | null;
  selectedAudioAsset: SelectedAsset | null;
  firstFrameAsset: SelectedAsset | null;
  lastFrameAsset: SelectedAsset | null;
  scene: {
    id: string;
    orderIndex: number;
    title: string;
  };
};

export type ExportReadiness = {
  projectId: string | null;
  projectTitle: string | null;
  totalPanels: number;
  selectedImages: number;
  selectedVideos: number;
  selectedAudio: number;
  selectedFirstFrames: number;
  selectedLastFrames: number;
  stalePanels: number;
  warnings: string[];
  latestPackage: {
    id: string;
    status: string;
    zipFileUrl: string | null;
    createdAt: string;
    completedAt: string | null;
  } | null;
};

export type ExportPackageResult = {
  exportPackageId: string;
  zipFileUrl: string;
  manifest: TimelineManifestJson;
  csv: string;
};

export type TimelineManifestJson = {
  schemaVersion: 1;
  project: {
    id: string;
    title: string;
    aspectRatio: string;
  };
  export: {
    timestamp: string;
    rootFolder: string;
    packageId: string;
    includes: {
      selectedImage: boolean;
      firstFrame: boolean;
      lastFrame: boolean;
      video: boolean;
      audio: boolean;
      panelMetadataJson: boolean;
      csvManifest: boolean;
    };
  };
  panels: TimelineManifestPanel[];
  warnings: string[];
};

export type TimelineManifestPanel = {
  index: number;
  sceneIndex: number;
  sceneTitle: string;
  panelId: string;
  panelTitle: string;
  folder: string;
  selectedVideoPath: string | null;
  selectedAudioPath: string | null;
  selectedImagePath: string | null;
  firstFramePath: string | null;
  lastFramePath: string | null;
  narrationText: string | null;
  targetDurationSeconds: number | null;
  actualVideoDurationSeconds: number | null;
  actualAudioDurationSeconds: number | null;
  notes: string | null;
  mappedEntityIds: string[];
  staleWarnings: string[];
  sourceAssetIds: {
    video: string | null;
    audio: string | null;
    image: string | null;
    firstFrame: string | null;
    lastFrame: string | null;
  };
  generationJobIds: {
    video: string | null;
    audio: string | null;
    image: string | null;
    firstFrame: string | null;
    lastFrame: string | null;
  };
};

type CreateExportOptions = {
  projectId?: string | null;
  includeCsv?: boolean;
  storage?: StorageDriver;
  now?: () => Date;
};

type RequestExportOptions = CreateExportOptions & {
  queues?: VoctaQueueMap;
};

export type QueuedExportPackageResult = {
  exportPackage: Awaited<ReturnType<typeof createExportPackage>>;
  queueJobId?: string;
};

export async function getExportReadiness(db: DbClient, projectId?: string | null): Promise<ExportReadiness> {
  const project = await loadProjectForExport(db, projectId);

  if (!project) {
    return {
      projectId: null,
      projectTitle: null,
      totalPanels: 0,
      selectedImages: 0,
      selectedVideos: 0,
      selectedAudio: 0,
      selectedFirstFrames: 0,
      selectedLastFrames: 0,
      stalePanels: 0,
      warnings: ["Create or seed a project before exporting."],
      latestPackage: null
    };
  }

  const panels = orderedPanels(project);
  const latestPackage = await db.exportPackage.findFirst({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" }
  });

  return {
    projectId: project.id,
    projectTitle: project.title,
    totalPanels: panels.length,
    selectedImages: panels.filter((panel) => panel.selectedImageAsset).length,
    selectedVideos: panels.filter((panel) => panel.selectedVideoAsset).length,
    selectedAudio: panels.filter((panel) => panel.selectedAudioAsset).length,
    selectedFirstFrames: panels.filter((panel) => panel.firstFrameAsset).length,
    selectedLastFrames: panels.filter((panel) => panel.lastFrameAsset).length,
    stalePanels: panels.filter((panel) => staleWarnings(panel.staleState).length > 0).length,
    warnings: exportWarnings(panels),
    latestPackage: latestPackage
      ? {
          id: latestPackage.id,
          status: latestPackage.status,
          zipFileUrl: latestPackage.zipFileUrl,
          createdAt: latestPackage.createdAt.toISOString(),
          completedAt: latestPackage.completedAt?.toISOString() ?? null
        }
      : null
  };
}

export async function createOrderedExportPackage(
  db: DbClient,
  options: CreateExportOptions = {}
): Promise<ExportPackageResult> {
  const project = await loadProjectForExport(db, options.projectId);

  if (!project) {
    throw new Error("Create or seed a project before exporting.");
  }

  const now = options.now?.() ?? new Date();
  const panels = orderedPanels(project);
  const exportPackage = await createExportPackage(db, {
    projectId: project.id,
    status: ExportPackageStatus.RUNNING,
    includedPanelIds: panels.map((panel) => panel.id),
    logs: [{ at: now.toISOString(), message: "Manual ordered package export started." }]
  });

  return executeOrderedExportPackage(db, {
    jobType: "export",
    projectId: project.id,
    exportPackageId: exportPackage.id,
    requestedAt: now.toISOString(),
    panelIds: panels.map((panel) => panel.id),
    format: "zip",
    includeJsonManifest: true,
    includeCsvManifest: options.includeCsv ?? true
  }, options).then((result) => ({
    exportPackageId: exportPackage.id,
    zipFileUrl: result.packagePath,
    manifest: result.metadata?.manifest as TimelineManifestJson,
    csv: typeof result.metadata?.csv === "string" ? result.metadata.csv : ""
  }));
}

export async function requestOrderedExportPackage(
  db: DbClient,
  options: RequestExportOptions = {}
): Promise<QueuedExportPackageResult> {
  const project = await loadProjectForExport(db, options.projectId);

  if (!project) {
    throw new Error("Create or seed a project before exporting.");
  }

  const now = options.now?.() ?? new Date();
  const panels = orderedPanels(project);
  const exportPackage = await createExportPackage(db, {
    projectId: project.id,
    status: ExportPackageStatus.QUEUED,
    includedPanelIds: panels.map((panel) => panel.id),
    logs: [{ at: now.toISOString(), message: "Manual ordered package export queued." }]
  });
  const payload: ExportJobPayload = {
    jobType: "export",
    projectId: project.id,
    exportPackageId: exportPackage.id,
    requestedAt: now.toISOString(),
    panelIds: panels.map((panel) => panel.id),
    format: "zip",
    includeJsonManifest: true,
    includeCsvManifest: options.includeCsv ?? true
  };

  try {
    const queues = options.queues ?? createQueues();
    const queueJob = await enqueueGenerationJob(queues, payload, { jobId: exportPackage.id });

    return { exportPackage, queueJobId: queueJob.id };
  } catch (error) {
    const failedAt = options.now?.() ?? new Date();
    await db.exportPackage.update({
      where: { id: exportPackage.id },
      data: {
        status: ExportPackageStatus.FAILED,
        completedAt: failedAt,
        errorPayload: serializeError(error) as Prisma.InputJsonValue,
        logs: [
          { at: now.toISOString(), message: "Manual ordered package export queued." },
          { at: failedAt.toISOString(), message: "Export enqueue failed." }
        ]
      }
    });
    throw error;
  }
}

export async function executeOrderedExportPackage(
  db: DbClient,
  payload: ExportJobPayload,
  options: CreateExportOptions = {}
): Promise<ExportJobResult> {
  const storage = options.storage ?? new LocalStorageDriver();
  const startedAt = options.now?.() ?? new Date();
  const exportPackage = await db.exportPackage.findUniqueOrThrow({
    where: { id: payload.exportPackageId }
  });
  const project = await loadProjectForExport(db, exportPackage.projectId);

  if (!project) {
    throw new Error("Export package project no longer exists.");
  }

  if (exportPackage.status !== ExportPackageStatus.RUNNING) {
    await db.exportPackage.update({
      where: { id: exportPackage.id },
      data: {
        status: ExportPackageStatus.RUNNING,
        logs: appendLog(exportPackage.logs, {
          at: startedAt.toISOString(),
          message: "Ordered package export started by worker."
        })
      }
    });
  }

  try {
    const panels = orderedPanels(project).filter(
      (panel) => !payload.panelIds?.length || payload.panelIds.includes(panel.id)
    );
    const rootFolder = `${slugify(project.title)}_export_${timestampSlug(startedAt)}`;
    const manifest = buildManifest({
      project,
      panels,
      packageId: exportPackage.id,
      rootFolder,
      timestamp: startedAt.toISOString(),
      includeCsv: payload.includeCsvManifest
    });
    const csv = createCsvManifest(manifest);
    const zipEntries = await buildZipEntries(storage, rootFolder, manifest, panels);

    zipEntries.push(
      textEntry(`${rootFolder}/timeline_manifest.json`, JSON.stringify(manifest, null, 2)),
      ...(payload.includeCsvManifest ? [textEntry(`${rootFolder}/timeline_manifest.csv`, csv)] : [])
    );

    const zipBytes = createUncompressedZip(zipEntries);
    const basePath = `exports/${project.id}/${exportPackage.id}`;
    const completedAt = options.now?.() ?? new Date();
    const [zipObject, manifestObject, csvObject] = await Promise.all([
      storage.putObject({
        path: `${basePath}/${rootFolder}.zip`,
        bytes: zipBytes,
        contentType: "application/zip",
        metadata: { projectId: project.id, exportPackageId: exportPackage.id }
      }),
      storage.putObject({
        path: `${basePath}/timeline_manifest.json`,
        bytes: encodeText(JSON.stringify(manifest, null, 2)),
        contentType: "application/json",
        metadata: { projectId: project.id, exportPackageId: exportPackage.id }
      }),
      storage.putObject({
        path: `${basePath}/timeline_manifest.csv`,
        bytes: encodeText(csv),
        contentType: "text/csv",
        metadata: { projectId: project.id, exportPackageId: exportPackage.id }
      })
    ]);
    const [manifestJsonAsset, manifestCsvAsset] = await Promise.all([
      createGeneratedAsset(db, {
        projectId: project.id,
        assetType: AssetType.FILE,
        fileUrl: manifestObject.url,
        previewUrl: manifestObject.url,
        storagePath: manifestObject.path,
        mimeType: "application/json",
        metadata: { exportPackageId: exportPackage.id, kind: "timeline_manifest_json" }
      }),
      createGeneratedAsset(db, {
        projectId: project.id,
        assetType: AssetType.FILE,
        fileUrl: csvObject.url,
        previewUrl: csvObject.url,
        storagePath: csvObject.path,
        mimeType: "text/csv",
        metadata: { exportPackageId: exportPackage.id, kind: "timeline_manifest_csv" }
      })
    ]);
    await db.exportPackage.update({
      where: { id: exportPackage.id },
      data: {
        status: ExportPackageStatus.COMPLETED,
        zipFileUrl: zipObject.url,
        manifestJsonAssetId: manifestJsonAsset.id,
        manifestCsvAssetId: manifestCsvAsset.id,
        completedAt,
        logs: [
          { at: startedAt.toISOString(), message: "Ordered package export started by worker." },
          { at: completedAt.toISOString(), message: `Created ZIP with ${zipEntries.length} entries.` }
        ]
      }
    });
    await createTimelineManifest(db, {
      projectId: project.id,
      exportPackageId: exportPackage.id,
      manifestJson: manifest as unknown as Prisma.InputJsonValue,
      manifestCsv: csv
    });

    return {
      jobType: "export",
      provider: "vocta",
      model: "ordered-package-v1",
      completedAt: completedAt.toISOString(),
      summary: `Created ordered export package with ${manifest.panels.length} panel(s).`,
      warnings: manifest.warnings.map((message) => ({ code: "export_warning", message, severity: "warning" as const })),
      packagePath: zipObject.url,
      manifestPath: manifestObject.url,
      csvPath: csvObject.url,
      assetCount: zipEntries.length,
      metadata: { manifest, csv }
    };
  } catch (error) {
    const failedAt = options.now?.() ?? new Date();
    await db.exportPackage.update({
      where: { id: exportPackage.id },
      data: {
        status: ExportPackageStatus.FAILED,
        completedAt: failedAt,
        errorPayload: serializeError(error) as Prisma.InputJsonValue,
        logs: [
          { at: startedAt.toISOString(), message: "Ordered package export started by worker." },
          { at: failedAt.toISOString(), message: "Export package creation failed." }
        ]
      }
    });
    throw error;
  }
}

function buildManifest(input: {
  project: NonNullable<Awaited<ReturnType<typeof loadProjectForExport>>>;
  panels: PanelForExport[];
  packageId: string;
  rootFolder: string;
  timestamp: string;
  includeCsv: boolean;
}): TimelineManifestJson {
  const panels = input.panels.map((panel, index) => {
    const folder = `${String(index + 1).padStart(3, "0")}_panel_${slugify(panel.title)}`;

    return {
      index: index + 1,
      sceneIndex: panel.scene.orderIndex,
      sceneTitle: panel.scene.title,
      panelId: panel.id,
      panelTitle: panel.title,
      folder,
      selectedVideoPath: panel.selectedVideoAsset ? `${folder}/video${extensionForAsset(panel.selectedVideoAsset)}` : null,
      selectedAudioPath: panel.selectedAudioAsset ? `${folder}/audio${extensionForAsset(panel.selectedAudioAsset)}` : null,
      selectedImagePath: panel.selectedImageAsset ? `${folder}/image${extensionForAsset(panel.selectedImageAsset)}` : null,
      firstFramePath: panel.firstFrameAsset ? `${folder}/first_frame${extensionForAsset(panel.firstFrameAsset)}` : null,
      lastFramePath: panel.lastFrameAsset ? `${folder}/last_frame${extensionForAsset(panel.lastFrameAsset)}` : null,
      narrationText: panel.narrationText,
      targetDurationSeconds: panel.targetDurationSeconds,
      actualVideoDurationSeconds: panel.selectedVideoAsset?.durationSeconds ?? null,
      actualAudioDurationSeconds: panel.selectedAudioAsset?.durationSeconds ?? null,
      notes: panel.notes,
      mappedEntityIds: jsonStringArray(panel.mappedEntityIds),
      staleWarnings: staleWarnings(panel.staleState),
      sourceAssetIds: {
        video: panel.selectedVideoAsset?.id ?? null,
        audio: panel.selectedAudioAsset?.id ?? null,
        image: panel.selectedImageAsset?.id ?? null,
        firstFrame: panel.firstFrameAsset?.id ?? null,
        lastFrame: panel.lastFrameAsset?.id ?? null
      },
      generationJobIds: {
        video: panel.selectedVideoAsset?.generationJobId ?? null,
        audio: panel.selectedAudioAsset?.generationJobId ?? null,
        image: panel.selectedImageAsset?.generationJobId ?? null,
        firstFrame: panel.firstFrameAsset?.generationJobId ?? null,
        lastFrame: panel.lastFrameAsset?.generationJobId ?? null
      }
    };
  });

  return {
    schemaVersion: 1,
    project: {
      id: input.project.id,
      title: input.project.title,
      aspectRatio: input.project.aspectRatio
    },
    export: {
      timestamp: input.timestamp,
      rootFolder: input.rootFolder,
      packageId: input.packageId,
      includes: {
        selectedImage: true,
        firstFrame: true,
        lastFrame: true,
        video: true,
        audio: true,
        panelMetadataJson: true,
        csvManifest: input.includeCsv
      }
    },
    panels,
    warnings: exportWarnings(input.panels)
  };
}

async function buildZipEntries(
  storage: StorageDriver,
  rootFolder: string,
  manifest: TimelineManifestJson,
  panels: PanelForExport[]
) {
  const entries: ZipEntry[] = [];

  for (const panelManifest of manifest.panels) {
    const panel = panels.find((candidate) => candidate.id === panelManifest.panelId)!;
    const folder = `${rootFolder}/${panelManifest.folder}`;
    const assets = [
      { asset: panel.selectedVideoAsset, path: panelManifest.selectedVideoPath },
      { asset: panel.selectedAudioAsset, path: panelManifest.selectedAudioPath },
      { asset: panel.selectedImageAsset, path: panelManifest.selectedImagePath },
      { asset: panel.firstFrameAsset, path: panelManifest.firstFramePath },
      { asset: panel.lastFrameAsset, path: panelManifest.lastFramePath }
    ];

    for (const item of assets) {
      if (!item.asset || !item.path) continue;
      const object = await storage.getObject(item.asset.storagePath);
      entries.push({
        path: `${rootFolder}/${item.path}`,
        bytes: object.bytes
      });
    }

    entries.push(textEntry(`${folder}/metadata.json`, JSON.stringify(panelManifest, null, 2)));
  }

  return entries;
}

function createCsvManifest(manifest: TimelineManifestJson) {
  const headers = [
    "index",
    "scene",
    "panel_title",
    "video",
    "audio",
    "image",
    "first_frame",
    "last_frame",
    "narration",
    "target_duration",
    "video_duration",
    "audio_duration",
    "stale_warnings"
  ];
  const rows = manifest.panels.map((panel) => [
    panel.index,
    panel.sceneTitle,
    panel.panelTitle,
    panel.selectedVideoPath ?? "",
    panel.selectedAudioPath ?? "",
    panel.selectedImagePath ?? "",
    panel.firstFramePath ?? "",
    panel.lastFramePath ?? "",
    panel.narrationText ?? "",
    panel.targetDurationSeconds ?? "",
    panel.actualVideoDurationSeconds ?? "",
    panel.actualAudioDurationSeconds ?? "",
    panel.staleWarnings.join("; ")
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function exportWarnings(panels: PanelForExport[]) {
  const warnings: string[] = [];

  if (!panels.length) warnings.push("Project has no panels.");
  for (const panel of panels) {
    const label = `${panel.scene.orderIndex}.${panel.orderIndex} ${panel.title}`;
    if (!panel.selectedVideoAsset) warnings.push(`${label}: no selected video asset.`);
    if (!panel.selectedAudioAsset) warnings.push(`${label}: no selected audio asset.`);
    if (!panel.selectedImageAsset) warnings.push(`${label}: no selected image asset.`);
    for (const stale of staleWarnings(panel.staleState)) {
      warnings.push(`${label}: ${stale}`);
    }
  }

  return warnings;
}

async function loadProjectForExport(db: DbClient, projectId?: string | null) {
  const where = projectId
    ? { id: projectId }
    : undefined;

  if (where) {
    return db.project.findUnique({
      where,
      include: projectExportInclude
    });
  }

  return db.project.findFirst({
    orderBy: { updatedAt: "desc" },
    include: projectExportInclude
  });
}

const projectExportInclude = {
  scenes: {
    orderBy: { orderIndex: "asc" },
    include: {
      panels: {
        orderBy: { orderIndex: "asc" },
        include: {
          scene: { select: { id: true, orderIndex: true, title: true } },
          selectedImageAsset: true,
          selectedVideoAsset: true,
          selectedAudioAsset: true,
          firstFrameAsset: true,
          lastFrameAsset: true
        }
      }
    }
  }
} satisfies Prisma.ProjectInclude;

function orderedPanels(project: NonNullable<Awaited<ReturnType<typeof loadProjectForExport>>>) {
  return project.scenes.flatMap((scene) => scene.panels) as unknown as PanelForExport[];
}

function textEntry(path: string, text: string): ZipEntry {
  return {
    path,
    bytes: encodeText(text)
  };
}

function encodeText(value: string) {
  return new TextEncoder().encode(value);
}

function extensionForAsset(asset: SelectedAsset) {
  if (asset.mimeType === "image/svg+xml") return ".svg";
  if (asset.mimeType === "image/png") return ".png";
  if (asset.mimeType === "image/jpeg") return ".jpg";
  if (asset.mimeType === "video/mp4") return ".mp4";
  if (asset.mimeType === "audio/mpeg") return ".mp3";
  if (asset.mimeType === "audio/wav") return ".wav";
  if (asset.mimeType === "application/json") return ".json";
  if (asset.mimeType === "text/csv") return ".csv";
  return ".bin";
}

function jsonStringArray(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function appendLog(existing: Prisma.JsonValue, entry: { at: string; message: string }) {
  return [
    ...(Array.isArray(existing) ? existing : []),
    entry
  ] as Prisma.InputJsonValue;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return { message: String(error) };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "untitled";
}

function timestampSlug(date: Date) {
  return date.toISOString().slice(0, 16).replace(/[-:T]/g, "");
}
