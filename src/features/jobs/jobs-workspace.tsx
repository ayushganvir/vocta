"use client";

import { useEffect, useMemo, useState } from "react";

type JobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
type JobType =
  | "PROMPT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "ENTITY_EXTRACTION"
  | "PANEL_SPLIT"
  | "ENTITY_MAPPING"
  | "STYLE_BIBLE_DRAFT"
  | "STORY_ANALYSIS";

type JobSummary = {
  id: string;
  projectId: string;
  panelId: string | null;
  type: JobType;
  status: JobStatus;
  provider: string;
  model: string;
  target: {
    label: string;
    projectTitle: string;
    panelTitle: string | null;
    sceneTitle: string | null;
  };
  retryOfGenerationJobId: string | null;
  retryCount: number;
  outputAssetCount: number;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  canRetry: boolean;
  canCancel: boolean;
};

type JobDetail = JobSummary & {
  compiledPrompt: string | null;
  inputLayers: unknown;
  attachedReferenceAssetIds: unknown;
  requestPayload: unknown;
  responsePayloadSummary: unknown;
  outputAssetIds: unknown;
  logs: unknown;
  errorPayload: unknown;
  costEstimate: string | null;
  tokenUsage: unknown;
  createdById: string | null;
  retryOf: { id: string; status: JobStatus; createdAt: string } | null;
  retries: Array<{ id: string; status: JobStatus; createdAt: string }>;
  generatedAssets: Array<{
    id: string;
    assetType: string;
    fileUrl: string;
    previewUrl: string | null;
    mimeType: string;
    durationSeconds: number | null;
    width: number | null;
    height: number | null;
    isSelected: boolean;
    createdAt: string;
  }>;
};

type JobsResponse = {
  jobs?: JobSummary[];
  nextCursor?: string | null;
  error?: string;
};

type JobResponse = {
  job?: JobDetail;
  error?: string;
};

const statusFilters = ["ALL", "QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"] as const;
const typeFilters = [
  "ALL",
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "PROMPT",
  "STORY_ANALYSIS",
  "STYLE_BIBLE_DRAFT",
  "ENTITY_EXTRACTION",
  "ENTITY_MAPPING",
  "PANEL_SPLIT"
] as const;

