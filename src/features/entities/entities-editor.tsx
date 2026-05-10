"use client";

import { useMemo, useState, useTransition } from "react";

import { getReferenceWarning, mvpEntityTypes, type EntityMetadata, type EntityRecord } from "./schema";

type EntitiesEditorProps = {
  project: { id: string; title: string } | null;
  initialEntities: EntityRecord[];
};

type EntityFormState = {
  id: string | null;
  name: string;
  type: string;
  description: string;
  visualPromptBlock: string;
  selectedReferenceAssetId: string;
  notes: string;
  speakerOnly: boolean;
  voiceId: string;
  voiceLabel: string;
  voiceNotes: string;
  defaultEmotion: string;
  speakingRate: string;
  pitch: string;
  sampleText: string;
};

type ExtractionDraftEntity = {
  draftId: string;
  name: string;
  type: string;
  description: string;
  visualPromptBlock: string | null;
  duplicateOfEntityId: string | null;
  duplicateReason: string | null;
  rationale: string;
  sourceTextSnippets: string[];
  metadata: {
    speakerOnly: boolean;
    confidence: number;
  };
};

type ExtractionDraft = {
  generationJobId: string;
  draftEntities: ExtractionDraftEntity[];
};

type MappingSuggestion = {
  panelId: string;
  suggestedEntityIds: string[];
  confidence: number;
  rationale: string;
  missingReferenceWarnings: string[];
};

type MappingDraft = {
  generationJobId: string;
  mappings: MappingSuggestion[];
};

const emptyForm: EntityFormState = {
  id: null,
  name: "",
  type: "character",
  description: "",
  visualPromptBlock: "",
  selectedReferenceAssetId: "",
  notes: "",
  speakerOnly: false,
  voiceId: "",
  voiceLabel: "",
  voiceNotes: "",
  defaultEmotion: "",
  speakingRate: "",
  pitch: "",
  sampleText: ""
};

