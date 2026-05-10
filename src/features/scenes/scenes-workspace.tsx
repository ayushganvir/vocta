"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./scenes-workspace.module.css";
import {
  audioFormats,
  audioPaces,
  generationAspectRatios,
  videoResolutions,
  videoSourceModes,
  type AudioSettings,
  type VideoSettings
} from "@/features/generation/settings";

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
  firstFrameAssetId: string | null;
  lastFrameAssetId: string | null;
  selectedImageAssetId: string | null;
  selectedVideoAssetId: string | null;
  selectedAudioAssetId: string | null;
  promptFields: PromptFields;
  audioSettings: AudioSettings;
  videoSettings: VideoSettings;
  staleState: Record<string, unknown>;
  generatedAssets: GeneratedAsset[];
  generationJobs: GenerationJob[];
  updatedAt: string;
};

type EntityOption = {
  id: string;
  name: string;
  type: string;
  metadata: {
    speakerOnly: boolean;
    voiceId: string;
    voiceLabel: string;
    voiceNotes: string;
    defaultEmotion: string;
    speakingRate: number | "";
    pitch: number | "";
    sampleText: string;
  };
};

type GeneratedAsset = {
  id: string;
  assetType: "IMAGE" | "VIDEO" | "AUDIO" | "REFERENCE" | "FILE";
  fileUrl: string;
  previewUrl: string | null;
  mimeType: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  isSelected: boolean;
  metadata: Record<string, unknown>;
  generationJobId: string | null;
  createdAt: string;
};

