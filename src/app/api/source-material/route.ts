import { NextResponse } from "next/server";
import { AssetType, SourceMaterialType, Prisma } from "@prisma/client";
import { addSourceMaterial, createGeneratedAsset, listSourceMaterials, prisma } from "@/server/db";
import { ensureProjectInWorkspace, getWorkspaceContext } from "@/features/projects/workspace-context";
import {
  buildStubStoragePath,
  createSourceMaterialPayloadSchema,
  validateImageMimeType
} from "@/features/source-material/source-material-validation";

export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    const { teamId } = await getWorkspaceContext();
    const project = await ensureProjectInWorkspace(projectId, teamId);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const materials = await listSourceMaterials(prisma, projectId);
    return NextResponse.json({ data: materials.map(serializeSourceMaterial) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = createSourceMaterialPayloadSchema.parse(await readJson(request));
    const { teamId, userId } = await getWorkspaceContext();
    const project = await ensureProjectInWorkspace(payload.projectId, teamId);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (payload.type === "SCRIPT") {
      const material = await addSourceMaterial(prisma, {
        projectId: payload.projectId,
        createdById: userId,
        type: SourceMaterialType.SCRIPT,
        title: payload.title,
        bodyText: payload.bodyText,
        metadata: { source: "manual" }
      });

      return NextResponse.json({ data: serializeSourceMaterial({ ...material, fileAsset: null }) }, { status: 201 });
    }

    if (!payload.previewUrl && !payload.fileName) {
      return NextResponse.json(
        { error: "A thumbnail URL or local file metadata is required." },
        { status: 400 }
      );
    }

    if (!validateImageMimeType(payload.mimeType)) {
      return NextResponse.json({ error: "Image references must be PNG, JPEG, or WebP." }, { status: 400 });
    }

    const previewUrl = payload.previewUrl || `/stub/source-material/${encodeURIComponent(payload.fileName ?? "image")}`;
    const asset = await createGeneratedAsset(prisma, {
      projectId: payload.projectId,
      assetType: AssetType.REFERENCE,
      fileUrl: previewUrl,
      previewUrl,
      storagePath: buildStubStoragePath(payload.projectId, payload.title, payload.fileName),
      mimeType: payload.mimeType ?? "image/reference-stub",
      metadata: {
        sourceMaterialUploadStub: true,
        fileName: payload.fileName,
        sizeBytes: payload.sizeBytes
      }
    });

    const material = await addSourceMaterial(prisma, {
      projectId: payload.projectId,
      createdById: userId,
      type: SourceMaterialType.IMAGE,
      title: payload.title,
      fileAssetId: asset.id,
      metadata: {
        source: "manual",
        uploadStub: true
      }
    });

    return NextResponse.json(
      { data: serializeSourceMaterial({ ...material, fileAsset: asset }) },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

type SourceMaterialWithAsset = Awaited<ReturnType<typeof listSourceMaterials>>[number];

function serializeSourceMaterial(material: SourceMaterialWithAsset) {
  return {
    ...material,
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
    fileAsset: material.fileAsset
      ? {
          ...material.fileAsset,
          createdAt: material.fileAsset.createdAt.toISOString()
        }
      : null
  };
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function errorResponse(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Request failed." }, { status: 400 });
}
