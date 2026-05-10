import {
  AssetType,
  ChatMessageRole,
  ChatScopeType,
  PrismaClient,
  PromptLayerType,
  SourceMaterialType
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@vocta.local" },
    update: { name: "Demo Producer" },
    create: {
      email: "demo@vocta.local",
      name: "Demo Producer"
    }
  });

  const team = await prisma.team.upsert({
    where: { slug: "internal" },
    update: { name: "Internal Creative Team" },
    create: {
      slug: "internal",
      name: "Internal Creative Team"
    }
  });

  await prisma.systemSettings.upsert({
    where: { teamId: team.id },
    update: {},
    create: {
      teamId: team.id,
      maxBatchSize: 12,
      providerRateLimitSettings: {
        notes: "Prototype defaults for local fake-provider development."
      }
    }
  });

  const project = await prisma.project.upsert({
    where: {
      teamId_slug: {
        teamId: team.id,
        slug: "vertical-myth-demo"
      }
    },
    update: {
      title: "Vertical Myth Demo",
      description: "Seed project skeleton for the Vocta MVP workspace."
    },
    create: {
      teamId: team.id,
      createdById: user.id,
      title: "Vertical Myth Demo",
      slug: "vertical-myth-demo",
      description: "Seed project skeleton for the Vocta MVP workspace.",
      aspectRatio: "9:16",
      modelStack: {
        create: {
          textProvider: "openai",
          textModel: "gpt-4.1",
          imageProvider: "openai",
          imageModel: "gpt-image-1",
          videoProvider: "xai",
          videoModel: "grok-imagine",
          voiceProvider: "google",
          voiceModel: "google-tts",
          providerSettings: {
            mode: "fake-first",
            debugVisibleToEveryone: true
          }
        }
      },
      styleBible: {
        create: {
          visualStyle: "Cinematic vertical mythic realism with practical, editor-ready continuity.",
          colorPalette: "Deep indigo night, warm firelight, muted gold accents.",
          lightingStyle: "High contrast moonlight mixed with soft torch light.",
          cameraStyle: "Slow push-ins, close reaction shots, grounded handheld movement.",
          notes: "All fields are editable; this is only a starting point."
        }
      }
    }
  });

  const existingScene = await prisma.scene.findFirst({
    where: { projectId: project.id, orderIndex: 1 }
  });

  const scene =
    existingScene ??
    (await prisma.scene.create({
      data: {
        projectId: project.id,
        orderIndex: 1,
        title: "Opening Hook",
        summary: "A lone narrator introduces the mystery before the first reveal.",
        narrativePurpose: "Establish stakes and visual tone."
      }
    }));

  const existingPanel = await prisma.panel.findFirst({
    where: { sceneId: scene.id, orderIndex: 1 }
  });

  const panel =
    existingPanel ??
    (await prisma.panel.create({
      data: {
        projectId: project.id,
        sceneId: scene.id,
        orderIndex: 1,
        title: "Moonlit reveal",
        narrationText: "At the edge of the old city, a forgotten door begins to glow.",
        visualIntent: "A vertical composition: stone arch, blue moonlight, a thin gold glow from the door seam.",
        motionIntent: "Slow dolly toward the glowing doorway with drifting dust.",
        timelineMetadata: { editorialBeat: "hook" },
        staleState: { isStale: false, reasons: [] }
      }
    }));

  await prisma.sourceMaterial.upsert({
    where: { id: `${project.id}_seed_script` },
    update: {
      title: "Seed Script",
      bodyText: "A mysterious door appears in an old city and pulls the narrator into a mythic journey."
    },
    create: {
      id: `${project.id}_seed_script`,
      projectId: project.id,
      createdById: user.id,
      type: SourceMaterialType.SCRIPT,
      title: "Seed Script",
      bodyText: "A mysterious door appears in an old city and pulls the narrator into a mythic journey.",
      metadata: { seed: true }
    }
  });

  await prisma.entity.upsert({
    where: { id: `${project.id}_seed_narrator` },
    update: {
      name: "Narrator",
      type: "character",
      description: "Voice-only guide for the opening story."
    },
    create: {
      id: `${project.id}_seed_narrator`,
      projectId: project.id,
      name: "Narrator",
      type: "character",
      description: "Voice-only guide for the opening story.",
      visualPromptBlock: null,
      metadata: {
        speakerOnly: true,
        voice: { provider: "google", voiceId: "demo-narrator" }
      }
    }
  });

  await prisma.generatedAsset.upsert({
    where: { id: `${project.id}_seed_reference_asset` },
    update: {
      fileUrl: "/seed/reference/moonlit-door.png",
      storagePath: "seed/reference/moonlit-door.png"
    },
    create: {
      id: `${project.id}_seed_reference_asset`,
      projectId: project.id,
      panelId: panel.id,
      assetType: AssetType.REFERENCE,
      fileUrl: "/seed/reference/moonlit-door.png",
      previewUrl: "/seed/reference/moonlit-door.png",
      storagePath: "seed/reference/moonlit-door.png",
      mimeType: "image/png",
      width: 1080,
      height: 1920,
      metadata: { seed: true, note: "Placeholder path for local prototype." }
    }
  });

  await prisma.promptLayer.upsert({
    where: { id: `${panel.id}_seed_panel_context` },
    update: {
      content: "The first panel should sell the mystery clearly in a single vertical shot."
    },
    create: {
      id: `${panel.id}_seed_panel_context`,
      projectId: project.id,
      panelId: panel.id,
      layerType: PromptLayerType.PANEL_CONTEXT,
      title: "Panel Context",
      content: "The first panel should sell the mystery clearly in a single vertical shot.",
      sortOrder: 10,
      createdById: user.id
    }
  });

  const thread = await prisma.chatThread.upsert({
    where: { id: `${project.id}_seed_thread` },
    update: { title: "Project Notes" },
    create: {
      id: `${project.id}_seed_thread`,
      projectId: project.id,
      scopeType: ChatScopeType.PROJECT,
      title: "Project Notes",
      createdById: user.id
    }
  });

  await prisma.chatMessage.upsert({
    where: { id: `${thread.id}_seed_message` },
    update: {
      content: "Seed note: keep AI suggestions reviewable before applying them."
    },
    create: {
      id: `${thread.id}_seed_message`,
      chatThreadId: thread.id,
      role: ChatMessageRole.SYSTEM,
      content: "Seed note: keep AI suggestions reviewable before applying them."
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
