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
  const [message, setMessage] = useState("Create, edit, and archive actions are saved only after an explicit click.");
  const [isSaving, setIsSaving] = useState(false);

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
        <p className={styles.helper}>Project duration is intentionally optional for MVP.</p>
      </aside>
    </div>
  );
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
