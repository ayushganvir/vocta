"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./scenes-workspace.module.css";

type PromptFields = {
  referenceNotes?: string | null;
  imagePrompt?: string | null;
  videoPrompt?: string | null;
  audioPrompt?: string | null;
  negativePrompt?: string | null;
};

type Panel = {
  id: string;
  projectId: string;
  sceneId: string;
  orderIndex: number;
  title: string;
  narrativePurpose: string | null;
  narrationText: string | null;
  visualIntent: string | null;
  motionIntent: string | null;
  targetDurationSeconds: number | null;
  notes: string | null;
  mappedEntityIds: string[];
  panelReferenceAssetIds: string[];
  promptFields: PromptFields;
  updatedAt: string;
};

type Scene = {
  id: string;
  projectId: string;
  orderIndex: number;
  title: string;
  summary: string | null;
  narrativePurpose: string | null;
  notes: string | null;
  panels: Panel[];
};

type ScenesResponse = {
  projectId: string | null;
  scenes: Scene[];
};

type Draft = {
  title: string;
  narrativePurpose: string;
  narrationText: string;
  visualIntent: string;
  motionIntent: string;
  targetDurationSeconds: string;
  mappedEntityIds: string;
  panelReferenceAssetIds: string;
  notes: string;
  referenceNotes: string;
  imagePrompt: string;
  videoPrompt: string;
  audioPrompt: string;
  negativePrompt: string;
};

const emptyDraft: Draft = {
  title: "",
  narrativePurpose: "",
  narrationText: "",
  visualIntent: "",
  motionIntent: "",
  targetDurationSeconds: "",
  mappedEntityIds: "",
  panelReferenceAssetIds: "",
  notes: "",
  referenceNotes: "",
  imagePrompt: "",
  videoPrompt: "",
  audioPrompt: "",
  negativePrompt: ""
};

