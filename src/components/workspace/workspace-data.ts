export type ScreenId =
  | "projects"
  | "source-material"
  | "configuration"
  | "style-bible"
  | "entities"
  | "scenes"
  | "jobs"
  | "export";

export type NavItem = {
  id: ScreenId;
  label: string;
  shortLabel: string;
  href: string;
  description: string;
};

export type StatusTone = "good" | "warn" | "neutral" | "danger";

export type Metric = {
  label: string;
  value: string;
  tone?: StatusTone;
};

export type ScenePanel = {
  id: string;
  order: string;
  title: string;
  narration: string;
  entities: string[];
  status: string;
  stale: boolean;
  duration: string;
};

export const navItems: NavItem[] = [
  {
    id: "projects",
    label: "Projects",
    shortLabel: "PR",
    href: "/projects",
    description: "Workspace dashboard and project switching"
  },
  {
    id: "source-material",
    label: "Source Material",
    shortLabel: "SM",
    href: "/source-material",
    description: "Scripts, notes, references, and uploads"
  },
  {
    id: "configuration",
    label: "Configuration",
    shortLabel: "CF",
    href: "/configuration",
    description: "Model stack, provider defaults, and voice defaults"
  },
  {
    id: "style-bible",
    label: "Style Bible",
    shortLabel: "SB",
    href: "/style-bible",
    description: "Visual rules, palette, lighting, and camera language"
  },
  {
    id: "entities",
    label: "Entities",
    shortLabel: "EN",
    href: "/entities",
    description: "Characters, places, objects, and speaker records"
  },
  {
    id: "scenes",
    label: "Scenes/Panels",
    shortLabel: "SC",
    href: "/scenes",
    description: "Scene outline, panel list, and selected panel detail"
  },
  {
    id: "jobs",
    label: "Generation Jobs",
    shortLabel: "GJ",
    href: "/jobs",
    description: "Manual job queue and provider traces"
  },
  {
    id: "export",
    label: "Export",
    shortLabel: "EX",
    href: "/export",
    description: "Readiness, ordered package, manifest, and CSV handoff"
  }
];

export const screenTitles: Record<ScreenId, { eyebrow: string; title: string; summary: string }> = {
  projects: {
    eyebrow: "Project workspace",
    title: "Demo vertical short",
    summary: "Static shell for project navigation, status scanning, and manual creative operations."
  },
  "source-material": {
    eyebrow: "Input layer",
    title: "Source Material",
    summary: "Collect script text, notes, links, and image references before any user-triggered analysis."
  },
  configuration: {
    eyebrow: "Project settings",
    title: "Configuration",
    summary: "Project-level model stack and provider defaults for explicit generation jobs."
  },
  "style-bible": {
    eyebrow: "Creative constraints",
    title: "Style Bible",
    summary: "Editable visual language placeholders for style, color, lighting, camera, and negative rules."
  },
  entities: {
    eyebrow: "Canonical references",
    title: "Entities",
    summary: "Characters, places, objects, and speaker-only records with reference readiness warnings."
  },
  scenes: {
    eyebrow: "Narrative timeline",
    title: "Scenes and Panels",
    summary: "Split list/detail panel workspace with visible prompt, asset, and stale-state placeholders."
  },
  jobs: {
    eyebrow: "Manual generation",
    title: "Generation Jobs",
    summary: "Queue visibility for explicit user-triggered jobs and provider debug payloads."
  },
  export: {
    eyebrow: "Editor handoff",
    title: "Export Package",
    summary: "Ordered asset package readiness with JSON manifest and optional CSV placeholders."
  }
};

export const projectMetrics: Metric[] = [
  { label: "Aspect", value: "9:16", tone: "neutral" },
  { label: "Scenes", value: "04", tone: "neutral" },
  { label: "Panels", value: "18", tone: "neutral" },
  { label: "Ready", value: "11/18", tone: "warn" },
  { label: "Stale", value: "03", tone: "danger" }
];

export const scenePanels: ScenePanel[] = [
  {
    id: "p-001",
    order: "01.01",
    title: "Cold open: locked rooftop",
    narration: "A courier reaches the rooftop door as the city grid drops into silence.",
    entities: ["Asha", "Rooftop", "Signal Key"],
    status: "image selected",
    stale: false,
    duration: "07s"
  },
  {
    id: "p-002",
    order: "01.02",
    title: "Signal flare over the skyline",
    narration: "The key pulses once, revealing a second tower hidden in the storm haze.",
    entities: ["Asha", "Signal Key"],
    status: "prompt stale",
    stale: true,
    duration: "06s"
  },
  {
    id: "p-003",
    order: "02.01",
    title: "Alley witness",
    narration: "A shopkeeper recognizes the symbol and refuses to say the name aloud.",
    entities: ["Shopkeeper", "Market Alley"],
    status: "needs image",
    stale: false,
    duration: "09s"
  },
  {
    id: "p-004",
    order: "02.02",
    title: "First frame hold",
    narration: "A static frame locks on the reflected glyph before the chase begins.",
    entities: ["Market Alley", "Glyph"],
    status: "video queued",
    stale: false,
    duration: "05s"
  }
];

export const selectedPanel = scenePanels[1];

export const promptLayers = [
  { label: "Project intent", state: "locked", text: "2-4 minute vertical mystery short, tense but readable." },
  { label: "Style Bible", state: "warning", text: "Neon rain, practical lighting, handheld close coverage." },
  { label: "Scene context", state: "ready", text: "Rooftop discovery after city-wide outage." },
  { label: "Panel override", state: "manual", text: "Keep the flare subtle; no automatic regeneration." }
];

export const jobRows = [
  { id: "job-1842", kind: "image", target: "P-001", status: "complete", provider: "fake-image-v1" },
  { id: "job-1843", kind: "video", target: "P-004", status: "queued", provider: "fake-video-v1" },
  { id: "job-1844", kind: "voice", target: "P-003", status: "failed", provider: "fake-voice-v1" }
];

export function getNavItem(id: ScreenId) {
  return navItems.find((item) => item.id === id) ?? navItems[0];
}