type GenerationJob = {
  id: string;
  type: string;
  provider: string;
  model: string;
  status: string;
  compiledPrompt: string | null;
  requestPayload: unknown;
  responsePayloadSummary: unknown;
  logs: unknown;
  errorPayload: unknown;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
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

type AudioOptions = {
  speakerEntityId: string;
  voiceId: string;
  voiceLabel: string;
  voiceNotes: string;
  pace: AudioSettings["pace"];
  emotion: string;
  speakingRate: string;
  pitch: string;
  format: AudioSettings["format"];
};

type VideoOptions = {
  durationSeconds: string;
  aspectRatio: VideoSettings["aspectRatio"];
  resolution: VideoSettings["resolution"];
  sourceMode: VideoSettings["sourceMode"];
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
  const [promptDraft, setPromptDraft] = useState<Partial<Draft> | null>(null);
  const [promptDraftRationale, setPromptDraftRationale] = useState<string[]>([]);
  const [audioOptions, setAudioOptions] = useState<AudioOptions>({
    speakerEntityId: "",
    voiceId: "",
    voiceLabel: "",
    voiceNotes: "",
    pace: "normal",
    emotion: "",
    speakingRate: "",
    pitch: "",
    format: "wav"
  });
  const [videoOptions, setVideoOptions] = useState<VideoOptions>({
    durationSeconds: "",
    aspectRatio: "9:16",
    resolution: "720p",
    sourceMode: "text_to_video"
  });
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [status, setStatus] = useState("Loading scenes...");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void loadScenes();
  }, []);

  useEffect(() => {
    if (projectId) {
      void loadEntities(projectId);
    }
  }, [projectId]);

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
  const mappedVoiceEntities = useMemo(() => {
    const mapped = new Set(selectedPanel?.mappedEntityIds ?? []);
    return entities.filter((entity) => mapped.has(entity.id) && (entity.metadata.speakerOnly || entity.type === "character" || entity.type === "speaker"));
  }, [entities, selectedPanel?.mappedEntityIds]);

  useEffect(() => {
    if (selectedPanel) {
      setDraft(panelToDraft(selectedPanel));
      setAudioOptions(audioSettingsToOptions(selectedPanel.audioSettings));
      setVideoOptions(videoSettingsToOptions(selectedPanel.videoSettings, selectedPanel.targetDurationSeconds));
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

  async function loadEntities(nextProjectId: string) {
    const response = await fetch(`/api/entities?projectId=${nextProjectId}`, { cache: "no-store" });
    const data = (await response.json()) as { entities?: EntityOption[] };
    setEntities(data.entities ?? []);
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
      body: JSON.stringify(draftToPayload(draft, audioOptions, videoOptions))
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

  async function enhancePrompts() {
    if (!selectedPanel) {
      return;
    }

    setIsBusy(true);
    const response = await fetch("/api/prompt-enhancement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panelId: selectedPanel.id })
    });
    const data = (await response.json()) as {
      draft?: {
        imagePrompt: string;
        videoPrompt: string;
        audioPrompt: string;
        referenceNotes: string;
        notes: string;
      };
      rationale?: string[];
      warnings?: string[];
      error?: string;
    };

    if (data.draft) {
      setPromptDraft(data.draft);
      setPromptDraftRationale(data.rationale ?? []);
      setStatus(
        data.warnings?.length
          ? `Prompt suggestions ready with ${data.warnings.length} warning(s). Apply fields manually.`
          : "Prompt suggestions ready. Apply fields manually."
      );
    } else {
      setStatus(data.error ?? "Prompt enhancement failed.");
    }

    setIsBusy(false);
  }

  async function generateImage(frameRole: "image" | "first_frame" | "last_frame") {
    if (!selectedPanel) {
      return;
    }

    await runGeneration("/api/generation/image", {
      panelId: selectedPanel.id,
      frameRole
    }, frameRole === "image" ? "Image generated and selected." : `${frameRole.replace("_", " ")} generated and selected.`);
  }

  async function generateVideo() {
    if (!selectedPanel) {
      return;
    }

    await runGeneration("/api/generation/video", {
      panelId: selectedPanel.id,
      durationSeconds: toNullableInt(videoOptions.durationSeconds),
      aspectRatio: videoOptions.aspectRatio,
      resolution: videoOptions.resolution,
      sourceMode: videoOptions.sourceMode
    }, "Video generated and selected.");
  }

  async function generateAudio() {
    if (!selectedPanel) {
      return;
    }

    await runGeneration("/api/generation/audio", {
      panelId: selectedPanel.id,
      speakerEntityId: audioOptions.speakerEntityId || null,
      voiceId: audioOptions.voiceId || null,
      voiceLabel: audioOptions.voiceLabel || null,
      voiceNotes: audioOptions.voiceNotes || null,
      pace: audioOptions.pace,
      emotion: audioOptions.emotion || null,
      speakingRate: toNullableFloat(audioOptions.speakingRate),
      pitch: toNullableFloat(audioOptions.pitch),
      format: audioOptions.format
    }, "Voiceover generated and selected.");
  }

  function selectSpeakerEntity(entityId: string) {
    const entity = entities.find((item) => item.id === entityId);
    setAudioOptions((current) => ({
      ...current,
      speakerEntityId: entityId,
      voiceId: entity?.metadata.voiceId || current.voiceId,
      voiceLabel: entity?.metadata.voiceLabel || current.voiceLabel,
      voiceNotes: entity?.metadata.voiceNotes || current.voiceNotes,
      emotion: entity?.metadata.defaultEmotion || current.emotion,
      speakingRate: entity?.metadata.speakingRate === "" ? current.speakingRate : String(entity?.metadata.speakingRate ?? current.speakingRate),
      pitch: entity?.metadata.pitch === "" ? current.pitch : String(entity?.metadata.pitch ?? current.pitch)
    }));
  }

  async function runGeneration(endpoint: string, payload: Record<string, unknown>, successMessage: string) {
    setIsBusy(true);
    setStatus("Generation job running...");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = (await response.json()) as { panel?: Panel; error?: string };

    if (data.panel) {
      updatePanel(data.panel);
      setStatus(successMessage);
    } else {
      setStatus(data.error ?? "Generation failed.");
    }

    setIsBusy(false);
  }

  async function selectAsset(assetId: string) {
    if (!selectedPanel) {
      return;
    }

    setIsBusy(true);
    const response = await fetch("/api/assets/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        panelId: selectedPanel.id,
        assetId
      })
    });
    const data = (await response.json()) as { panel?: Panel; error?: string };

    if (data.panel) {
      updatePanel(data.panel);
      setStatus("Asset selection updated.");
    } else {
      setStatus(data.error ?? "Asset selection failed.");
    }

    setIsBusy(false);
  }

  async function clearStaleWarnings() {
    if (!selectedPanel) {
      return;
    }

    setIsBusy(true);
    const response = await fetch(`/api/panels/${selectedPanel.id}/stale`, { method: "DELETE" });
    const data = (await response.json()) as { panel?: Panel; error?: string };

    if (data.panel) {
      updatePanel(data.panel);
      setStatus("Stale warnings cleared for this panel.");
    } else {
      setStatus(data.error ?? "Could not clear stale warnings.");
    }

    setIsBusy(false);
  }

  function applyPromptDraftField(field: keyof Draft) {
    if (!promptDraft?.[field]) {
      return;
    }

    setDraftField(field, promptDraft[field] ?? "");
    setStatus(`${field} suggestion applied locally. Click Save to persist.`);
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
              {staleWarnings(panel).length ? <em>{staleWarnings(panel).length} stale</em> : null}
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
            <button type="button" onClick={enhancePrompts} disabled={isBusy || !selectedPanel}>
              Enhance prompts
            </button>
          </div>
        </div>

        <div className={styles.warningBar} role="status">
          <strong>{hasPrompt ? "Generation requirements ready" : "Prompt required before generation"}</strong>
          <span>
            {selectedPanel && staleWarnings(selectedPanel).length
              ? `${staleWarnings(selectedPanel).length} stale warning(s). Review before export.`
              : "References are optional here; missing-reference hard rules can be enforced later."}
          </span>
          {selectedPanel && staleWarnings(selectedPanel).length ? (
            <button type="button" onClick={clearStaleWarnings} disabled={isBusy}>
              Mark reviewed
            </button>
          ) : null}
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

        <div className={styles.settingsGrid}>
          <section className={styles.settingsPanel}>
            <div className={styles.sectionHeader}>
              <div>
                <p>Video generation settings</p>
                <h4>Resolved per panel</h4>
              </div>
            </div>
            <Field label="Duration seconds" value={videoOptions.durationSeconds} onChange={(durationSeconds) => setVideoOptions((current) => ({ ...current, durationSeconds }))} />
            <label className={styles.field}>
              <span>Aspect ratio</span>
              <select value={videoOptions.aspectRatio} onChange={(event) => setVideoOptions((current) => ({ ...current, aspectRatio: event.target.value as VideoOptions["aspectRatio"] }))}>
                {generationAspectRatios.map((ratio) => (
                  <option key={ratio} value={ratio}>{ratio}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Resolution</span>
              <select value={videoOptions.resolution} onChange={(event) => setVideoOptions((current) => ({ ...current, resolution: event.target.value as VideoOptions["resolution"] }))}>
                {videoResolutions.map((resolution) => (
                  <option key={resolution} value={resolution}>{resolution}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Source mode</span>
              <select value={videoOptions.sourceMode} onChange={(event) => setVideoOptions((current) => ({ ...current, sourceMode: event.target.value as VideoOptions["sourceMode"] }))}>
                {videoSourceModes.map((mode) => (
                  <option key={mode} value={mode}>{mode.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
          </section>

          <section className={styles.settingsPanel}>
            <div className={styles.sectionHeader}>
              <div>
                <p>Audio generation settings</p>
                <h4>Entity inheritance + overrides</h4>
              </div>
            </div>
            <label className={styles.field}>
              <span>Speaker/entity</span>
              <select value={audioOptions.speakerEntityId} onChange={(event) => selectSpeakerEntity(event.target.value)}>
                <option value="">Project/default voice</option>
                {mappedVoiceEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>{entity.name}</option>
                ))}
              </select>
            </label>
            <Field label="Voice ID override" value={audioOptions.voiceId} onChange={(voiceId) => setAudioOptions((current) => ({ ...current, voiceId }))} />
            <Field label="Voice label" value={audioOptions.voiceLabel} onChange={(voiceLabel) => setAudioOptions((current) => ({ ...current, voiceLabel }))} />
            <Field label="Emotion/style" value={audioOptions.emotion} onChange={(emotion) => setAudioOptions((current) => ({ ...current, emotion }))} />
            <Field label="Speaking rate" value={audioOptions.speakingRate} onChange={(speakingRate) => setAudioOptions((current) => ({ ...current, speakingRate }))} />
            <Field label="Pitch" value={audioOptions.pitch} onChange={(pitch) => setAudioOptions((current) => ({ ...current, pitch }))} />
            <label className={styles.field}>
              <span>Pace</span>
              <select value={audioOptions.pace} onChange={(event) => setAudioOptions((current) => ({ ...current, pace: event.target.value as AudioOptions["pace"] }))}>
                {audioPaces.map((pace) => (
                  <option key={pace} value={pace}>{pace}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Format</span>
              <select value={audioOptions.format} onChange={(event) => setAudioOptions((current) => ({ ...current, format: event.target.value as AudioOptions["format"] }))}>
                {audioFormats.map((format) => (
                  <option key={format} value={format}>{format}</option>
                ))}
              </select>
            </label>
            <Area label="Voice notes" value={audioOptions.voiceNotes} onChange={(voiceNotes) => setAudioOptions((current) => ({ ...current, voiceNotes }))} />
          </section>
        </div>

        <div className={styles.manualActions}>
          <button type="button" onClick={() => generateImage("image")} disabled={isBusy || !selectedPanel || !hasPrompt}>
            Generate image
          </button>
          <button type="button" onClick={() => generateImage("first_frame")} disabled={isBusy || !selectedPanel || !hasPrompt}>
            Generate first frame
          </button>
          <button type="button" onClick={() => generateImage("last_frame")} disabled={isBusy || !selectedPanel || !hasPrompt}>
            Generate last frame
          </button>
          <button type="button" onClick={generateVideo} disabled={isBusy || !selectedPanel || !hasPrompt}>
            Generate video
          </button>
          <button type="button" onClick={generateAudio} disabled={isBusy || !selectedPanel || !hasPrompt}>
            Generate voice
          </button>
          <span>{status}</span>
        </div>

        {selectedPanel ? (
          <>
            <StaleWarnings panel={selectedPanel} onClear={clearStaleWarnings} isBusy={isBusy} />
            <AssetHistory panel={selectedPanel} onSelectAsset={selectAsset} isBusy={isBusy} />
            <DebugInspector jobs={selectedPanel.generationJobs} />
          </>
        ) : null}

        {promptDraft ? (
          <div className={styles.warningBar} role="status">
            <strong>Prompt suggestions ready</strong>
            <span>
              Apply individual fields, edit them, then click Save. {promptDraftRationale.join(" ")}
            </span>
            <button type="button" onClick={() => applyPromptDraftField("imagePrompt")}>
              Apply image prompt
            </button>
            <button type="button" onClick={() => applyPromptDraftField("videoPrompt")}>
              Apply video prompt
            </button>
            <button type="button" onClick={() => applyPromptDraftField("audioPrompt")}>
              Apply audio prompt
            </button>
            <button type="button" onClick={() => applyPromptDraftField("referenceNotes")}>
              Apply reference notes
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );

  function setDraftField(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }
}

function StaleWarnings({ panel, onClear, isBusy }: { panel: Panel; onClear: () => void; isBusy: boolean }) {
  const warnings = staleWarnings(panel);

  if (!warnings.length) {
    return null;
  }

  return (
    <section className={styles.staleSection}>
      <div className={styles.sectionHeader}>
        <div>
          <p>Stale dependencies</p>
          <h4>Needs review</h4>
        </div>
        <button type="button" onClick={onClear} disabled={isBusy}>
          Mark reviewed
        </button>
      </div>
      <ul>
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}

function AssetHistory({
  panel,
  onSelectAsset,
  isBusy
}: {
  panel: Panel;
  onSelectAsset: (assetId: string) => void;
  isBusy: boolean;
}) {
  const assets = panel.generatedAssets ?? [];
  const panelIsStale = staleWarnings(panel).length > 0;

  return (
    <section className={styles.assetSection}>
      <div className={styles.sectionHeader}>
        <div>
          <p>Asset history</p>
          <h4>Generated candidates</h4>
        </div>
        <span>{assets.length} total</span>
      </div>
      {assets.length ? (
        <div className={styles.assetGrid}>
          {assets.map((asset) => (
            <article key={asset.id} className={styles.assetCard}>
              {asset.assetType === "IMAGE" ? (
                <img src={asset.previewUrl ?? asset.fileUrl} alt="" />
              ) : (
                <div className={styles.assetPlaceholder}>{asset.assetType}</div>
              )}
              <div>
                <strong>{asset.assetType.toLowerCase()}</strong>
                <span>{asset.isSelected ? "selected" : "not selected"}</span>
                {panelIsStale ? <span>panel stale</span> : null}
                <small>{asset.durationSeconds ? `${asset.durationSeconds}s` : asset.mimeType}</small>
                <small>{frameLabel(asset)}</small>
                {canSelectAsset(asset) ? (
                  <button type="button" onClick={() => onSelectAsset(asset.id)} disabled={isBusy || asset.isSelected}>
                    {asset.isSelected ? "Selected" : "Select"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.emptyState}>No generated assets yet.</p>
      )}
    </section>
  );
}

function DebugInspector({ jobs }: { jobs: GenerationJob[] }) {
  return (
    <section className={styles.debugSection}>
      <div className={styles.sectionHeader}>
        <div>
          <p>Debug inspector</p>
          <h4>Recent generation jobs</h4>
        </div>
        <span>{jobs.length} shown</span>
      </div>
      {jobs.length ? (
        <div className={styles.jobList}>
          {jobs.map((job) => (
            <details key={job.id} className={styles.jobCard}>
              <summary>
                <strong>{job.type}</strong>
                <span>{job.status}</span>
                <small>{job.provider}/{job.model}</small>
              </summary>
              <pre>{job.compiledPrompt ?? "No compiled prompt stored."}</pre>
              <pre>{JSON.stringify({
                requestPayload: job.requestPayload,
                responsePayloadSummary: job.responsePayloadSummary,
                logs: job.logs,
                errorPayload: job.errorPayload,
                durationMs: job.durationMs
              }, null, 2)}</pre>
            </details>
          ))}
        </div>
      ) : (
        <p className={styles.emptyState}>No generation jobs yet.</p>
      )}
    </section>
  );
}

function frameLabel(asset: GeneratedAsset) {
  const frameRole = asset.metadata?.frameRole;
  return typeof frameRole === "string" ? frameRole.replace("_", " ") : "candidate";
}

function canSelectAsset(asset: GeneratedAsset) {
  return asset.assetType === "IMAGE" || asset.assetType === "VIDEO" || asset.assetType === "AUDIO";
}

function staleWarnings(panel: Panel) {
  return Object.entries(panel.staleState ?? {})
    .filter(([key, value]) => key !== "updatedAt" && Boolean(value))
    .map(([key, value]) => (typeof value === "string" ? value : key));
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

function draftToPayload(
  draft: Draft,
  audioOptions?: ReturnType<typeof audioSettingsToOptions>,
  videoOptions?: ReturnType<typeof videoSettingsToOptions>
) {
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
    },
    audioSettings: audioOptions
      ? {
          speakerEntityId: audioOptions.speakerEntityId || null,
          voiceId: audioOptions.voiceId || null,
          voiceLabel: audioOptions.voiceLabel || null,
          voiceNotes: audioOptions.voiceNotes || null,
          emotion: audioOptions.emotion || null,
          pace: audioOptions.pace,
          speakingRate: toNullableFloat(audioOptions.speakingRate),
          pitch: toNullableFloat(audioOptions.pitch),
          format: audioOptions.format
        }
      : undefined,
    videoSettings: videoOptions
      ? {
          durationSeconds: toNullableInt(videoOptions.durationSeconds),
          aspectRatio: videoOptions.aspectRatio,
          resolution: videoOptions.resolution,
          sourceMode: videoOptions.sourceMode
        }
      : undefined
  };
}

function splitIds(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function audioSettingsToOptions(settings: AudioSettings) {
  return {
    speakerEntityId: settings.speakerEntityId ?? "",
    voiceId: settings.voiceId ?? "",
    voiceLabel: settings.voiceLabel ?? "",
    voiceNotes: settings.voiceNotes ?? "",
    pace: settings.pace,
    emotion: settings.emotion ?? "",
    speakingRate: settings.speakingRate === null ? "" : String(settings.speakingRate),
    pitch: settings.pitch === null ? "" : String(settings.pitch),
    format: settings.format
  };
}

function videoSettingsToOptions(settings: VideoSettings, fallbackDurationSeconds?: number | null) {
  return {
    durationSeconds: settings.durationSeconds?.toString() ?? fallbackDurationSeconds?.toString() ?? "",
    aspectRatio: settings.aspectRatio,
    resolution: settings.resolution,
    sourceMode: settings.sourceMode
  };
}

function toNullableInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toNullableFloat(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}
