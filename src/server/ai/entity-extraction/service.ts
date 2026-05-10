import { createHash } from "node:crypto";

import { createFakeTextProvider, runProvider } from "@/server/providers/fake";
import type { EntityExtractionJobPayload, EntityExtractionJobResult } from "@/server/jobs/types";

import type { DraftEntity, EntityExtractionDraft, ExistingEntityForExtraction } from "./types";

type ExtractEntitiesInput = {
  projectId: string;
  sourceMaterialIds: string[];
  text: string;
  existingEntities?: ExistingEntityForExtraction[];
  requestedAt?: string;
};

const placeTerms = [
  "temple",
  "tower",
  "city",
  "room",
  "street",
  "market",
  "forest",
  "station",
  "school",
  "home",
  "house",
  "palace",
  "lab",
  "village",
  "harbor"
];

const objectTerms = [
  "lantern",
  "key",
  "map",
  "sword",
  "phone",
  "book",
  "ring",
  "letter",
  "camera",
  "mask",
  "coin",
  "vehicle",
  "door",
  "signal"
];

const stopWords = new Set([
  "the",
  "a",
  "an",
  "and",
  "but",
  "then",
  "when",
  "while",
  "into",
  "from",
  "with",
  "under",
  "over",
  "before",
  "after",
  "his",
  "her",
  "their",
  "our"
]);

export async function extractDraftEntities(input: ExtractEntitiesInput): Promise<EntityExtractionDraft> {
  const requestedAt = input.requestedAt ?? new Date().toISOString();
  const provider = createFakeTextProvider();
  const payload: EntityExtractionJobPayload = {
    jobType: "entity_extraction",
    projectId: input.projectId,
    requestedAt,
    sourceMaterialIds: input.sourceMaterialIds,
    text: input.text,
    existingEntities: input.existingEntities ?? []
  };
  const providerResult = (await runProvider(provider, payload)) as EntityExtractionJobResult;
  const draftEntities = buildHeuristicDrafts(input.text, input.existingEntities ?? []);
  const fallbackDrafts = providerResult.draftEntities.map((entity, index) =>
    toDraftEntity({
      name: entity.name,
      type: entity.type,
      text: input.text,
      existingEntities: input.existingEntities ?? [],
      index: draftEntities.length + index,
      rationale: entity.rationale ?? "Fake provider supplied a fallback entity suggestion."
    })
  );

  return {
    projectId: input.projectId,
    provider: providerResult.provider,
    model: providerResult.model,
    generatedAt: providerResult.completedAt,
    sourceMaterialIds: input.sourceMaterialIds,
    draftEntities: uniqueByName([...draftEntities, ...fallbackDrafts]).slice(0, 12),
    warnings: providerResult.warnings.map((warning) => warning.message)
  };
}

export function buildHeuristicDrafts(text: string, existingEntities: ExistingEntityForExtraction[] = []) {
  const candidates = [
    ...extractSpeakers(text),
    ...extractCapitalizedNames(text),
    ...extractTermEntities(text, placeTerms, "place"),
    ...extractTermEntities(text, objectTerms, "object")
  ];

  return uniqueByName(candidates).map((candidate, index) =>
    toDraftEntity({
      ...candidate,
      text,
      existingEntities,
      index
    })
  );
}

function extractSpeakers(text: string) {
  const matches = [...text.matchAll(/^\s*([A-Z][A-Za-z0-9' -]{1,38})\s*:/gm)];

  return matches.map((match) => {
    const name = cleanName(match[1] ?? "");
    return {
      name,
      type: name.toLowerCase().includes("narrator") ? "speaker" : "character",
      rationale: "Detected as a script speaker label."
    };
  });
}

function extractCapitalizedNames(text: string) {
  const matches = [...text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g)];

  return matches
    .map((match) => cleanName(match[1] ?? ""))
    .filter((name) => name.length > 2)
    .filter((name) => !stopWords.has(name.toLowerCase()))
    .filter((name) => !["INT", "EXT", "CUT", "FADE"].includes(name.toUpperCase()))
    .map((name) => ({
      name,
      type: inferType(name),
      rationale: "Detected as a recurring proper-noun candidate in source material."
    }));
}

function extractTermEntities(text: string, terms: string[], type: DraftEntity["type"]) {
  const lowerText = text.toLowerCase();

  return terms
    .filter((term) => lowerText.includes(term))
    .map((term) => ({
      name: titleCase(term),
      type,
      rationale: `Detected recurring ${type} keyword: ${term}.`
    }));
}

function toDraftEntity(input: {
  name: string;
  type: DraftEntity["type"];
  text: string;
  existingEntities: ExistingEntityForExtraction[];
  index: number;
  rationale: string;
}): DraftEntity {
  const normalizedName = normalizeName(input.name);
  const duplicate = input.existingEntities.find((entity) => normalizeName(entity.name) === normalizedName);
  const speakerOnly = input.type === "speaker";
  const snippets = sourceSnippets(input.text, input.name);
  const confidence = duplicate ? 0.55 : speakerOnly ? 0.74 : 0.68;

  return {
    draftId: stableDraftId(input.name, input.type, input.index),
    name: input.name,
    type: input.type,
    description: describeEntity(input.name, input.type, snippets),
    visualPromptBlock: speakerOnly
      ? null
      : `${input.name}, ${input.type}, consistent identity, production-ready visual reference, clear silhouette, vertical video framing`,
    duplicateOfEntityId: duplicate?.id ?? null,
    duplicateReason: duplicate ? `Name matches existing ${duplicate.type} entity "${duplicate.name}".` : null,
    rationale: input.rationale,
    sourceTextSnippets: snippets,
    metadata: {
      speakerOnly,
      confidence
    }
  };
}

function inferType(name: string): DraftEntity["type"] {
  const lowerName = name.toLowerCase();

  if (placeTerms.some((term) => lowerName.includes(term))) return "place";
  if (objectTerms.some((term) => lowerName.includes(term))) return "object";
  if (lowerName.includes("narrator") || lowerName.includes("voiceover")) return "speaker";
  return "character";
}

function describeEntity(name: string, type: DraftEntity["type"], snippets: string[]) {
  const evidence = snippets[0] ? ` Evidence: ${snippets[0]}` : "";
  return `${titleCase(String(type))} candidate inferred from source material for "${name}".${evidence}`.slice(0, 420);
}

function sourceSnippets(text: string, name: string) {
  const normalizedNeedle = name.toLowerCase();
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences
    .filter((sentence) => sentence.toLowerCase().includes(normalizedNeedle))
    .slice(0, 2)
    .map((sentence) => sentence.slice(0, 220));
}

function uniqueByName<T extends { name: string; type?: string }>(items: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = `${normalizeName(item.name)}:${item.type ?? ""}`;
    if (!item.name || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function cleanName(value: string) {
  return titleCase(value.replace(/[^A-Za-z0-9' -]/g, " ").replace(/\s+/g, " ").trim());
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function stableDraftId(name: string, type: string, index: number) {
  const hash = createHash("sha1").update(`${name}:${type}:${index}`).digest("hex").slice(0, 12);
  return `draft_${hash}`;
}
