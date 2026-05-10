import { createFakeTextProvider, runProvider } from "@/server/providers/fake";
import type { EntityMappingJobPayload, EntityMappingJobResult } from "@/server/jobs/types";

import type { EntityForMapping, EntityMappingDraft, EntityMappingSuggestion, PanelForMapping } from "./types";

type BuildEntityMappingInput = {
  projectId: string;
  panels: PanelForMapping[];
  entities: EntityForMapping[];
  requestedAt?: string;
};

export async function buildEntityMappingDraft(input: BuildEntityMappingInput): Promise<EntityMappingDraft> {
  const requestedAt = input.requestedAt ?? new Date().toISOString();
  const provider = createFakeTextProvider();
  const payload: EntityMappingJobPayload = {
    jobType: "entity_mapping",
    projectId: input.projectId,
    requestedAt,
    panelIds: input.panels.map((panel) => panel.id),
    entities: input.entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      hasReferenceAsset: Boolean(entity.selectedReferenceAssetId) || Boolean(entity.metadata?.speakerOnly),
      visualPrompt: entity.visualPromptBlock ?? undefined
    })),
    panelSummaries: input.panels.map((panel) => ({
      panelId: panel.id,
      narration: panel.narrationText ?? undefined,
      visualIntent: panel.visualIntent ?? undefined
    }))
  };
  const providerResult = (await runProvider(provider, payload)) as EntityMappingJobResult;
  const heuristicMappings = input.panels.map((panel) => mapPanel(panel, input.entities));
  const providerByPanel = new Map(providerResult.mappings.map((mapping) => [mapping.panelId, mapping]));

  return {
    projectId: input.projectId,
    provider: providerResult.provider,
    model: providerResult.model,
    generatedAt: providerResult.completedAt,
    mappings: heuristicMappings.map((mapping) => {
      const providerMapping = providerByPanel.get(mapping.panelId);
      return mapping.suggestedEntityIds.length > 0
        ? mapping
        : {
            panelId: mapping.panelId,
            suggestedEntityIds: providerMapping?.entityIds ?? [],
            confidence: providerMapping?.confidence ?? mapping.confidence,
            rationale: providerMapping?.rationale ?? mapping.rationale,
            missingReferenceWarnings: providerMapping?.missingReferenceWarnings ?? mapping.missingReferenceWarnings
          };
    }),
    warnings: providerResult.warnings.map((warning) => warning.message)
  };
}

export function mapPanel(panel: PanelForMapping, entities: EntityForMapping[]): EntityMappingSuggestion {
  const panelText = [
    panel.title,
    panel.narrationText,
    panel.visualIntent,
    panel.motionIntent,
    panel.notes
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const scored = entities
    .map((entity) => ({
      entity,
      score: scoreEntityMatch(panelText, entity)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entity.name.localeCompare(b.entity.name));
  const selected = scored.slice(0, 6).map((item) => item.entity);
  const missingReferenceWarnings = selected
    .filter((entity) => !entity.metadata?.speakerOnly && !entity.selectedReferenceAssetId)
    .map((entity) => `${entity.name} has no selected reference asset.`);

  return {
    panelId: panel.id,
    suggestedEntityIds: selected.map((entity) => entity.id),
    confidence: selected.length ? Math.min(0.95, 0.52 + scored[0]!.score * 0.12) : 0.2,
    rationale: selected.length
      ? `Matched panel text against entity names, descriptions, and visual prompts: ${selected
          .map((entity) => entity.name)
          .join(", ")}.`
      : "No strong entity references were found in this panel.",
    missingReferenceWarnings
  };
}

export function normalizeMappingApplyInput(
  mappings: Array<{ panelId: string; suggestedEntityIds?: string[]; entityIds?: string[] }>
) {
  return mappings.map((mapping) => ({
    panelId: mapping.panelId,
    entityIds: uniqueStrings(mapping.entityIds ?? mapping.suggestedEntityIds ?? [])
  }));
}

function scoreEntityMatch(panelText: string, entity: EntityForMapping) {
  const name = entity.name.toLowerCase();
  let score = includesToken(panelText, name) ? 4 : 0;

  for (const token of name.split(/\s+/).filter((part) => part.length > 2)) {
    if (includesToken(panelText, token)) score += 1;
  }

  const context = `${entity.description ?? ""} ${entity.visualPromptBlock ?? ""}`.toLowerCase();
  for (const token of context.split(/[^a-z0-9]+/).filter((part) => part.length > 4)) {
    if (includesToken(panelText, token)) score += 0.25;
  }

  return score;
}

function includesToken(text: string, token: string) {
  if (!token.trim()) return false;
  return text.includes(token.trim().toLowerCase());
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}