export function JobsWorkspace() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("ALL");
  const [typeFilter, setTypeFilter] = useState<(typeof typeFilters)[number]>("ALL");
  const [projectFilter, setProjectFilter] = useState("");
  const [panelFilter, setPanelFilter] = useState("");
  const [statusMessage, setStatusMessage] = useState("Loading generation jobs...");
  const [isBusy, setIsBusy] = useState(false);

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status === "QUEUED" || job.status === "RUNNING").length,
    [jobs]
  );

  useEffect(() => {
    void loadJobs();
    const timer = window.setInterval(() => void loadJobs({ quiet: true }), 5000);

    return () => window.clearInterval(timer);
  }, [statusFilter, typeFilter, projectFilter, panelFilter]);

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJob(null);
      return;
    }

    void loadJobDetail(selectedJobId);
  }, [selectedJobId]);

  async function loadJobs(options: { quiet?: boolean } = {}) {
    if (!options.quiet) {
      setStatusMessage("Loading generation jobs...");
    }

    const params = new URLSearchParams({ limit: "50" });
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    if (projectFilter.trim()) params.set("projectId", projectFilter.trim());
    if (panelFilter.trim()) params.set("panelId", panelFilter.trim());

    const response = await fetch(`/api/jobs?${params.toString()}`, { cache: "no-store" });
    const data = (await response.json()) as JobsResponse;

    if (!response.ok || data.error) {
      setStatusMessage(data.error ?? "Jobs load failed.");
      return;
    }

    const nextJobs = data.jobs ?? [];
    setJobs(nextJobs);
    setSelectedJobId((current) => current ?? nextJobs[0]?.id ?? null);
    if (!nextJobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(nextJobs[0]?.id ?? null);
    }
    if (!options.quiet) {
      setStatusMessage(nextJobs.length ? "Jobs loaded. Polling every 5 seconds." : "No jobs match the current filters.");
    }
  }

  async function loadJobDetail(jobId: string) {
    const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
    const data = (await response.json()) as JobResponse;

    if (data.job) {
      setSelectedJob(data.job);
    } else {
      setStatusMessage(data.error ?? "Job detail failed.");
    }
  }

  async function retrySelectedJob() {
    if (!selectedJob) return;

    setIsBusy(true);
    setStatusMessage("Creating manual retry job...");
    const response = await fetch(`/api/jobs/${selectedJob.id}/retry`, { method: "POST" });
    const data = (await response.json()) as JobResponse;

    if (response.ok && data.job) {
      setSelectedJobId(data.job.id);
      setSelectedJob(data.job);
      setStatusMessage("Retry job queued. Worker execution is handled by the queue track.");
      await loadJobs({ quiet: true });
    } else {
      setStatusMessage(data.error ?? "Retry failed.");
    }

    setIsBusy(false);
  }

  async function cancelSelectedJob() {
    if (!selectedJob) return;

    setIsBusy(true);
    setStatusMessage("Cancelling job...");
    const response = await fetch(`/api/jobs/${selectedJob.id}/cancel`, { method: "POST" });
    const data = (await response.json()) as JobResponse;

    if (response.ok && data.job) {
      setSelectedJob(data.job);
      setStatusMessage("Job cancelled manually.");
      await loadJobs({ quiet: true });
    } else {
      setStatusMessage(data.error ?? "Cancel failed.");
    }

    setIsBusy(false);
  }

  return (
    <div className="jobsWorkspace">
      <section className="widePanel jobsListPanel">
        <div className="sectionTitle">
          <h3>Generation Jobs</h3>
          <span>{activeJobs} active</span>
        </div>

        <div className="jobFilters" aria-label="Job filters">
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              {statusFilters.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Type</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
              {typeFilters.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Project ID</span>
            <input value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} placeholder="optional" />
          </label>
          <label>
            <span>Panel ID</span>
            <input value={panelFilter} onChange={(event) => setPanelFilter(event.target.value)} placeholder="optional" />
          </label>
          <button type="button" onClick={() => loadJobs()} disabled={isBusy}>
            Refresh
          </button>
        </div>

        <div className="jobsTableReal" role="table" aria-label="Database generation jobs">
          <div role="row">
            <span role="columnheader">Job</span>
            <span role="columnheader">Type</span>
            <span role="columnheader">Target</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Provider / model</span>
            <span role="columnheader">Trace</span>
          </div>
          {jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              role="row"
              className={job.id === selectedJobId ? "selected" : ""}
              onClick={() => setSelectedJobId(job.id)}
            >
              <span title={job.id}>{shortId(job.id)}</span>
              <strong>{job.type}</strong>
              <span>{job.target.label}</span>
              <StatusBadge status={job.status} />
              <span>{job.provider} / {job.model}</span>
              <span>
                {job.outputAssetCount} asset(s)
                {job.retryCount ? `, ${job.retryCount} retry` : ""}
              </span>
            </button>
          ))}
        </div>
        <p className="jobsStatus">{statusMessage}</p>
      </section>

      <section className="panelDetailPane jobDetailPane" aria-label="Selected job detail">
        {selectedJob ? (
          <>
            <div className="sectionTitle">
              <h3>{selectedJob.type} debug trace</h3>
              <span>{shortId(selectedJob.id)}</span>
            </div>
            <div className="jobDetailSummary">
              <StatusBadge status={selectedJob.status} />
              <span>{selectedJob.target.projectTitle}</span>
              <span>{selectedJob.target.sceneTitle ?? "Project scope"}</span>
              <span>{selectedJob.target.panelTitle ?? selectedJob.target.label}</span>
              <span>{formatDate(selectedJob.createdAt)}</span>
              <span>{selectedJob.completedAt ? formatDate(selectedJob.completedAt) : "not completed"}</span>
            </div>
            <div className="inlineActions">
              <button type="button" onClick={retrySelectedJob} disabled={isBusy || !selectedJob.canRetry}>
                Retry failed/cancelled job
              </button>
              <button type="button" onClick={cancelSelectedJob} disabled={isBusy || !selectedJob.canCancel}>
                Cancel queued/running job
              </button>
              <button type="button" onClick={() => loadJobDetail(selectedJob.id)} disabled={isBusy}>
                Refresh detail
              </button>
            </div>

            <div className="debugGrid">
              <DebugBlock title="Compiled prompt" value={selectedJob.compiledPrompt ?? ""} />
              <DebugBlock title="Input layers" value={selectedJob.inputLayers} />
              <DebugBlock title="Attached references" value={selectedJob.attachedReferenceAssetIds} />
              <DebugBlock title="Request payload" value={selectedJob.requestPayload} />
              <DebugBlock title="Response summary" value={selectedJob.responsePayloadSummary} />
              <DebugBlock title="Output asset IDs" value={selectedJob.outputAssetIds} />
              <DebugBlock title="Logs" value={selectedJob.logs} />
              <DebugBlock title="Error payload" value={selectedJob.errorPayload} />
              <DebugBlock title="Token and cost" value={{ tokenUsage: selectedJob.tokenUsage, costEstimate: selectedJob.costEstimate }} />
              <DebugBlock title="Retry chain" value={{ retryOf: selectedJob.retryOf, retries: selectedJob.retries }} />
              <DebugBlock title="Generated assets" value={selectedJob.generatedAssets} />
            </div>
          </>
        ) : (
          <p className="jobsStatus">Select a job to inspect its prompt, payload, logs, and outputs.</p>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`jobStatusBadge status-${status.toLowerCase()}`}>{status}</span>;
}

function DebugBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <article className="jobDebugBlock">
      <strong>{title}</strong>
      <pre>{typeof value === "string" ? value || "empty" : JSON.stringify(value ?? null, null, 2)}</pre>
    </article>
  );
}

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 10)}...` : id;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
