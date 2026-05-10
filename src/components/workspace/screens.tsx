import { jobRows, scenePanels, selectedPanel, type ScreenId } from "./workspace-data";

type WorkspaceRouteProps = {
  screen: ScreenId;
};

export function WorkspaceRoute({ screen }: WorkspaceRouteProps) {
  if (screen === "source-material") {
    return <SourceMaterialScreen />;
  }

  if (screen === "style-bible") {
    return <StyleBibleScreen />;
  }

  if (screen === "entities") {
    return <EntitiesScreen />;
  }

  if (screen === "scenes") {
    return <ScenesScreen />;
  }

  if (screen === "jobs") {
    return <JobsScreen />;
  }

  if (screen === "export") {
    return <ExportScreen />;
  }

  return <ProjectsScreen />;
}

function ProjectsScreen() {
  return (
    <div className="workspaceGrid">
      <section className="widePanel">
        <div className="sectionTitle">
          <h3>Project Command Center</h3>
          <span>mock data</span>
        </div>
        <div className="denseTable" role="table" aria-label="Project readiness">
          <div role="row">
            <span role="columnheader">Track</span>
            <span role="columnheader">State</span>
            <span role="columnheader">Next manual step</span>
          </div>
          <div role="row">
            <span>Story structure</span>
            <strong>Draft applied</strong>
            <span>Review scene ordering</span>
          </div>
          <div role="row">
            <span>Style Bible</span>
            <strong>Needs review</strong>
            <span>Fill camera and negative prompt rules</span>
          </div>
          <div role="row">
            <span>Entity references</span>
            <strong>Partial</strong>
            <span>Select visual references for 3 characters</span>
          </div>
          <div role="row">
            <span>Export readiness</span>
            <strong>Blocked</strong>
            <span>Select video and audio assets for stale panels</span>
          </div>
        </div>
      </section>

      <section className="stackPanel">
        <InfoCard label="Model stack" title="Fake providers" text="Text, image, video, and voice rows are visible without live provider calls." />
        <InfoCard label="Manual AI actions" title="No automatic mutation" text="Draft, extract, map, generate, and export controls remain explicit user choices." />
      </section>
    </div>
  );
}

function SourceMaterialScreen() {
  return (
    <div className="workspaceGrid">
      <section className="widePanel">
        <div className="sectionTitle">
          <h3>Script and Notes</h3>
          <span>source-001</span>
        </div>
        <div className="textEditorMock" aria-label="Script text placeholder">
          <p>
            EXT. ROOFTOP - NIGHT. Asha reaches the locked service door. The city grid fails. The signal key
            flashes once and reveals a tower nobody else can see.
          </p>
          <p>
            Notes: keep the cold open practical, fast, and legible on mobile. Avoid automatic story analysis
            until the operator clicks the analysis control.
          </p>
        </div>
        <div className="inlineActions">
          <button type="button">Analyze story manually</button>
          <button type="button">Extract entities manually</button>
          <button type="button">Split scenes manually</button>
        </div>
      </section>

      <section className="stackPanel">
        <ReferenceTile name="rooftop-door.jpg" type="image" state="linked" />
        <ReferenceTile name="market-alley.png" type="image" state="needs entity mapping" />
        <ReferenceTile name="voice-note.txt" type="notes" state="not analyzed" />
      </section>
    </div>
  );
}

function StyleBibleScreen() {
  const fields = [
    ["Visual style", "Grounded cyber-mystery, practical rain, high contrast reflections."],
    ["Color palette", "Teal signage, sodium street light, neutral skin tones, restrained reds."],
    ["Lighting", "Motivated neon, soft practical interiors, readable faces on small screens."],
    ["Camera", "Handheld close coverage, short push-ins, no abstract impossible camera moves."],
    ["Negative prompt", "No glossy sci-fi armor, no floating UI glyphs, no cartoon proportions."]
  ];

  return (
    <div className="fieldGrid">
      {fields.map(([label, value]) => (
        <label key={label} className="fieldBlock">
          <span>{label}</span>
          <textarea defaultValue={value} rows={4} />
        </label>
      ))}
      <section className="widePanel">
        <div className="sectionTitle">
          <h3>Global References</h3>
          <span>3 assets</span>
        </div>
        <div className="referenceGrid">
          <ReferenceTile name="rain-grade.png" type="look" state="selected" />
          <ReferenceTile name="lens-test.jpg" type="camera" state="candidate" />
          <ReferenceTile name="street-light.png" type="lighting" state="candidate" />
        </div>
      </section>
    </div>
  );
}

