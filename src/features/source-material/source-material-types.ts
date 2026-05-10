import type { SourceMaterialType } from "@prisma/client";

export type SourceMaterialItem = {
  id: string;
  projectId: string;
  type: SourceMaterialType;
  title: string;
  bodyText: string | null;
  url: string | null;
  createdAt: string;
  updatedAt: string;
  fileAsset: {
    id: string;
    fileUrl: string;
    previewUrl: string | null;
    mimeType: string;
    width: number | null;
    height: number | null;
    metadata: unknown;
  } | null;
};

export type SourceMaterialProject = {
  id: string;
  title: string;
  status: string;
  aspectRatio: string;
};
