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
            <p className="eyebrow">Inspector</p>
            <h2>Prompt / Debug / Chat</h2>
          </div>
          <span className="compactBadge">Read only</span>
        </div>

        <section className="inspectorSection">
          <div className="sectionTitle">
            <h3>Prompt Layers</h3>
            <span>4</span>
          </div>
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
        </section>

        <section className="inspectorSection">
          <div className="sectionTitle">
            <h3>Debug Payload</h3>
            <span>mock</span>
          </div>
          <pre className="debugBlock">{`{
  "panelId": "p-002",
  "provider": "fake-image-v1",
  "apiCall": "not-started",
  "requiresClick": true
}`}</pre>
        </section>

        <section className="inspectorSection chatBox">
          <div className="sectionTitle">
            <h3>Scoped Chat</h3>
            <span>placeholder</span>
          </div>
          <div className="chatMessage">Ask about the selected panel, prompt layers, stale dependencies, or provider output.</div>
          <form className="chatInput" aria-label="Scoped chat placeholder">
            <input aria-label="Chat message" placeholder="Type a note..." />
            <button type="button">Send</button>
          </form>
        </section>
      </aside>
    </main>
  );
}