function EntitiesScreen() {
  const entities = [
    ["Asha", "Character", "reference selected", "Voice TBD"],
    ["Shopkeeper", "Speaker", "no visual required", "Hindi preview pending"],
    ["Market Alley", "Place", "reference selected", "Mapped to 3 panels"],
    ["Signal Key", "Object", "missing reference", "Hard warn before visual generation"]
  ];

  return (
    <div className="workspaceGrid">
      <section className="widePanel">
        <div className="sectionTitle">
          <h3>Entity Registry</h3>
          <span>{entities.length} records</span>
        </div>
        <div className="entityList">
          {entities.map(([name, type, reference, note]) => (
            <article key={name} className="entityRow">
              <div className="entityThumb" aria-hidden="true">
                {name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <strong>{name}</strong>
                <span>{type}</span>
              </div>
              <p>{reference}</p>
              <small>{note}</small>
            </article>
          ))}
        </div>
      </section>
      <section className="stackPanel">
        <InfoCard label="Mapping" title="Panel links" text="Manual add/remove controls will live here once panel APIs exist." />
        <InfoCard label="Delete guard" title="Mapped entity warning" text="Deleting a mapped record should show a confirmation before state changes." />
      </section>
    </div>
  );
}

function ScenesScreen() {
  return (
    <div className="sceneWorkspace">
      <section className="sceneListPanel" aria-label="Scene and panel list">
        <div className="sectionTitle">
          <h3>Scene 01: Rooftop Signal</h3>
          <span>4 panels</span>
        </div>
        <div className="panelList">
          {scenePanels.map((panel) => (
            <article key={panel.id} className={panel.id === selectedPanel.id ? "panelRow selected" : "panelRow"}>
              <div className="panelRowTop">
                <span>{panel.order}</span>
                <strong>{panel.title}</strong>
              </div>
              <p>{panel.narration}</p>
              <div className="tagRow">
                {panel.entities.map((entity) => (
                  <span key={entity}>{entity}</span>
                ))}
              </div>
              <div className="panelMeta">
                <span>{panel.status}</span>
                <span>{panel.duration}</span>
                {panel.stale ? <strong>stale</strong> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panelDetailPane" aria-label="Selected panel detail">
        <div className="sectionTitle">
          <h3>{selectedPanel.title}</h3>
          <span>{selectedPanel.order}</span>
        </div>
        <div className="previewFrame">
          <span>Selected image/video preview</span>
        </div>
        <label className="fieldBlock compact">
          <span>Narration</span>
          <textarea defaultValue={selectedPanel.narration} rows={3} />
        </label>
        <label className="fieldBlock compact">
          <span>Visual intent</span>
          <textarea defaultValue="Wide rooftop angle, flare reflection in rain puddles, Asha framed small against tower lights." rows={3} />
        </label>
        <label className="fieldBlock compact">
          <span>Motion intent</span>
          <textarea defaultValue="Slow push-in, subtle flare pulse, rain motion only." rows={3} />
        </label>
        <div className="inlineActions">
          <button type="button">Generate image</button>
          <button type="button">Generate video</button>
          <button type="button">Generate voice</button>
        </div>
      </section>
    </div>
  );
}

function JobsScreen() {
  return (
    <section className="widePanel">
      <div className="sectionTitle">
        <h3>Generation Queue</h3>
        <span>manual jobs only</span>
      </div>
      <div className="denseTable jobsTable" role="table" aria-label="Generation jobs">
        <div role="row">
          <span role="columnheader">Job</span>
          <span role="columnheader">Kind</span>
          <span role="columnheader">Target</span>
          <span role="columnheader">Status</span>
          <span role="columnheader">Provider</span>
        </div>
        {jobRows.map((job) => (
          <div key={job.id} role="row">
            <span>{job.id}</span>
            <strong>{job.kind}</strong>
            <span>{job.target}</span>
            <span>{job.status}</span>
            <span>{job.provider}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExportScreen() {
  return (
    <div className="workspaceGrid">
      <section className="widePanel">
        <div className="sectionTitle">
          <h3>Ordered Package Readiness</h3>
          <span>blocked</span>
        </div>
        <div className="checklist">
          <ChecklistItem label="All panels have selected image assets" state="11 / 18 ready" />
          <ChecklistItem label="All panels have selected video assets" state="8 / 18 ready" />
          <ChecklistItem label="All panels have voiceover or narration status" state="13 / 18 ready" />
          <ChecklistItem label="No stale prompt dependencies remain" state="3 stale warnings" />
          <ChecklistItem label="Timeline manifest can include provider/job IDs" state="ready" />
        </div>
        <div className="inlineActions">
          <button type="button">Validate export</button>
          <button type="button">Create ordered package</button>
        </div>
      </section>
      <section className="stackPanel">
        <InfoCard label="Manifest" title="JSON + optional CSV" text="Project title, timestamp, scene order, selected assets, stale warnings, providers, and job IDs." />
        <InfoCard label="Editor handoff" title="Manual import" text="Filmora, Premiere, Resolve, or other editor import remains outside this MVP." />
      </section>
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

function ReferenceTile({ name, type, state }: { name: string; type: string; state: string }) {
  return (
    <article className="referenceTile">
      <div aria-hidden="true">{type.slice(0, 2).toUpperCase()}</div>
      <strong>{name}</strong>
      <span>{state}</span>
    </article>
  );
}

function ChecklistItem({ label, state }: { label: string; state: string }) {
  return (
    <div className="checklistItem">
      <span>{label}</span>
      <strong>{state}</strong>
    </div>
  );
}
