const navItems = ["Projects", "Source", "Style Bible", "Entities", "Scenes", "Jobs", "Export"];

export default function HomePage() {
  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Workspace navigation">
        <div>
          <p className="eyebrow">Vocta</p>
          <h1>Creative workspace</h1>
        </div>
        <nav>
          {navItems.map((item) => (
            <a key={item} href="#">
              {item}
            </a>
          ))}
        </nav>
      </aside>
      <section className="workspace">
        <div className="topbar">
          <div>
            <p className="eyebrow">MVP foundation</p>
            <h2>Project workspace shell</h2>
          </div>
          <span className="status">Fake providers enabled</span>
        </div>
        <div className="panelGrid">
          <section className="panelList" aria-label="Panel list placeholder">
            <h3>Panels</h3>
            <p>Wave 1 will connect this shell to real project and panel data.</p>
          </section>
          <section className="panelDetail" aria-label="Panel detail placeholder">
            <h3>Selected panel</h3>
            <p>Prompt layers, references, generation actions, and asset history will live here.</p>
          </section>
        </div>
      </section>
      <aside className="inspector" aria-label="Prompt inspector placeholder">
        <h3>Inspector</h3>
        <p>Debug prompt data and scoped chat will attach to this rail.</p>
      </aside>
    </main>
  );
}

