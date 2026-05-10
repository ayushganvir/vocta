"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ProjectStatus } from "@prisma/client";
import styles from "./projects-workspace.module.css";
import {
  DEFAULT_PROJECT_ASPECT_RATIO,
  PROJECT_ASPECT_RATIOS,
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_TITLE_MAX_LENGTH
} from "./project-validation";
import type { ProjectListItem } from "./project-types";
import type { StoryAnalysisDraftItem } from "@/features/story-analysis/types";
import { SCRIPT_BODY_MAX_LENGTH, SCRIPT_TITLE_MAX_LENGTH } from "@/features/source-material/source-material-validation";

type ProjectsWorkspaceProps = {
  initialProjects: ProjectListItem[];
};

type ProjectFormState = {
  title: string;
  description: string;
  aspectRatio: string;
};

const emptyForm: ProjectFormState = {
  title: "",
  description: "",
  aspectRatio: DEFAULT_PROJECT_ASPECT_RATIO
};

export function ProjectsWorkspace({ initialProjects }: ProjectsWorkspaceProps) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [selectedId, setSelectedId] = useState(initialProjects[0]?.id ?? "");
  const [createForm, setCreateForm] = useState<ProjectFormState>(emptyForm);
  const [editForm, setEditForm] = useState<ProjectFormState>(() =>
    projectToForm(initialProjects[0])
  );
  const [scriptTitle, setScriptTitle] = useState("Main Script");
  const [scriptBody, setScriptBody] = useState("");
  const [storyDraft, setStoryDraft] = useState<StoryAnalysisDraftItem | null>(null);
  const [message, setMessage] = useState("Create, edit, and archive actions are saved only after an explicit click.");
  const [storyMessage, setStoryMessage] = useState("Paste a script, then create an AI draft of scenes and panels. Nothing is applied until you click Apply.");
  const [isSaving, setIsSaving] = useState(false);
  const [isStoryBusy, setIsStoryBusy] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? projects[0],
    [projects, selectedId]
  );

  function selectProject(project: ProjectListItem) {
    setSelectedId(project.id);
    setEditForm(projectToForm(project));
    setMessage(`Selected ${project.title}.`);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitJson("/api/projects", "POST", createForm, (project: ProjectListItem) => {
      setProjects((current) => [project, ...current]);
      setSelectedId(project.id);
      setEditForm(projectToForm(project));
      setCreateForm(emptyForm);
      setMessage(`Created ${project.title}.`);
    });
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject) return;

    await submitJson(`/api/projects/${selectedProject.id}`, "PATCH", editForm, (project: ProjectListItem) => {
      setProjects((current) => current.map((item) => (item.id === project.id ? project : item)));
      setEditForm(projectToForm(project));
      setMessage(`Updated ${project.title}.`);
    });
  }

  async function archiveSelected() {
    if (!selectedProject) return;

    await submitJson(
      `/api/projects/${selectedProject.id}/archive`,
      "POST",
      {},
      (project: ProjectListItem) => {
        setProjects((current) => current.map((item) => (item.id === project.id ? project : item)));
        setMessage(`Archived ${project.title}.`);
      }
    );
  }

  async function saveScriptAndAnalyze() {
    if (!selectedProject) {
      setStoryMessage("Select or create a project first.");
      return;
    }
    if (!scriptBody.trim()) {
      setStoryMessage("Paste script text before analyzing.");
      return;
    }

    setIsStoryBusy(true);
    setStoryMessage("Saving script source...");
    try {
      const sourceResponse = await fetch("/api/source-material", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject.id,
          type: "SCRIPT",
          title: scriptTitle,
          bodyText: scriptBody
        })
      });
      const sourcePayload = (await sourceResponse.json()) as {
        data?: { id: string; title: string };
        error?: string;
      };
      if (!sourceResponse.ok || !sourcePayload.data) {
        throw new Error(sourcePayload.error ?? "Script save failed.");
      }

      setStoryMessage("Analyzing story into scenes and panels...");
      const analysisResponse = await fetch("/api/story-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject.id,
          sourceMaterialIds: [sourcePayload.data.id],
          notes: "Project setup flow"
        })
      });
      const analysisPayload = (await analysisResponse.json()) as {
        data?: StoryAnalysisDraftItem;
        error?: string;
      };
      if (!analysisResponse.ok || !analysisPayload.data) {
        throw new Error(analysisPayload.error ?? "Story analysis failed.");
      }

      setStoryDraft(analysisPayload.data);
      setStoryMessage("Draft ready. Review it below, then apply scenes and panels when it looks right.");
      router.refresh();
    } catch (error) {
      setStoryMessage(error instanceof Error ? error.message : "Script analysis failed.");
    } finally {
      setIsStoryBusy(false);
    }
  }

  async function applyStoryDraft(section: "scenes" | "entities" | "style") {
    if (!selectedProject || !storyDraft) {
      return;
    }

    setIsStoryBusy(true);
    setStoryMessage(`Applying ${section} from the latest draft...`);
    try {
      const response = await fetch("/api/story-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          projectId: selectedProject.id,
          jobId: storyDraft.id,
          apply: { section }
        })
      });
      const payload = (await response.json()) as {
        data?: {
          entities: Array<{ draftId: string }>;
          styleFields: string[];
          scenes: Array<{ draftId: string; panelIds: string[] }>;
        };
        error?: string;
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Apply failed.");
      }
      const applied = payload.data;

      setStoryDraft((current) => current
        ? {
            ...current,
            applied: {
              entityIds: [...new Set([...current.applied.entityIds, ...applied.entities.map((entity) => entity.draftId)])],
              styleFields: [...new Set([...current.applied.styleFields, ...applied.styleFields])],
              sceneIds: [...new Set([...current.applied.sceneIds, ...applied.scenes.map((scene) => scene.draftId)])]
            }
          }
        : current
      );
      if (section === "scenes") {
        const appliedPanels = applied.scenes.reduce((sum, scene) => sum + scene.panelIds.length, 0);
        setProjects((current) =>
          current.map((project) =>
            project.id === selectedProject.id
              ? {
                  ...project,
                  _count: {
                    ...project._count,
                    scenes: project._count.scenes + applied.scenes.length,
                    panels: project._count.panels + appliedPanels
                  }
                }
              : project
          )
        );
      }
      setStoryMessage(`Applied ${section}. You can keep editing manually after this.`);
      router.refresh();
    } catch (error) {
      setStoryMessage(error instanceof Error ? error.message : "Apply failed.");
    } finally {
      setIsStoryBusy(false);
    }
  }

  async function submitJson<T>(url: string, method: string, body: unknown, onSuccess: (value: T) => void) {
    setIsSaving(true);
    setMessage("Saving...");
    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as { data?: T; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Request failed.");
      }
      onSuccess(payload.data);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.panel}>
        <div className={styles.hero}>
          <div>
            <span>Project setup</span>
            <h2>{selectedProject?.title ?? "Create or select a project"}</h2>
            <p>
              Start with a script. The AI drafts scenes and panels; you review and apply them. After that, open Scenes to edit every panel and generate assets.
            </p>
          </div>
          <div className={styles.summaryGrid}>
            <strong>{selectedProject?.aspectRatio ?? DEFAULT_PROJECT_ASPECT_RATIO}</strong>
            <span>Aspect ratio</span>
            <strong>{selectedProject?._count.scenes ?? 0}</strong>
            <span>Scenes</span>
            <strong>{selectedProject?._count.panels ?? 0}</strong>
            <span>Panels</span>
          </div>
        </div>

        <section className={styles.startPanel}>
          <div className={styles.sectionTitle}>
            <h3>Start Here: Script To Scenes</h3>
            <span>AI draft, explicit apply</span>
          </div>
          <div className={styles.flowSteps}>
            <span>1. Paste script</span>
            <span>2. Analyze story</span>
            <span>3. Apply scenes and panels</span>
          </div>
          <label className={styles.field}>
            <span className={styles.label}>Script title</span>
            <input
              value={scriptTitle}
              maxLength={SCRIPT_TITLE_MAX_LENGTH}
              onChange={(event) => setScriptTitle(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Script text</span>
            <textarea
              value={scriptBody}
              maxLength={SCRIPT_BODY_MAX_LENGTH}
              rows={8}
              placeholder="Paste the full script, narration, or rough story notes here."
              onChange={(event) => setScriptBody(event.target.value)}
            />
          </label>
          <div className={styles.actions}>
            <button
              className={`${styles.button} ${styles.primaryButton}`}
              type="button"
              disabled={isStoryBusy || !selectedProject}
              onClick={saveScriptAndAnalyze}
            >
              Save script and analyze story
            </button>
            <button className={styles.button} type="button" onClick={() => router.push("/source-material")}>
              Open source material
            </button>
            <button className={styles.button} type="button" onClick={() => router.push("/scenes")}>
              Open scenes
            </button>
          </div>
          {storyDraft ? (
            <div className={styles.draftPreview}>
              <div className={styles.sectionTitle}>
                <h3>AI Draft Preview</h3>
                <span>{draftTotals(storyDraft).scenes} scenes / {draftTotals(storyDraft).panels} panels</span>
              </div>
              <p>{storyDraft.draft.storySummary}</p>
              <div className={styles.draftList}>
                {storyDraft.draft.scenes.map((scene) => (
                  <article key={scene.id}>
                    <strong>{scene.orderIndex}. {scene.title}</strong>
                    <span>{scene.panels.length} panel(s)</span>
                    <p>{scene.synopsis}</p>
                  </article>
                ))}
              </div>
              <div className={styles.actions}>
                <button
                  className={`${styles.button} ${styles.primaryButton}`}
                  type="button"
                  disabled={isStoryBusy || storyDraft.applied.sceneIds.length === storyDraft.draft.scenes.length}
                  onClick={() => applyStoryDraft("scenes")}
                >
                  {storyDraft.applied.sceneIds.length === storyDraft.draft.scenes.length ? "Scenes applied" : "Apply scenes and panels"}
                </button>
                <button className={styles.button} type="button" disabled={isStoryBusy} onClick={() => applyStoryDraft("entities")}>
                  Apply entities
                </button>
                <button className={styles.button} type="button" disabled={isStoryBusy} onClick={() => applyStoryDraft("style")}>
                  Apply style
                </button>
              </div>
            </div>
          ) : null}
          <p className={styles.message}>{storyMessage}</p>
        </section>

        <div className={styles.sectionTitle}>
          <h3>Projects</h3>
          <span>{projects.length} records</span>
        </div>
        <div className={styles.projectList}>
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={styles.projectRow}
              data-selected={project.id === selectedProject?.id}
              onClick={() => selectProject(project)}
            >
              <span>
                <strong>{project.title}</strong>
                <p>{project.description || "No description yet."}</p>
              </span>
              <span className={styles.badge}>{formatStatus(project.status)}</span>
              <span className={styles.meta}>Aspect {project.aspectRatio}</span>
              <span className={styles.meta}>
                {project._count.scenes} scenes / {project._count.panels} panels
              </span>
            </button>
          ))}
          {projects.length === 0 ? <p className={styles.message}>No projects found. Create the first draft project.</p> : null}
        </div>
      </section>

      <aside className={styles.panel}>
        <div className={styles.sectionTitle}>
          <h3>{selectedProject ? "Edit Project" : "Create Project"}</h3>
          <span>9:16 default</span>
        </div>

        <form className={styles.formStack} onSubmit={submitCreate}>
          <label className={styles.field}>
            <span className={styles.label}>New title</span>
            <input
              value={createForm.title}
              maxLength={PROJECT_TITLE_MAX_LENGTH}
              onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })}
              required
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Description</span>
            <textarea
              value={createForm.description}
              maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
              rows={3}
              onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Aspect ratio</span>
            <select
              value={createForm.aspectRatio}
              onChange={(event) => setCreateForm({ ...createForm, aspectRatio: event.target.value })}
            >
              {PROJECT_ASPECT_RATIOS.map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.actions}>
            <button className={`${styles.button} ${styles.primaryButton}`} type="submit" disabled={isSaving}>
              Create project
            </button>
          </div>
        </form>

        {selectedProject ? (
          <form className={styles.formStack} onSubmit={submitEdit}>
            <label className={styles.field}>
              <span className={styles.label}>Selected title</span>
              <input
                value={editForm.title}
                maxLength={PROJECT_TITLE_MAX_LENGTH}
                onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Selected description</span>
              <textarea
                value={editForm.description}
                maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
                rows={3}
                onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Selected aspect ratio</span>
              <select
                value={editForm.aspectRatio}
                onChange={(event) => setEditForm({ ...editForm, aspectRatio: event.target.value })}
              >
                {PROJECT_ASPECT_RATIOS.map((ratio) => (
                  <option key={ratio} value={ratio}>
                    {ratio}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.actions}>
              <button className={`${styles.button} ${styles.primaryButton}`} type="submit" disabled={isSaving}>
                Save edits
              </button>
              <button
                className={`${styles.button} ${styles.dangerButton}`}
                type="button"
                disabled={isSaving || selectedProject.status === "ARCHIVED"}
                onClick={archiveSelected}
              >
                Archive
              </button>
            </div>
          </form>
        ) : null}

        <p className={styles.message}>{message}</p>
        <p className={styles.helper}>
          Panels are not screens. A scene is a larger story section; a panel is one ordered story beat or shot container inside that scene.
        </p>
      </aside>
    </div>
  );
}

function draftTotals(draft: StoryAnalysisDraftItem) {
  return {
    scenes: draft.draft.scenes.length,
    panels: draft.draft.scenes.reduce((sum, scene) => sum + scene.panels.length, 0)
  };
}

function projectToForm(project?: ProjectListItem): ProjectFormState {
  return {
    title: project?.title ?? "",
    description: project?.description ?? "",
    aspectRatio: project?.aspectRatio ?? DEFAULT_PROJECT_ASPECT_RATIO
  };
}

function formatStatus(status: ProjectStatus) {
  return status === "ARCHIVED" ? "Archived" : "Draft";
}