export function EntitiesEditor({ project, initialEntities }: EntitiesEditorProps) {
  const [entities, setEntities] = useState(initialEntities);
  const [formState, setFormState] = useState<EntityFormState>(emptyForm);
  const [status, setStatus] = useState("Visual entities without a reference will hard-warn before generation.");
  const [extractionText, setExtractionText] = useState("");
  const [extractionDraft, setExtractionDraft] = useState<ExtractionDraft | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [mappingDraft, setMappingDraft] = useState<MappingDraft | null>(null);
  const [isPending, startTransition] = useTransition();

  const referenceWarnings = useMemo(
    () => entities.filter((entity) => getReferenceWarning(entity)).length,
    [entities]
  );
  const entityNameById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity.name])), [entities]);

  if (!project) {
    return (
      <section className="widePanel">
        <div className="sectionTitle">
          <h3>Entity Registry</h3>
          <span>No project</span>
        </div>
        <p>Create a project first, then return here to add characters, places, and objects.</p>
      </section>
    );
  }

  const activeProject = project;

  function setField<Key extends keyof EntityFormState>(field: Key, value: EntityFormState[Key]) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  function editEntity(entity: EntityRecord) {
    setFormState({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      description: entity.description ?? "",
      visualPromptBlock: entity.visualPromptBlock ?? "",
      selectedReferenceAssetId: entity.selectedReferenceAssetId ?? "",
      notes: entity.notes ?? "",
      speakerOnly: entity.metadata.speakerOnly,
      voiceId: entity.metadata.voiceId,
      voiceLabel: entity.metadata.voiceLabel,
      voiceNotes: entity.metadata.voiceNotes,
      defaultEmotion: entity.metadata.defaultEmotion,
      speakingRate: entity.metadata.speakingRate === "" ? "" : String(entity.metadata.speakingRate),
      pitch: entity.metadata.pitch === "" ? "" : String(entity.metadata.pitch),
      sampleText: entity.metadata.sampleText
    });
  }

  function resetForm() {
    setFormState(emptyForm);
  }

  function payloadFromForm() {
    const metadata: EntityMetadata = {
      speakerOnly: formState.speakerOnly,
      voiceId: formState.voiceId,
      voiceLabel: formState.voiceLabel,
      voiceNotes: formState.voiceNotes,
      defaultEmotion: formState.defaultEmotion,
      speakingRate: numberOrBlank(formState.speakingRate),
      pitch: numberOrBlank(formState.pitch),
      sampleText: formState.sampleText
    };

    return {
      projectId: activeProject.id,
      name: formState.name,
      type: formState.type,
      description: formState.description,
      visualPromptBlock: formState.visualPromptBlock,
      selectedReferenceAssetId: formState.speakerOnly ? "" : formState.selectedReferenceAssetId,
      notes: formState.notes,
      metadata
    };
  }

  function saveEntity() {
    startTransition(async () => {
      const isEditing = Boolean(formState.id);
      const response = await fetch(isEditing ? `/api/entities/${formState.id}` : "/api/entities", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromForm())
      });

      if (!response.ok) {
        setStatus("Save failed. Name and type are required.");
        return;
      }

      const payload = (await response.json()) as { entity: EntityRecord };
      setEntities((current) => {
        const next = current.filter((entity) => entity.id !== payload.entity.id);
        return [...next, payload.entity].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
      });
      setStatus(isEditing ? "Entity updated." : "Entity created.");
      resetForm();
    });
  }

  function deleteEntity(entity: EntityRecord) {
    const mappedCopy =
      entity.mappedPanelCount > 0
        ? `This entity is mapped to ${entity.mappedPanelCount} panel(s). Delete anyway?`
        : "Delete this entity?";

    if (!window.confirm(mappedCopy)) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/entities/${entity.id}?projectId=${activeProject.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        setStatus("Delete failed. Refresh and try again.");
        return;
      }

      const payload = (await response.json()) as { mappedPanelCount: number };
      setEntities((current) => current.filter((currentEntity) => currentEntity.id !== entity.id));
      setStatus(
        payload.mappedPanelCount > 0
          ? "Entity deleted. It had panel mappings; cleanup support is preserved at the API boundary."
          : "Entity deleted."
      );
      if (formState.id === entity.id) {
        resetForm();
      }
    });
  }

  function previewVoice() {
    startTransition(async () => {
      const response = await fetch("/api/providers/google/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: formState.voiceId,
          sampleText: formState.sampleText || "This is a Vocta voice preview.",
          emotion: formState.defaultEmotion,
          speakingRate: formState.speakingRate,
          pitch: formState.pitch
        })
      });
      const payload = (await response.json()) as { previewUrl?: string; voiceLabel?: string; error?: string };

      if (!response.ok || !payload.previewUrl) {
        setStatus(payload.error ?? "Voice preview failed.");
        return;
      }

      setStatus(`Voice preview ready: ${payload.voiceLabel ?? (formState.voiceId || "mock voice")} (${payload.previewUrl})`);
    });
  }

  function draftEntityExtraction() {
    startTransition(async () => {
      const response = await fetch("/api/entity-extraction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeProject.id,
          text: extractionText
        })
      });
      const payload = (await response.json()) as { draft?: ExtractionDraft; error?: string };

      if (!response.ok || !payload.draft) {
        setStatus(payload.error ?? "Entity extraction failed.");
        return;
      }

      setExtractionDraft(payload.draft);
      setSelectedDraftIds(
        new Set(
          payload.draft.draftEntities
            .filter((draft) => !draft.duplicateOfEntityId)
            .map((draft) => draft.draftId)
        )
      );
      setStatus("Entity extraction draft ready. Nothing was applied.");
    });
  }

  function toggleDraftEntity(draftId: string) {
    setSelectedDraftIds((current) => {
      const next = new Set(current);
      if (next.has(draftId)) {
        next.delete(draftId);
      } else {
        next.add(draftId);
      }
      return next;
    });
  }

  function applySelectedDraftEntities() {
    if (!extractionDraft) return;

    const draftEntities = extractionDraft.draftEntities.filter((draft) => selectedDraftIds.has(draft.draftId));
    if (draftEntities.length === 0) {
      setStatus("Select at least one draft entity to apply.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/entity-extraction/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeProject.id,
          sourceGenerationJobId: extractionDraft.generationJobId,
          draftEntities
        })
      });
      const payload = (await response.json()) as { entities?: EntityRecord[]; error?: string };

      if (!response.ok || !payload.entities) {
        setStatus(payload.error ?? "Applying extracted entities failed.");
        return;
      }

      const appliedEntities = payload.entities;
      setEntities((current) =>
        [...current, ...appliedEntities].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
      );
      setExtractionDraft(null);
      setSelectedDraftIds(new Set());
      setStatus(`Applied ${appliedEntities.length} extracted entity record(s).`);
    });
  }

  function draftEntityMappings() {
    startTransition(async () => {
      const response = await fetch("/api/entity-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: activeProject.id })
      });
      const payload = (await response.json()) as { draft?: MappingDraft; error?: string };

      if (!response.ok || !payload.draft) {
        setStatus(payload.error ?? "Entity mapping failed.");
        return;
      }

      setMappingDraft(payload.draft);
      setStatus("Entity mapping suggestions ready. Nothing was applied.");
    });
  }

  function applyMappingDraft() {
    if (!mappingDraft) return;

    startTransition(async () => {
      const response = await fetch("/api/entity-mapping/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeProject.id,
          mappings: mappingDraft.mappings
        })
      });
      const payload = (await response.json()) as { appliedCount?: number; error?: string };

      if (!response.ok) {
        setStatus(payload.error ?? "Applying mapping suggestions failed.");
        return;
      }

      setMappingDraft(null);
      setStatus(`Applied mappings to ${payload.appliedCount ?? 0} panel(s). Prompt compilation will now use mapped entities.`);
    });
  }

  return (
    <div className="workspaceGrid">
      <section className="widePanel">
        <div className="sectionTitle">
          <h3>{activeProject.title} Entity Registry</h3>
          <span>{entities.length} records</span>
        </div>
        <div className="entityList">
          {entities.length === 0 ? (
            <p>No entities yet. Add a character, place, object, or speaker-only record.</p>
          ) : (
            entities.map((entity) => {
              const referenceWarning = getReferenceWarning(entity);

              return (
                <article key={entity.id} className="entityRow">
                  <div className="entityThumb" aria-hidden="true">
                    {entity.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <strong>{entity.name}</strong>
                    <span>{entity.type}</span>
                  </div>
                  <p>{entity.metadata.speakerOnly ? "Speaker/narrator only, no image reference required" : entity.selectedReferenceAssetId || "Missing reference"}</p>
                  <small>
                    {entity.metadata.voiceLabel || entity.metadata.voiceId
                      ? `Voice: ${entity.metadata.voiceLabel || entity.metadata.voiceId}`
                      : referenceWarning ??
                        (entity.mappedPanelCount > 0 ? `Mapped to ${entity.mappedPanelCount} panel(s)` : "Not mapped")}
                    <span className="inlineActions" style={{ marginTop: 6 }}>
                    <button type="button" onClick={() => editEntity(entity)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteEntity(entity)}>
                      Delete
                    </button>
                    </span>
                  </small>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="stackPanel">
        <section className="infoCard">
          <p className="label">{formState.id ? "Edit entity" : "New entity"}</p>
          <strong>{formState.name || "Untitled"}</strong>
          <p>{status}</p>
        </section>

        <label className="fieldBlock">
          <span>Name</span>
          <input value={formState.name} onChange={(event) => setField("name", event.target.value)} />
        </label>

        <label className="fieldBlock">
          <span>Type</span>
          <input
            list="entity-types"
            value={formState.type}
            onChange={(event) => setField("type", event.target.value)}
          />
          <datalist id="entity-types">
            {mvpEntityTypes.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </label>

        <label className="checklistItem">
          <span>Speaker or narrator only</span>
          <input
            type="checkbox"
            checked={formState.speakerOnly}
            onChange={(event) => setField("speakerOnly", event.target.checked)}
          />
        </label>

        <label className="fieldBlock">
          <span>Reference asset id</span>
          <input
            value={formState.selectedReferenceAssetId}
            disabled={formState.speakerOnly}
            onChange={(event) => setField("selectedReferenceAssetId", event.target.value)}
          />
        </label>

        <label className="fieldBlock">
          <span>Description</span>
          <textarea value={formState.description} rows={3} onChange={(event) => setField("description", event.target.value)} />
        </label>

        <label className="fieldBlock">
          <span>Visual prompt block</span>
          <textarea
            value={formState.visualPromptBlock}
            rows={3}
            onChange={(event) => setField("visualPromptBlock", event.target.value)}
          />
        </label>

        <label className="fieldBlock">
          <span>Voice ID</span>
          <input value={formState.voiceId} onChange={(event) => setField("voiceId", event.target.value)} />
        </label>

        <label className="fieldBlock">
          <span>Voice label</span>
          <input value={formState.voiceLabel} onChange={(event) => setField("voiceLabel", event.target.value)} />
        </label>

        <label className="fieldBlock">
          <span>Voice notes</span>
          <textarea value={formState.voiceNotes} rows={3} onChange={(event) => setField("voiceNotes", event.target.value)} />
        </label>

        <label className="fieldBlock">
          <span>Default emotion/style</span>
          <input value={formState.defaultEmotion} onChange={(event) => setField("defaultEmotion", event.target.value)} />
        </label>

        <label className="fieldBlock">
          <span>Speaking rate</span>
          <input value={formState.speakingRate} onChange={(event) => setField("speakingRate", event.target.value)} placeholder="1.0" />
        </label>

        <label className="fieldBlock">
          <span>Pitch</span>
          <input value={formState.pitch} onChange={(event) => setField("pitch", event.target.value)} placeholder="0" />
        </label>

        <label className="fieldBlock">
          <span>Sample text</span>
          <textarea value={formState.sampleText} rows={2} onChange={(event) => setField("sampleText", event.target.value)} />
        </label>

        <label className="fieldBlock">
          <span>Notes</span>
          <textarea value={formState.notes} rows={3} onChange={(event) => setField("notes", event.target.value)} />
        </label>

        <div className="inlineActions">
          <button className="primaryButton" type="button" onClick={saveEntity} disabled={isPending}>
            {isPending ? "Saving" : formState.id ? "Update" : "Create"}
          </button>
          <button type="button" onClick={resetForm}>
            Clear
          </button>
          <button type="button" onClick={previewVoice} disabled={isPending}>
            Preview voice
          </button>
          <span className="compactBadge">{referenceWarnings} reference warning(s)</span>
        </div>
      </section>

      <section className="widePanel">
        <div className="sectionTitle">
          <h3>Entity Extraction Review</h3>
          <span>{extractionDraft?.draftEntities.length ?? 0} draft(s)</span>
        </div>
        <label className="fieldBlock">
          <span>Optional source text override</span>
          <textarea
            value={extractionText}
            rows={4}
            placeholder="Leave blank to use project source material."
            onChange={(event) => setExtractionText(event.target.value)}
          />
        </label>
        <div className="inlineActions" style={{ margin: "10px 0" }}>
          <button type="button" onClick={draftEntityExtraction} disabled={isPending}>
            Draft extraction
          </button>
          <button
            className="primaryButton"
            type="button"
            onClick={applySelectedDraftEntities}
            disabled={isPending || !extractionDraft}
          >
            Apply selected
          </button>
          <span className="compactBadge">Drafts never auto-create records</span>
        </div>
        <div className="entityList">
          {extractionDraft?.draftEntities.map((draft) => (
            <article key={draft.draftId} className="entityRow">
              <label className="entityThumb" aria-label={`Select ${draft.name}`}>
                <input
                  type="checkbox"
                  checked={selectedDraftIds.has(draft.draftId)}
                  onChange={() => toggleDraftEntity(draft.draftId)}
                />
              </label>
              <div>
                <strong>{draft.name}</strong>
                <span>{draft.type}</span>
              </div>
              <p>{draft.visualPromptBlock ?? "Speaker/narrator only; no visual prompt required."}</p>
              <small>
                {draft.duplicateReason ?? draft.rationale}
                <br />
                Confidence {Math.round(draft.metadata.confidence * 100)}%
              </small>
            </article>
          )) ?? <p>No extraction draft yet.</p>}
        </div>
      </section>

      <section className="stackPanel">
        <section className="infoCard">
          <p className="label">Panel mapping</p>
          <strong>{mappingDraft ? `${mappingDraft.mappings.length} suggestion(s)` : "No draft"}</strong>
          <p>Suggestions update panel mapped entity IDs only after explicit apply.</p>
        </section>
        <div className="inlineActions">
          <button type="button" onClick={draftEntityMappings} disabled={isPending || entities.length === 0}>
            Draft mappings
          </button>
          <button className="primaryButton" type="button" onClick={applyMappingDraft} disabled={isPending || !mappingDraft}>
            Apply mappings
          </button>
        </div>
        <div className="entityList">
          {mappingDraft?.mappings.map((mapping) => (
            <article key={mapping.panelId} className="infoCard">
              <p className="label">{mapping.panelId}</p>
              <strong>{mapping.suggestedEntityIds.map((id) => entityNameById.get(id) ?? id).join(", ") || "No entity match"}</strong>
              <p>{mapping.rationale}</p>
              <small>
                Confidence {Math.round(mapping.confidence * 100)}%
                {mapping.missingReferenceWarnings.length > 0
                  ? ` - ${mapping.missingReferenceWarnings.join(" ")}`
                  : ""}
              </small>
            </article>
          )) ?? <p>No mapping draft yet.</p>}
        </div>
      </section>
    </div>
  );
}

function numberOrBlank(value: string) {
  if (!value.trim()) return "";
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : "";
}
