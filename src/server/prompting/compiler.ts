import type { PromptPurpose } from "@prisma/client";

import {
  buildPromptLayers,
  createModelFormattingLayer,
  getEntityReferenceAssetIds,
  getPanelReferenceAssetIds,
  getStyleReferenceAssetIds,
  uniqueStable
} from "./layers";
import type {
  CompiledPrompt,
  PromptCompilationInput,
  PromptLayerBreakdownItem,
  PromptLayerSnapshot
} from "./types";

export interface CompilePromptOptions {
  purpose: PromptPurpose;
  provider: string;
  model: string;
  includeModelFormattingLayer?: boolean;
}

export function compilePrompt(
  input: PromptCompilationInput,
  options: CompilePromptOptions
): CompiledPrompt {
  const layers = [
    ...buildPromptLayers(input),
    ...(options.includeModelFormattingLayer === false
      ? []
      : [createModelFormattingLayer(options.provider, options.model)])
  ];
  const includedLayers = layers.filter((item) => item.content.trim().length > 0);
  const finalPrompt = renderPrompt(includedLayers, options.purpose);
  const layerBreakdown = includedLayers.map(toBreakdownItem);
  const entityReferenceAssetIds = getEntityReferenceAssetIds(input.entities ?? [], input.panel ?? null);
  const panelReferenceAssetIds = getPanelReferenceAssetIds(input.panel ?? null);
  const attachedReferenceAssetIds = uniqueStable([
    ...getStyleReferenceAssetIds(input.styleBible),
    ...entityReferenceAssetIds,
    ...panelReferenceAssetIds
  ]);
  const tokenEstimate = estimateTokens(finalPrompt);

  const snapshotPayload = {
    schemaVersion: 1 as const,
    purpose: options.purpose,
    provider: options.provider,
    model: options.model,
    layers: includedLayers,
    layerBreakdown,
    references: {
      attachedReferenceAssetIds,
      entityReferenceAssetIds,
      panelReferenceAssetIds
    }
  };

  return {
    projectId: input.project.id,
    panelId: input.panel?.id,
    purpose: options.purpose,
    provider: options.provider,
    model: options.model,
    finalPrompt,
    layers: includedLayers,
    layerBreakdown,
    attachedReferenceAssetIds,
    entityReferenceAssetIds,
    panelReferenceAssetIds,
    tokenEstimate,
    snapshotPayload
  };
}

export function renderPrompt(layers: PromptLayerSnapshot[], purpose: PromptPurpose) {
  const sections = [
    `Purpose: ${purpose}`,
    ...layers.map((layer) => `## ${layer.title}\n${layer.content.trim()}`)
  ];

  return sections.join("\n\n").trim();
}

export function estimateTokens(text: string) {
  if (!text.trim()) return 0;
  return Math.ceil(text.trim().split(/\s+/).length * 1.3);
}

function toBreakdownItem(layer: PromptLayerSnapshot, index: number): PromptLayerBreakdownItem {
  return {
    layerType: layer.layerType,
    source: layer.source,
    title: layer.title,
    included: true,
    orderIndex: index,
    tokenEstimate: estimateTokens(layer.content),
    references: layer.references
  };
}
