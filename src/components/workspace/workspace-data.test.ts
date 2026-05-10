import { describe, expect, it } from "vitest";
import { navItems, scenePanels, screenTitles, selectedPanel } from "./workspace-data";

describe("workspace navigation", () => {
  it("exposes the required Wave 1 screens", () => {
    expect(navItems.map((item) => item.id)).toEqual([
      "projects",
      "source-material",
      "style-bible",
      "entities",
      "scenes",
      "jobs",
      "export"
    ]);
  });

  it("has a routable title for every navigation item", () => {
    const hrefs = new Set<string>();

    for (const item of navItems) {
      expect(item.href).toMatch(/^\//);
      expect(screenTitles[item.id].title.length).toBeGreaterThan(0);
      hrefs.add(item.href);
    }

    expect(hrefs.size).toBe(navItems.length);
  });
});

describe("scene placeholder data", () => {
  it("keeps the selected panel in the split list/detail data set", () => {
    expect(scenePanels.some((panel) => panel.id === selectedPanel.id)).toBe(true);
  });

  it("shows stale state without implying automatic regeneration", () => {
    const stalePanels = scenePanels.filter((panel) => panel.stale);

    expect(stalePanels.length).toBeGreaterThan(0);
    expect(stalePanels.every((panel) => panel.status.toLowerCase().includes("stale"))).toBe(true);
  });
});
