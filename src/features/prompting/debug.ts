import type { CompiledPrompt } from "@/server/prompting";

export function toPromptDebugInspectorData(compiled: CompiledPrompt) {
  return {
    finalPrompt: compiled.finalPrompt,
    layers: compiled.layers,
    layerBreakdown: compiled.layerBreakdown,
    references: {
      attachedReferenceAssetIds: compiled.attachedReferenceAssetIds,
      entityReferenceAssetIds: compiled.entityReferenceAssetIds,
      panelReferenceAssetIds: compiled.panelReferenceAssetIds
    },
    provider: compiled.provider,
    model: compiled.model,
    purpose: compiled.purpose,
    tokenEstimate: compiled.tokenEstimate
  };
}
