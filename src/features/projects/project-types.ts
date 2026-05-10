import type { ProjectStatus } from "@prisma/client";

export type ProjectListItem = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  aspectRatio: string;
  updatedAt: string;
  createdAt: string;
  _count: {
    scenes: number;
    panels: number;
    generatedAssets: number;
  };
};
