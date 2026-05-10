"use client";

import { useState } from "react";
import styles from "./story-analysis-review.module.css";
import type { StoryAnalysisDraftItem } from "./types";

type StoryAnalysisReviewProps = {
  projectId: string;
  initialDrafts: StoryAnalysisDraftItem[];
  sourceMaterialIds: string[];
};

type ApplySection = "entities" | "style" | "scenes";

export function StoryAnalysisReview({
  projectId,
  initialDrafts,
  sourceMaterialIds
}: StoryAnalysisReviewProps) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [message, setMessage] = useState("Analyze Story creates a reviewable draft only.");
  const [isBusy, setIsBusy] = useState(false);
  const activeDraft = drafts[0];

  async function analyzeStory() {
    setIsBusy(true);
    setMessage("Analyzing story with the fake text provider...");
    try {
      const response = await fetch("/api/story-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          sourceMaterialIds
        })
      });
      const payload = (await response.json()) as { data?: StoryAnalysisDraftItem; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Story analysis failed.");
      }

      setDrafts((current) => [payload.data as StoryAnalysisDraftItem, ...current]);
      setMessage("Draft ready. Nothing was applied to the project.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Story analysis failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function applyDraft(section: ApplySection, ids?: string[]) {
    if (!activeDraft) return;

    setIsBusy(true);
    setMessage("Applying selected draft items...");
    const body =
      section === "entities"
        ? { action: "apply", projectId, jobId: activeDraft.id, apply: { section, entityIds: ids } }
        : section === "scenes"
          ? { action: "apply", projectId, jobId: activeDraft.id, apply: { section, sceneIds: ids } }
          : { action: "apply", projectId, jobId: activeDraft.id, apply: { section } };

    try {
      const response = await fetch("/api/story-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as {
        data?: {
          entities: Array<{ draftId: string }>;
          styleFields: string[];
          scenes: Array<{ draftId: string }>;
        };
        error?: string;
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Apply failed.");
      }
      const applied = payload.data;

      setDrafts((current) =>
        current.map((draft) =>
          draft.id === activeDraft.id
            ? {
                ...draft,
                applied: {
                  entityIds: [...new Set([...draft.applied.entityIds, ...applied.entities.map((entity) => entity.draftId)])],
                  styleFields: [...new Set([...draft.applied.styleFields, ...applied.styleFields])],
                  sceneIds: [...new Set([...draft.applied.sceneIds, ...applied.scenes.map((scene) => scene.draftId)])]
                }
              }
            : draft
        )
      );
      setMessage("Applied selected draft items.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Apply failed.");
    } finally {
      setIsBusy(false);
    }
  }

  const canAnalyze = projectId && sourceMaterialIds.length > 0;

  return (
    <section className={styles.review}>
      <div className={styles.header}>
        <div>
          <h3>Analyze Story</h3>
          <span className={styles.draftMeta}>
            {activeDraft ? `Latest draft: ${new Date(activeDraft.createdAt).toLocaleString()}` : "No drafts yet"}
          </span>
        </div>
        <button className={`${styles.button} ${styles.primaryButton}`} disabled={!canAnalyze || isBusy} onClick={analyzeStory}>
          Analyze Story
        </button>
      </div>

      {activeDraft ? (
        <>
          <article className={styles.section}>
            <div className={styles.sectionHeader}>
              <h4>Summary</h4>
              <span className={styles.muted}>Draft only</span>
            </div>
            <p className={styles.summary}>{activeDraft.draft.storySummary}</p>
          </article>

          <article className={styles.section}>
            <div className={styles.sectionHeader}>
              <h4>Entities</h4>
              <button className={styles.button} disabled={isBusy} onClick={() => applyDraft("entities")}>
                Apply all
              </button>
            </div>
            <div className={styles.itemList}>
              {activeDraft.draft.entitySuggestions.map((entity) => (
                <div className={styles.item} key={entity.id}>
                  <strong>{entity.name}</strong>
                  <span className={styles.pill}>{entity.type}</span>
                  <p>{entity.description}</p>
                  {entity.visualPrompt ? <p>{entity.visualPrompt}</p> : null}
                  <div className={styles.actions}>
                    <button
                      className={styles.button}
                      disabled={isBusy || activeDraft.applied.entityIds.includes(entity.id)}
                      onClick={() => applyDraft("entities", [entity.id])}
                    >
                      {activeDraft.applied.entityIds.includes(entity.id) ? "Applied" : "Apply entity"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.section}>
            <div className={styles.sectionHeader}>
              <h4>Style</h4>
              <button className={styles.button} disabled={isBusy} onClick={() => applyDraft("style")}>
                Apply style
              </button>
            </div>
            <p className={styles.summary}>{formatStyle(activeDraft.draft.styleSuggestions)}</p>
          </article>

          <article className={styles.section}>
            <div className={styles.sectionHeader}>
              <h4>Scenes and Panels</h4>
              <button className={styles.button} disabled={isBusy} onClick={() => applyDraft("scenes")}>
                Apply all
              </button>
            </div>
            <div className={styles.itemList}>
              {activeDraft.draft.scenes.map((scene) => (
                <div className={styles.item} key={scene.id}>
                  <strong>{scene.orderIndex}. {scene.title}</strong>
                  <p>{scene.synopsis}</p>
                  <span className={styles.muted}>{scene.panels.length} panel(s)</span>
                  <div className={styles.actions}>
                    <button
                      className={styles.button}
                      disabled={isBusy || activeDraft.applied.sceneIds.includes(scene.id)}
                      onClick={() => applyDraft("scenes", [scene.id])}
                    >
                      {activeDraft.applied.sceneIds.includes(scene.id) ? "Applied" : "Apply scene"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </>
      ) : (
        <p className={styles.message}>Add a script, then run Analyze Story to create a draft.</p>
      )}

      <p className={styles.message}>{message}</p>
    </section>
  );
}

function formatStyle(style: StoryAnalysisDraftItem["draft"]["styleSuggestions"]) {
  return [
    style.visualStyle ? `Visual: ${style.visualStyle}` : null,
    style.colorPalette?.length ? `Palette: ${style.colorPalette.join(", ")}` : null,
    style.lightingStyle ? `Lighting: ${style.lightingStyle}` : null,
    style.cameraStyle ? `Camera: ${style.cameraStyle}` : null,
    style.negativePrompt ? `Negative: ${style.negativePrompt}` : null,
    style.brandNotes ? `Notes: ${style.brandNotes}` : null
  ]
    .filter(Boolean)
    .join("\n");
}
