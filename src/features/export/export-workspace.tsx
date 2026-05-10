"use client";

import { useEffect, useState } from "react";

type ExportReadiness = {
  projectId: string | null;
  projectTitle: string | null;
  totalPanels: number;
  selectedImages: number;
  selectedVideos: number;
  selectedAudio: number;
  selectedFirstFrames: number;
  selectedLastFrames: number;
  stalePanels: number;
  warnings: string[];
  latestPackage: {
    id: string;
    status: string;
    zipFileUrl: string | null;
    createdAt: string;
    completedAt: string | null;
  } | null;
};

type ExportResponse = {
  readiness?: ExportReadiness;
  exportPackage?: {
    exportPackageId: string;
    zipFileUrl: string;
    manifest: {
      export: {
        rootFolder: string;
      };
      panels: unknown[];
      warnings: string[];
    };
  };
  error?: string;
};

export function ExportWorkspace() {
  const [readiness, setReadiness] = useState<ExportReadiness | null>(null);
  const [lastExportUrl, setLastExportUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading export readiness...");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void loadReadiness();
  }, []);

  async function loadReadiness() {
    setStatus("Loading export readiness...");
    const response = await fetch("/api/export-package", { cache: "no-store" });
    const data = (await response.json()) as ExportResponse;

    if (data.readiness) {
      setReadiness(data.readiness);
      setLastExportUrl(data.readiness.latestPackage?.zipFileUrl ?? null);
      setStatus("Export readiness loaded.");
    } else {
      setStatus(data.error ?? "Export readiness failed.");
    }
  }

  async function createExport() {
    setIsBusy(true);
    setStatus("Creating ordered export package...");
    const response = await fetch("/api/export-package", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: readiness?.projectId,
        includeCsv: true
      })
    });
    const data = (await response.json()) as ExportResponse;

    if (data.exportPackage && data.readiness) {
      setReadiness(data.readiness);
      setLastExportUrl(data.exportPackage.zipFileUrl);
      setStatus(`Export package created: ${data.exportPackage.manifest.export.rootFolder}`);
    } else {
      setStatus(data.error ?? "Export failed.");
    }

    setIsBusy(false);
  }

  const total = readiness?.totalPanels ?? 0;
  const zipUrl = lastExportUrl ?? readiness?.latestPackage?.zipFileUrl ?? null;

  return (
    <div className="workspaceGrid">
      <section className="widePanel">
        <div className="sectionTitle">
          <h3>Ordered Package Readiness</h3>
          <span>{readiness?.warnings.length ? "warnings" : "ready"}</span>
        </div>
        <div className="checklist">
          <ChecklistItem label="Selected images" state={ratio(readiness?.selectedImages, total)} />
          <ChecklistItem label="Selected first frames" state={ratio(readiness?.selectedFirstFrames, total)} />
          <ChecklistItem label="Selected last frames" state={ratio(readiness?.selectedLastFrames, total)} />
          <ChecklistItem label="Selected videos" state={ratio(readiness?.selectedVideos, total)} />
          <ChecklistItem label="Selected voiceover/audio" state={ratio(readiness?.selectedAudio, total)} />
          <ChecklistItem label="Stale panel warnings" state={`${readiness?.stalePanels ?? 0} stale`} />
          <ChecklistItem label="Timeline manifest fields" state="JSON + CSV ready" />
        </div>
        <div className="inlineActions">
          <button type="button" onClick={loadReadiness} disabled={isBusy}>
            Validate export
          </button>
          <button type="button" className="primaryButton" onClick={createExport} disabled={isBusy || !readiness?.projectId}>
            Create ordered package
          </button>
          {zipUrl ? (
            <a className="secondaryButton" href={zipUrl}>
              Download latest ZIP
            </a>
          ) : null}
          <span className="label">{status}</span>
        </div>
      </section>

      <section className="stackPanel">
        <InfoCard
          label="Package"
          title={readiness?.projectTitle ?? "No project"}
          text="ZIP includes ordered panel folders, selected video/audio/image assets, first/last frames, panel metadata JSON, timeline_manifest.json, and timeline_manifest.csv."
        />
        <InfoCard
          label="Warnings"
          title={`${readiness?.warnings.length ?? 0} export warning(s)`}
          text="Warnings do not block MVP export. Editors can still import available ordered assets manually."
        />
        <div className="checklist">
          {(readiness?.warnings ?? []).slice(0, 8).map((warning) => (
            <ChecklistItem key={warning} label={warning} state="warning" />
          ))}
          {readiness && readiness.warnings.length > 8 ? (
            <ChecklistItem label={`${readiness.warnings.length - 8} more warnings`} state="hidden" />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ratio(value = 0, total = 0) {
  return total ? `${value} / ${total}` : "0 / 0";
}

function ChecklistItem({ label, state }: { label: string; state: string }) {
  return (
    <div className="checklistItem">
      <span>{label}</span>
      <strong>{state}</strong>
    </div>
  );
}

function InfoCard({ label, title, text }: { label: string; title: string; text: string }) {
  return (
    <article className="infoCard">
      <span className="label">{label}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}
