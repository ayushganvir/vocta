"use client";

import { useMemo, useState, useTransition } from "react";

import {
  getMissingStyleBibleFields,
  styleBibleFields,
  type StyleBibleRecord
} from "./schema";

type StyleBibleEditorProps = {
  project: { id: string; title: string } | null;
  initialStyleBible: StyleBibleRecord | null;
};

const fieldLabels: Record<(typeof styleBibleFields)[number], string> = {
  charactersText: "Characters",
  placesText: "Places",
  objectsText: "Objects",
  visualStyle: "Visual style",
  colorPalette: "Color palette",
  lightingStyle: "Lighting",
  cameraStyle: "Camera style"
};

export function StyleBibleEditor({ project, initialStyleBible }: StyleBibleEditorProps) {
  const [styleBible, setStyleBible] = useState<StyleBibleRecord | null>(initialStyleBible);
  const [formState, setFormState] = useState(() =>
    Object.fromEntries(styleBibleFields.map((field) => [field, initialStyleBible?.[field] ?? ""])) as Record<
      (typeof styleBibleFields)[number],
      string
    >
  );
  const [status, setStatus] = useState("No generation is blocked by Style Bible gaps in MVP.");
  const [draft, setDraft] = useState<Record<(typeof styleBibleFields)[number], string> | null>(null);
  const [draftRationale, setDraftRationale] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const missingFields = useMemo(() => getMissingStyleBibleFields(styleBible), [styleBible]);
  const savedLabel = styleBible?.updatedAt ? `Saved ${styleBible.updatedAt.replace("T", " ").slice(0, 19)} UTC` : "Draft";

  if (!project) {
    return (
      <section className="widePanel">
        <div className="sectionTitle">
          <h3>Style Bible</h3>
          <span>No project</span>
        </div>
        <p>Create a project first, then return here to edit the project Style Bible.</p>
      </section>
    );
  }

  const activeProject = project;

  function updateField(field: (typeof styleBibleFields)[number], value: string) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  function saveStyleBible() {
    startTransition(async () => {
      const response = await fetch("/api/style-bible", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: activeProject.id, ...formState })
      });

      if (!response.ok) {
        setStatus("Save failed. Check the Style Bible payload and try again.");
        return;
      }

      const payload = (await response.json()) as { styleBible: StyleBibleRecord };
      setStyleBible(payload.styleBible);
      setStatus("Style Bible saved. Empty fields remain warnings only.");
    });
  }

  function generateDraft() {
    startTransition(async () => {
      const response = await fetch("/api/style-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: activeProject.id })
      });

      if (!response.ok) {
        setStatus("Style draft failed. No fields were changed.");
        return;
      }

      const payload = (await response.json()) as {
        draft: Record<(typeof styleBibleFields)[number], string>;
        rationale: string[];
        warnings: string[];
      };
      setDraft(payload.draft);
      setDraftRationale(payload.rationale);
      setStatus(
        payload.warnings.length
          ? `Draft ready with ${payload.warnings.length} warning(s). Apply fields manually.`
          : "Draft ready. Apply fields manually."
      );
    });
  }

  function applyDraftField(field: (typeof styleBibleFields)[number]) {
    if (!draft) {
      return;
    }

    setFormState((current) => ({ ...current, [field]: draft[field] }));
    setStatus(`${fieldLabels[field]} draft applied locally. Click Save Style Bible to persist.`);
  }

  return (
    <div className="workspaceGrid">
      <section className="widePanel">
        <div className="sectionTitle">
          <h3>{activeProject.title}</h3>
          <span>{savedLabel}</span>
        </div>
        <div className="fieldGrid">
          {styleBibleFields.map((field) => (
            <label key={field} className="fieldBlock">
              <span>{fieldLabels[field]}</span>
              <textarea
                value={formState[field]}
                rows={field === "charactersText" || field === "placesText" || field === "objectsText" ? 5 : 4}
                onChange={(event) => updateField(field, event.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="inlineActions" style={{ marginTop: 12 }}>
          <button className="secondaryButton" type="button" onClick={generateDraft} disabled={isPending}>
            Generate Style Draft
          </button>
          <button className="primaryButton" type="button" onClick={saveStyleBible} disabled={isPending}>
            {isPending ? "Saving" : "Save Style Bible"}
          </button>
          <span className="compactBadge">{status}</span>
        </div>
      </section>

      <section className="stackPanel">
        <InfoBlock
          title="MVP warning policy"
          text="Blank Style Bible fields are visible warnings only. They do not block generation."
        />
        <InfoBlock
          title="Reference policy"
          text="Entity references carry the hard warning before visual generation, not these global fields."
        />
        {draft ? (
          <section className="infoCard">
            <p className="label">AI draft</p>
            <strong>Field-by-field apply</strong>
            <p>Draft values are not saved until you apply a field and then save the Style Bible.</p>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {styleBibleFields.map((field) => (
                <button key={field} type="button" onClick={() => applyDraftField(field)}>
                  Apply {fieldLabels[field]}
                </button>
              ))}
            </div>
            {draftRationale.length ? <p>{draftRationale.join(" ")}</p> : null}
          </section>
        ) : null}
        <section className="infoCard">
          <p className="label">Missing fields</p>
          <strong>{missingFields.length === 0 ? "Complete" : `${missingFields.length} warning(s)`}</strong>
          <p>
            {missingFields.length === 0
              ? "All MVP Style Bible fields have manual text."
              : missingFields.map((field) => fieldLabels[field]).join(", ")}
          </p>
        </section>
      </section>
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <section className="infoCard">
      <p className="label">Guidance</p>
      <strong>{title}</strong>
      <p>{text}</p>
    </section>
  );
}
