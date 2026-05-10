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
  voiceLabel: string;
  voiceNotes: string;
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
  voiceLabel: "",
  voiceNotes: ""
};

export function EntitiesEditor({ project, initialEntities }: EntitiesEditorProps) {
  const [entities, setEntities] = useState(initialEntities);
  const [formState, setFormState] = useState<EntityFormState>(emptyForm);
  const [status, setStatus] = useState("Visual entities without a reference will hard-warn before generation.");
  const [isPending, startTransition] = useTransition();

  const referenceWarnings = useMemo(
    () => entities.filter((entity) => getReferenceWarning(entity)).length,
    [entities]
  );

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
      voiceLabel: entity.metadata.voiceLabel,
      voiceNotes: entity.metadata.voiceNotes
    });
  }

  function resetForm() {
    setFormState(emptyForm);
  }

  function payloadFromForm() {
    const metadata: EntityMetadata = {
      speakerOnly: formState.speakerOnly,
      voiceLabel: formState.voiceLabel,
      voiceNotes: formState.voiceNotes
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
                    {referenceWarning ??
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
          <span>Voice label</span>
          <input value={formState.voiceLabel} onChange={(event) => setField("voiceLabel", event.target.value)} />
        </label>

        <label className="fieldBlock">
          <span>Voice notes</span>
          <textarea value={formState.voiceNotes} rows={3} onChange={(event) => setField("voiceNotes", event.target.value)} />
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
          <span className="compactBadge">{referenceWarnings} reference warning(s)</span>
        </div>
      </section>
    </div>
  );
}
