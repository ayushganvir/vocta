import Link from "next/link";
import type { ReactNode } from "react";
import { getNavItem, navItems, projectMetrics, promptLayers, screenTitles, type ScreenId } from "./workspace-data";

type AppShellProps = {
  activeScreen: ScreenId;
  children: ReactNode;
};

export function AppShell({ activeScreen, children }: AppShellProps) {
  const activeItem = getNavItem(activeScreen);
  const title = screenTitles[activeScreen];

  return (
    <main className="appShell">
      <aside className="leftRail" aria-label="Workspace navigation">
        <div className="brandBlock">
          <Link href="/projects" className="brandMark" aria-label="Vocta projects">
            V
          </Link>
          <div>
            <p className="eyebrow">Vocta</p>
            <h1>Production workspace</h1>
          </div>
        </div>

        <div className="projectSwitcher" aria-label="Current project">
          <div>
            <span className="label">Project</span>
            <strong>Signal Tower Cut</strong>
          </div>
          <span className="compactBadge">Draft</span>
        </div>

        <nav className="primaryNav" aria-label="Project sections">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={item.id === activeScreen ? "navItem active" : "navItem"}
              aria-current={item.id === activeScreen ? "page" : undefined}
            >
              <span className="navCode">{item.shortLabel}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </Link>
          ))}
        </nav>

        <div className="railFooter">
          <span className="label">Manual mode</span>
          <p>AI drafts, extraction, mapping, and generation require explicit user action.</p>
        </div>
      </aside>

      <section className="workspaceColumn" aria-labelledby="workspace-title">
        <header className="workspaceHeader">
          <div>
            <p className="eyebrow">{title.eyebrow}</p>
            <h2 id="workspace-title">{title.title}</h2>
            <p>{title.summary}</p>
          </div>
          <div className="headerActions" aria-label="Workspace actions">
            <button type="button" className="secondaryButton">
              Save draft
            </button>
            <button type="button" className="primaryButton">
              Queue manual action
            </button>
          </div>
        </header>

        <section className="metricBar" aria-label="Project metrics">
          {projectMetrics.map((metric) => (
            <div key={metric.label} className={`metric tone-${metric.tone ?? "neutral"}`}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </section>

        <div className="activeSectionLabel">
          <span>{activeItem.label}</span>
          <span>{activeItem.href}</span>
        </div>

        {children}
      </section>

      <aside className="rightInspector" aria-label="Prompt, debug, and chat inspector">
        <div className="inspectorHeader">
          <div>
            <p className="eyebrow">Guide</p>
            <h2>{activeItem.label}</h2>
          </div>
          <span className="compactBadge">Manual</span>
        </div>

        <section className="inspectorSection">
          <div className="sectionTitle">
            <h3>What To Do Here</h3>
            <span>editable</span>
          </div>
          <div className="guideList">
            {screenGuide(activeScreen).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>

        <section className="inspectorSection glossaryBox">
          <div className="sectionTitle">
            <h3>Scene vs Panel</h3>
            <span>plain English</span>
          </div>
          <p><strong>Scene:</strong> a larger section of the story.</p>
          <p><strong>Panel:</strong> one ordered beat or shot container inside a scene. Panels hold narration, visual intent, prompts, generated assets, and timeline metadata.</p>
        </section>

        <section className="inspectorSection chatBox">
          <div className="sectionTitle">
            <h3>Assistant Notes</h3>
            <span>draft only</span>
          </div>
          <div className="chatMessage">AI actions create drafts or suggestions. They do not change final creative state until you click Apply, Save, Select, or Generate.</div>
        </section>

        <details className="inspectorDetails">
          <summary>Read-only debug reference</summary>
          <div className="layerStack">
            {promptLayers.map((layer) => (
              <article key={layer.label} className="layerItem">
                <div>
                  <strong>{layer.label}</strong>
                  <span>{layer.state}</span>
                </div>
                <p>{layer.text}</p>
              </article>
            ))}
          </div>
          <pre className="debugBlock">{`{
  "debug": "read-only",
  "editIn": "Project, Source Material, Entities, Scenes",
  "requiresClick": true
}`}</pre>
        </details>
      </aside>
    </main>
  );
}

function screenGuide(activeScreen: ScreenId) {
  if (activeScreen === "projects") {
    return [
      "Paste a script in Start Here, then run Analyze Story.",
      "Change the project aspect ratio in Edit Project.",
      "Apply scenes and panels only after reviewing the AI draft."
    ];
  }

  if (activeScreen === "source-material") {
    return [
      "Store scripts, notes, image references, and source links here.",
      "Analyze Story drafts summary, entities, style, scenes, and panels.",
      "Entities can be refined later in the Entity Registry."
    ];
  }

  if (activeScreen === "scenes") {
    return [
      "Edit the selected panel's narration, visual intent, and motion intent.",
      "Change video aspect ratio, duration, source mode, and audio settings in the generation settings.",
      "Use debug only to inspect what happened after a generation call."
    ];
  }

  if (activeScreen === "entities") {
    return [
      "Define characters, places, objects, and speaker voices.",
      "Entity references propagate into panel generation after mapping.",
      "Missing visual references warn before image or video generation."
    ];
  }

  if (activeScreen === "configuration") {
    return [
      "Set project-level provider defaults here.",
      "Use dry-run checks before live provider tests.",
      "Real provider calls stay explicit and visible."
    ];
  }

  if (activeScreen === "export") {
    return [
      "Only selected assets enter the ordered package.",
      "Exports are semantic timeline packages, not final rendered videos.",
      "Editors import the ordered folders and manifest into Filmora or Premiere."
    ];
  }

  return [
    "Review queued work, provider payloads, errors, and retries.",
    "Jobs preserve traceability from prompt to generated asset.",
    "Retries require an explicit click."
  ];
}