export function ScenesWorkspace() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [status, setStatus] = useState("Loading scenes...");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void loadScenes();
  }, []);

  const selectedScene = useMemo(
    () => scenes.find((scene) => scene.id === selectedSceneId) ?? scenes[0] ?? null,
    [scenes, selectedSceneId]
  );
  const selectedPanel = useMemo(
    () =>
      selectedScene?.panels.find((panel) => panel.id === selectedPanelId) ??
      selectedScene?.panels[0] ??
      null,
    [selectedPanelId, selectedScene]
  );
  const hasPrompt = Boolean(
    draft.imagePrompt.trim() || draft.videoPrompt.trim() || draft.audioPrompt.trim()
  );
  const orderLabel = selectedPanel ? `${selectedScene?.orderIndex ?? 0}.${selectedPanel.orderIndex}` : "-";

  useEffect(() => {
    if (selectedPanel) {
      setDraft(panelToDraft(selectedPanel));
      setSelectedPanelId(selectedPanel.id);
    } else {
      setDraft(emptyDraft);
    }
  }, [selectedPanel]);

  async function loadScenes() {
    setStatus("Loading scenes...");
    const response = await fetch("/api/scenes", { cache: "no-store" });
    const data = (await response.json()) as ScenesResponse;

    setProjectId(data.projectId);
    setScenes(data.scenes);
    setSelectedSceneId((current) => current ?? data.scenes[0]?.id ?? null);
    setSelectedPanelId((current) => current ?? data.scenes[0]?.panels[0]?.id ?? null);
    setStatus(data.scenes.length ? "Scenes loaded." : "Create the first required scene.");
  }

  async function createScene() {
    if (!projectId) {
      setStatus("Seed or create a project before adding scenes.");
      return;
    }

    setIsBusy(true);
    const response = await fetch("/api/scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title: `Scene ${scenes.length + 1}`,
        summary: "",
        narrativePurpose: ""
      })
    });
    const data = (await response.json()) as { scene?: Scene; error?: string };

    if (data.scene) {
      setScenes((current) => [...current, data.scene as Scene]);
      setSelectedSceneId(data.scene.id);
      setSelectedPanelId(null);
      setStatus("Scene created.");
    } else {
      setStatus(data.error ?? "Scene create failed.");
    }

    setIsBusy(false);
  }

  async function createPanel() {
    if (!selectedScene) {
      setStatus("Create a scene before adding panels.");
      return;
    }

    setIsBusy(true);
    const response = await fetch(`/api/scenes/${selectedScene.id}/panels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Panel ${selectedScene.panels.length + 1}`,
        narrationText: "",
        visualIntent: "",
        motionIntent: "",
        notes: "",
        promptFields: {}
      })
    });
    const data = (await response.json()) as { panel?: Panel; error?: string };

    if (data.panel) {
      updateScenePanels(selectedScene.id, [...selectedScene.panels, data.panel]);
      setSelectedPanelId(data.panel.id);
      setStatus("Panel created.");
    } else {
      setStatus(data.error ?? "Panel create failed.");
    }

    setIsBusy(false);
  }

  async function savePanel() {
    if (!selectedPanel) {
      return;
    }

    setIsBusy(true);
    const response = await fetch(`/api/panels/${selectedPanel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftToPayload(draft))
    });
    const data = (await response.json()) as { panel?: Panel; error?: string };

    if (data.panel) {
      updatePanel(data.panel);
      setStatus("Panel saved. No generation was started.");
    } else {
      setStatus(data.error ?? "Panel save failed.");
    }

    setIsBusy(false);
  }

  async function duplicatePanel() {
    if (!selectedPanel || !selectedScene) {
      return;
    }

    setIsBusy(true);
    const response = await fetch(`/api/panels/${selectedPanel.id}/duplicate`, { method: "POST" });
    const data = (await response.json()) as { panel?: Panel; panels?: Panel[]; error?: string };

    if (data.panel && data.panels) {
      updateScenePanels(selectedScene.id, data.panels);
      setSelectedPanelId(data.panel.id);
      setStatus("Panel duplicated with a new stable ID.");
    } else {
      setStatus(data.error ?? "Panel duplicate failed.");
    }

    setIsBusy(false);
  }

  async function deletePanel() {
    if (!selectedPanel || !selectedScene) {
      return;
    }

    setIsBusy(true);
    const response = await fetch(`/api/panels/${selectedPanel.id}`, { method: "DELETE" });
    const data = (await response.json()) as { panels?: Panel[]; error?: string };

    if (data.panels) {
      updateScenePanels(selectedScene.id, data.panels);
      setSelectedPanelId(data.panels[0]?.id ?? null);
      setStatus("Panel deleted and scene order compacted.");
    } else {
      setStatus(data.error ?? "Panel delete failed.");
    }

    setIsBusy(false);
  }

  async function movePanel(direction: -1 | 1) {
    if (!selectedPanel || !selectedScene) {
      return;
    }

    const currentIndex = selectedScene.panels.findIndex((panel) => panel.id === selectedPanel.id);
    const targetIndex = currentIndex + direction;

    if (targetIndex < 0 || targetIndex >= selectedScene.panels.length) {
      return;
    }

    const reordered = [...selectedScene.panels];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];

    setIsBusy(true);
    const response = await fetch(`/api/scenes/${selectedScene.id}/panels/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedPanelIds: reordered.map((panel) => panel.id) })
    });
    const data = (await response.json()) as { panels?: Panel[]; error?: string };

    if (data.panels) {
      updateScenePanels(selectedScene.id, data.panels);
      setStatus("Panel order saved within the scene.");
    } else {
      setStatus(data.error ?? "Panel reorder failed.");
    }

    setIsBusy(false);
  }

  function updateScenePanels(sceneId: string, panels: Panel[]) {
    setScenes((current) =>
      current.map((scene) => (scene.id === sceneId ? { ...scene, panels } : scene))
    );
  }

  function updatePanel(panel: Panel) {
    setScenes((current) =>
      current.map((scene) =>
        scene.id === panel.sceneId
          ? {
              ...scene,
              panels: scene.panels.map((candidate) => (candidate.id === panel.id ? panel : candidate))
            }
          : scene
      )
    );
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.sceneRail} aria-label="Scenes">
        <div className={styles.panelHeader}>
          <div>
            <p>Required scenes</p>
            <h3>Scene list</h3>
          </div>
          <button type="button" onClick={createScene} disabled={isBusy}>
            Add
          </button>
        </div>

        <div className={styles.sceneList}>
          {scenes.map((scene) => (
            <button
              key={scene.id}
              type="button"
              className={scene.id === selectedScene?.id ? styles.selectedScene : styles.sceneButton}
              onClick={() => {
                setSelectedSceneId(scene.id);
                setSelectedPanelId(scene.panels[0]?.id ?? null);
              }}
            >
              <span>{String(scene.orderIndex).padStart(2, "0")}</span>
              <strong>{scene.title}</strong>
              <small>{scene.panels.length} panels</small>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.panelRail} aria-label="Panels">
        <div className={styles.panelHeader}>
          <div>
            <p>{selectedScene?.title ?? "No scene selected"}</p>
            <h3>Panel order</h3>
          </div>
          <button type="button" onClick={createPanel} disabled={isBusy || !selectedScene}>
            New
          </button>
        </div>

        <div className={styles.panelList}>
          {selectedScene?.panels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={panel.id === selectedPanel?.id ? styles.selectedPanel : styles.panelButton}
              onClick={() => setSelectedPanelId(panel.id)}
            >
              <span>{String(panel.orderIndex).padStart(2, "0")}</span>
              <strong>{panel.title}</strong>
              <small>{panel.narrationText || "No narration yet"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.detailPane} aria-label="Panel detail">
        <div className={styles.detailHeader}>
          <div>
            <p>Panel {orderLabel}</p>
            <h3>{selectedPanel?.title ?? "No panel selected"}</h3>
            <span>{selectedPanel?.id ?? "Create or select a panel"}</span>
          </div>
          <div className={styles.actionRow}>
            <button type="button" onClick={() => movePanel(-1)} disabled={isBusy || !selectedPanel}>
              Up
            </button>
            <button type="button" onClick={() => movePanel(1)} disabled={isBusy || !selectedPanel}>
              Down
            </button>
            <button type="button" onClick={duplicatePanel} disabled={isBusy || !selectedPanel}>
              Duplicate
            </button>
            <button type="button" onClick={deletePanel} disabled={isBusy || !selectedPanel}>
              Delete
            </button>
            <button type="button" onClick={savePanel} disabled={isBusy || !selectedPanel}>
              Save
            </button>
          </div>
        </div>

        <div className={styles.warningBar} role="status">
          <strong>{hasPrompt ? "Generation requirements ready" : "Prompt required before generation"}</strong>
          <span>References are optional here; missing-reference hard rules can be enforced later.</span>
        </div>

        <div className={styles.formGrid}>
          <Field label="Panel title" value={draft.title} onChange={(title) => setDraftField("title", title)} />
          <Field
            label="Target duration seconds"
            value={draft.targetDurationSeconds}
            onChange={(targetDurationSeconds) => setDraftField("targetDurationSeconds", targetDurationSeconds)}
          />
          <Area label="Narration" value={draft.narrationText} onChange={(value) => setDraftField("narrationText", value)} />
          <Area label="Visual intent" value={draft.visualIntent} onChange={(value) => setDraftField("visualIntent", value)} />
          <Area label="Motion intent" value={draft.motionIntent} onChange={(value) => setDraftField("motionIntent", value)} />
          <Area label="Narrative purpose" value={draft.narrativePurpose} onChange={(value) => setDraftField("narrativePurpose", value)} />
          <Area label="Reference asset IDs" value={draft.panelReferenceAssetIds} onChange={(value) => setDraftField("panelReferenceAssetIds", value)} />
          <Area label="Mapped entity IDs" value={draft.mappedEntityIds} onChange={(value) => setDraftField("mappedEntityIds", value)} />
          <Area label="Reference notes" value={draft.referenceNotes} onChange={(value) => setDraftField("referenceNotes", value)} />
          <Area label="Panel notes" value={draft.notes} onChange={(value) => setDraftField("notes", value)} />
          <Area label="Image prompt" value={draft.imagePrompt} onChange={(value) => setDraftField("imagePrompt", value)} />
          <Area label="Video prompt" value={draft.videoPrompt} onChange={(value) => setDraftField("videoPrompt", value)} />
          <Area label="Audio prompt" value={draft.audioPrompt} onChange={(value) => setDraftField("audioPrompt", value)} />
          <Area label="Negative prompt" value={draft.negativePrompt} onChange={(value) => setDraftField("negativePrompt", value)} />
        </div>

        <div className={styles.manualActions}>
          <button type="button" disabled={!hasPrompt}>
            Generate image
          </button>
          <button type="button" disabled={!hasPrompt}>
            Generate video
          </button>
          <button type="button" disabled={!hasPrompt}>
            Generate voice
          </button>
          <span>{status}</span>
        </div>
      </section>
    </div>
  );

  function setDraftField(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className={styles.area}>
      <span>{label}</span>
      <textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function panelToDraft(panel: Panel): Draft {
  return {
    title: panel.title,
    narrativePurpose: panel.narrativePurpose ?? "",
    narrationText: panel.narrationText ?? "",
    visualIntent: panel.visualIntent ?? "",
    motionIntent: panel.motionIntent ?? "",
    targetDurationSeconds: panel.targetDurationSeconds?.toString() ?? "",
    mappedEntityIds: panel.mappedEntityIds.join(", "),
    panelReferenceAssetIds: panel.panelReferenceAssetIds.join(", "),
    notes: panel.notes ?? "",
    referenceNotes: panel.promptFields.referenceNotes ?? "",
    imagePrompt: panel.promptFields.imagePrompt ?? "",
    videoPrompt: panel.promptFields.videoPrompt ?? "",
    audioPrompt: panel.promptFields.audioPrompt ?? "",
    negativePrompt: panel.promptFields.negativePrompt ?? ""
  };
}

function draftToPayload(draft: Draft) {
  const duration = Number.parseInt(draft.targetDurationSeconds, 10);

  return {
    title: draft.title || "Untitled panel",
    narrativePurpose: draft.narrativePurpose,
    narrationText: draft.narrationText,
    visualIntent: draft.visualIntent,
    motionIntent: draft.motionIntent,
    targetDurationSeconds: Number.isFinite(duration) ? duration : null,
    mappedEntityIds: splitIds(draft.mappedEntityIds),
    panelReferenceAssetIds: splitIds(draft.panelReferenceAssetIds),
    notes: draft.notes,
    promptFields: {
      referenceNotes: draft.referenceNotes,
      imagePrompt: draft.imagePrompt,
      videoPrompt: draft.videoPrompt,
      audioPrompt: draft.audioPrompt,
      negativePrompt: draft.negativePrompt
    }
  };
}

function splitIds(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
