import type { StoryAnalysisDraft } from "./schema";

export type StoryAnalysisDraftItem = {
  id: string;
  projectId: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  draft: StoryAnalysisDraft;
  applied: {
    entityIds: string[];
    styleFields: string[];
    sceneIds: string[];
  };
};
