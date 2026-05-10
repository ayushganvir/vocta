import { PromptPurpose } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { compilePrompt } from "./compiler";
import type { PromptCompilationInput } from "./types";

describe("prompt compiler", () => {
  it("produces deterministic prompts for equivalent unordered inputs", () => {
    const first = compilePrompt(createInput(), {
      purpose: PromptPurpose.IMAGE,
      provider: "openai",
      model: "gpt-image-1"
    });
    const second = compilePrompt(createInput({ reverseCollections: true }), {
      purpose: PromptPurpose.IMAGE,
      provider: "openai",
      model: "gpt-image-1"
    });

    expect(second.finalPrompt).toBe(first.finalPrompt);
    expect(second.layerBreakdown.map((layer) => layer.title)).toEqual(
      first.layerBreakdown.map((layer) => layer.title)
    );
    expect(second.snapshotPayload).toEqual(first.snapshotPayload);
  });

  it("propagates mapped entity and panel reference asset IDs", () => {
    const compiled = compilePrompt(createInput(), {
      purpose: PromptPurpose.VIDEO,
      provider: "xai",
      model: "grok-imagine"
    });

    expect(compiled.entityReferenceAssetIds).toEqual(["asset-hero"]);
    expect(compiled.panelReferenceAssetIds).toEqual([
      "asset-panel-ref",
      "asset-first-frame",
      "asset-last-frame"
    ]);
    expect(compiled.attachedReferenceAssetIds).toEqual([
      "asset-style-ref",
      "asset-hero",
      "asset-panel-ref",
      "asset-first-frame",
      "asset-last-frame"
    ]);
    expect(compiled.finalPrompt).toContain("Reference asset ID: asset-hero");
    expect(compiled.finalPrompt).toContain(
      "Panel reference asset IDs: asset-panel-ref, asset-first-frame, asset-last-frame"
    );
    expect(compiled.finalPrompt).not.toContain("asset-villain");
  });
});

function createInput(options: { reverseCollections?: boolean } = {}): PromptCompilationInput {
  const sourceMaterials = [
    {
      id: "source-b",
      type: "SCRIPT",
      title: "Script B",
      bodyText: "Second source beat."
    },
    {
      id: "source-a",
      type: "NOTE",
      title: "Note A",
      bodyText: "First source note."
    }
  ];
  const entities = [
    {
      id: "entity-villain",
      name: "Villain",
      type: "character",
      description: "Not mapped to this panel.",
      visualPromptBlock: "Sharp silhouette.",
      selectedReferenceAssetId: "asset-villain"
    },
    {
      id: "entity-hero",
      name: "Hero",
      type: "character",
      description: "Mapped protagonist.",
      visualPromptBlock: "Warm face light, red scarf.",
      selectedReferenceAssetId: "asset-hero"
    }
  ];
  const scenes = [
    {
      id: "scene-2",
      orderIndex: 2,
      title: "Aftermath",
      summary: "The city reacts.",
      panels: [
        {
          id: "panel-2",
          orderIndex: 1,
          title: "Crowd",
          narrationText: "People gather."
        }
      ]
    },
    {
      id: "scene-1",
      orderIndex: 1,
      title: "Opening",
      summary: "The hero arrives.",
      narrativePurpose: "Introduce the protagonist.",
      panels: [
        {
          id: "panel-1",
          orderIndex: 2,
          title: "Close up",
          visualIntent: "Hero looks toward the skyline."
        },
        {
          id: "panel-0",
          orderIndex: 1,
          title: "Wide shot",
          narrationText: "A quiet dawn."
        }
      ]
    }
  ];

  return {
    project: {
      id: "project-1",
      title: "Vocta Test",
      description: "A deterministic compiler test.",
      aspectRatio: "9:16"
    },
    sourceMaterials: maybeReverse(sourceMaterials, options.reverseCollections),
    styleBible: {
      id: "style-1",
      visualStyle: "Cinematic realism.",
      colorPalette: "Teal shadows and amber highlights.",
      globalReferenceAssetIds: ["asset-style-ref"]
    },
    entities: maybeReverse(entities, options.reverseCollections),
    scenes: maybeReverse(scenes, options.reverseCollections),
    scene: {
      id: "scene-1",
      orderIndex: 1,
      title: "Opening",
      summary: "The hero arrives.",
      narrativePurpose: "Introduce the protagonist.",
      notes: "Keep it grounded."
    },
    panel: {
      id: "panel-1",
      orderIndex: 2,
      title: "Close up",
      narrationText: "The hero sees the signal.",
      visualIntent: "Hero looks toward the skyline.",
      motionIntent: "Slow push in.",
      mappedEntityIds: ["entity-hero"],
      panelReferenceAssetIds: ["asset-panel-ref"],
      firstFrameAssetId: "asset-first-frame",
      lastFrameAssetId: "asset-last-frame"
    }
  };
}

function maybeReverse<T>(items: T[], reverse?: boolean) {
  return reverse ? [...items].reverse() : items;
}
