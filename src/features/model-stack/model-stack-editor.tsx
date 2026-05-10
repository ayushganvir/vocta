"use client";

import { useEffect, useState } from "react";
import type { ModelStackForm } from "./schema";

type ModelStackEditorProps = {
  project: { id: string; title: string } | null;
  initialModelStack: ModelStackForm | null;
};

type ProviderCapability = {
  provider: string;
  kind: string;
  defaultModel: string;
  jobTypes: string[];
  capabilities: string[];
  realAdapter: boolean;
  enabledInCurrentMode: boolean;
  credentialStatus: "configured" | "missing" | "not_required";
  notes: string[];
};

type ProviderCapabilitiesResponse = {
  providerMode: "fake" | "real";
  capabilities: ProviderCapability[];
};

const defaultStack = (projectId: string): ModelStackForm => ({
  projectId,
  textProvider: "openai",
  textModel: "gpt-4.1",
  imageProvider: "openai",
  imageModel: "gpt-image-1",
  videoProvider: "xai",
  videoModel: "grok-imagine-video",
  voiceProvider: "google",
  voiceModel: "google-tts",
  defaultVoiceId: "",
  providerSettings: {}
});

export function ModelStackEditor({ project, initialModelStack }: ModelStackEditorProps) {
  const [form, setForm] = useState<ModelStackForm>(() =>
    initialModelStack ?? (project ? defaultStack(project.id) : defaultStack(""))
  );
  const [providerSettingsText, setProviderSettingsText] = useState(() =>
    JSON.stringify(initialModelStack?.providerSettings ?? {}, null, 2)
  );
  const [providerCapabilities, setProviderCapabilities] = useState<ProviderCapabilitiesResponse | null>(null);
  const [message, setMessage] = useState("Project model defaults apply to new generation jobs unless overridden at panel level.");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadProviderCapabilities();
  }, []);

  if (!project) {
    return (
      <section className="widePanel">
        <div className="sectionTitle">
          <h3>Project Settings</h3>
          <span>No project</span>
        </div>
        <p>Create or seed a project before configuring provider defaults.</p>
      </section>
    );
  }
  const activeProject = project;

  function update(field: keyof ModelStackForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    let providerSettings: Record<string, unknown>;
    try {
      providerSettings = JSON.parse(providerSettingsText || "{}") as Record<string, unknown>;
    } catch {
      setMessage("Provider settings must be valid JSON.");
      return;
    }

    setIsSaving(true);
    setMessage("Saving model stack...");
    const response = await fetch("/api/model-stack", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
        projectId: activeProject.id,
          providerSettings
        })
      });
    const payload = (await response.json()) as { modelStack?: ModelStackForm; error?: string };

    if (!response.ok || !payload.modelStack) {
      setMessage(payload.error ?? "Model stack save failed.");
    } else {
      setForm(payload.modelStack);
      setProviderSettingsText(JSON.stringify(payload.modelStack.providerSettings ?? {}, null, 2));
      setMessage("Model stack saved. Existing assets were not regenerated.");
    }

    setIsSaving(false);
  }

  async function loadProviderCapabilities() {
    const response = await fetch("/api/providers/capabilities", { cache: "no-store" });
    const payload = (await response.json()) as ProviderCapabilitiesResponse;
    setProviderCapabilities(payload);
  }

  return (
    <div className="workspaceGrid">
      <section className="widePanel">
        <div className="sectionTitle">
          <h3>{activeProject.title} Model Stack</h3>
          <span>Project defaults</span>
        </div>
        <div className="fieldGrid">
          <Field label="Text provider" value={form.textProvider} onChange={(value) => update("textProvider", value)} />
          <Field label="Text model" value={form.textModel} onChange={(value) => update("textModel", value)} />
          <Field label="Image provider" value={form.imageProvider} onChange={(value) => update("imageProvider", value)} />
          <Field label="Image model" value={form.imageModel} onChange={(value) => update("imageModel", value)} />
          <Field label="Video provider" value={form.videoProvider} onChange={(value) => update("videoProvider", value)} />
          <Field label="Video model" value={form.videoModel} onChange={(value) => update("videoModel", value)} />
          <Field label="Voice provider" value={form.voiceProvider} onChange={(value) => update("voiceProvider", value)} />
          <Field label="Voice model" value={form.voiceModel} onChange={(value) => update("voiceModel", value)} />
          <Field label="Default voice ID" value={form.defaultVoiceId ?? ""} onChange={(value) => update("defaultVoiceId", value)} />
        </div>
      </section>

      <section className="stackPanel">
        <section className="infoCard">
          <p className="label">Provider settings JSON</p>
          <strong>No schema churn</strong>
          <p>{message}</p>
        </section>
        <label className="fieldBlock">
          <span>providerSettings</span>
          <textarea
            value={providerSettingsText}
            rows={12}
            onChange={(event) => setProviderSettingsText(event.target.value)}
          />
        </label>
        <div className="inlineActions">
          <button className="primaryButton" type="button" onClick={save} disabled={isSaving}>
            {isSaving ? "Saving" : "Save model stack"}
          </button>
        </div>
      </section>

      <section className="widePanel providerMatrix">
        <div className="sectionTitle">
          <h3>Provider Capability Matrix</h3>
          <span>{providerCapabilities ? `${providerCapabilities.providerMode} mode` : "loading"}</span>
        </div>
        <div className="providerMatrixGrid">
          {providerCapabilities?.capabilities.map((provider) => (
            <article key={`${provider.provider}-${provider.kind}`} className="providerCapabilityCard">
              <div>
                <strong>{provider.provider}</strong>
                <span>{provider.kind} / {provider.defaultModel}</span>
              </div>
              <dl>
                <dt>Jobs</dt>
                <dd>{provider.jobTypes.join(", ")}</dd>
                <dt>Capabilities</dt>
                <dd>{provider.capabilities.join(", ")}</dd>
                <dt>Credentials</dt>
                <dd>{provider.credentialStatus.replace("_", " ")}</dd>
                <dt>Runtime</dt>
                <dd>{provider.enabledInCurrentMode ? "enabled" : "not active in current mode"}</dd>
              </dl>
              <p>{provider.notes.join(" ")}</p>
            </article>
          )) ?? <p>Loading provider capability matrix...</p>}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="fieldBlock">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
