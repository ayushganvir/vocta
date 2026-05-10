"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./source-material-workspace.module.css";
import {
  IMAGE_REFERENCE_ACCEPTED_MIME_TYPES,
  IMAGE_REFERENCE_MAX_SIZE_BYTES,
  IMAGE_REFERENCE_TITLE_MAX_LENGTH,
  SCRIPT_BODY_MAX_LENGTH,
  SCRIPT_TITLE_MAX_LENGTH
} from "./source-material-validation";
import type { SourceMaterialItem, SourceMaterialProject } from "./source-material-types";
import { StoryAnalysisReview } from "@/features/story-analysis/story-analysis-review";
import type { StoryAnalysisDraftItem } from "@/features/story-analysis/types";

type SourceMaterialWorkspaceProps = {
  projects: SourceMaterialProject[];
  initialProjectId: string;
  initialSourceMaterials: SourceMaterialItem[];
  initialStoryAnalysisDrafts: StoryAnalysisDraftItem[];
};

export function SourceMaterialWorkspace({
  projects,
  initialProjectId,
  initialSourceMaterials,
  initialStoryAnalysisDrafts
}: SourceMaterialWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projectId, setProjectId] = useState(initialProjectId);
  const [materials, setMaterials] = useState(initialSourceMaterials);
  const [scriptTitle, setScriptTitle] = useState("Script Draft");
  const [scriptBody, setScriptBody] = useState("");
  const [imageTitle, setImageTitle] = useState("Image Reference");
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileMeta, setFileMeta] = useState<{ fileName: string; mimeType: string; sizeBytes: number } | null>(null);
  const [message, setMessage] = useState("Add source records only when the operator clicks a save button.");
  const [isSaving, setIsSaving] = useState(false);

  const scripts = useMemo(() => materials.filter((material) => material.type === "SCRIPT"), [materials]);
  const imageReferences = useMemo(() => materials.filter((material) => material.type === "IMAGE"), [materials]);

  function changeProject(nextProjectId: string) {
    setProjectId(nextProjectId);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("projectId", nextProjectId);
    router.push(`/source-material?${nextParams.toString()}`);
  }

  async function submitScript(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createSourceMaterial({
      projectId,
      type: "SCRIPT",
      title: scriptTitle,
      bodyText: scriptBody
    });
    setScriptBody("");
  }

  async function submitImageReference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createSourceMaterial({
      projectId,
      type: "IMAGE",
      title: imageTitle,
      previewUrl,
      fileName: fileMeta?.fileName ?? null,
      mimeType: fileMeta?.mimeType ?? null,
      sizeBytes: fileMeta?.sizeBytes ?? null
    });
    setPreviewUrl("");
    setFileMeta(null);
  }

  async function createSourceMaterial(body: unknown) {
    setIsSaving(true);
    setMessage("Saving source material...");
    try {
      const response = await fetch("/api/source-material", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as { data?: SourceMaterialItem; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Request failed.");
      }
      setMaterials((current) => [...current, payload.data as SourceMaterialItem]);
      setMessage(`Saved ${payload.data.title}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleFileChange(file: File | undefined) {
    if (!file) {
      setFileMeta(null);
      return;
    }

    setFileMeta({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size
    });
    setMessage("Local binary upload is stubbed; this records file metadata and uses the preview URL for thumbnails.");
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.panel}>
        <div className={styles.sectionTitle}>
          <h3>Script Source</h3>
          <span>{scripts.length} scripts</span>
        </div>

        <div className={styles.projectSelect}>
          <label className={styles.field}>
            <span className={styles.label}>Project</span>
            <select value={projectId} onChange={(event) => changeProject(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title} ({project.aspectRatio})
                </option>
              ))}
            </select>
          </label>
        </div>

        <form className={styles.formStack} onSubmit={submitScript}>
          <label className={styles.field}>
            <span className={styles.label}>Script title</span>
            <input
              value={scriptTitle}
              maxLength={SCRIPT_TITLE_MAX_LENGTH}
              onChange={(event) => setScriptTitle(event.target.value)}
              required
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Script text</span>
            <textarea
              value={scriptBody}
              maxLength={SCRIPT_BODY_MAX_LENGTH}
              rows={8}
              onChange={(event) => setScriptBody(event.target.value)}
              required
            />
          </label>
          <div className={styles.actions}>
            <button className={`${styles.button} ${styles.primaryButton}`} type="submit" disabled={isSaving}>
              Add script
            </button>
          </div>
        </form>

        <div className={styles.sourceList}>
          {scripts.map((script) => (
            <article className={styles.sourceCard} key={script.id}>
              <strong>{script.title}</strong>
              <span className={styles.meta}>{new Date(script.createdAt).toLocaleString()}</span>
              <p>{script.bodyText}</p>
            </article>
          ))}
          {scripts.length === 0 ? <p className={styles.message}>No script source material yet.</p> : null}
        </div>
      </section>

      <aside className={styles.panel}>
        <div className={styles.sectionTitle}>
          <h3>Image References</h3>
          <span>{imageReferences.length} images</span>
        </div>

        <form className={styles.formStack} onSubmit={submitImageReference}>
          <label className={styles.field}>
            <span className={styles.label}>Reference title</span>
            <input
              value={imageTitle}
              maxLength={IMAGE_REFERENCE_TITLE_MAX_LENGTH}
              onChange={(event) => setImageTitle(event.target.value)}
              required
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Thumbnail URL</span>
            <input
              value={previewUrl}
              placeholder="/seed/reference/moonlit-door.png"
              onChange={(event) => setPreviewUrl(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Local file metadata</span>
            <input
              type="file"
              accept={IMAGE_REFERENCE_ACCEPTED_MIME_TYPES.join(",")}
              onChange={(event) => handleFileChange(event.target.files?.[0])}
            />
          </label>
          {fileMeta ? (
            <p className={styles.helper}>
              {fileMeta.fileName} / {fileMeta.mimeType || "unknown type"} / {Math.round(fileMeta.sizeBytes / 1024)} KB
            </p>
          ) : null}
          <div className={styles.actions}>
            <button className={`${styles.button} ${styles.primaryButton}`} type="submit" disabled={isSaving}>
              Add image reference
            </button>
          </div>
        </form>

        <div className={styles.imageGrid}>
          {imageReferences.map((reference) => {
            const thumbnailUrl = reference.fileAsset?.previewUrl ?? reference.fileAsset?.fileUrl ?? "";
            return (
              <article className={styles.imageTile} key={reference.id}>
                <div className={styles.thumb}>
                  {thumbnailUrl ? <img src={thumbnailUrl} alt="" /> : <span>Stub</span>}
                </div>
                <div className={styles.imageTileBody}>
                  <strong>{reference.title}</strong>
                  <span className={styles.meta}>{reference.fileAsset?.mimeType ?? "metadata only"}</span>
                </div>
              </article>
            );
          })}
        </div>

        <p className={styles.message}>{message}</p>
        <p className={styles.helper}>
          Max image metadata size: {Math.round(IMAGE_REFERENCE_MAX_SIZE_BYTES / 1024 / 1024)} MB. Link fetching and
          media processing are deferred.
        </p>

        <StoryAnalysisReview
          projectId={projectId}
          initialDrafts={initialStoryAnalysisDrafts}
          sourceMaterialIds={scripts.map((script) => script.id)}
        />
      </aside>
    </div>
  );
}
