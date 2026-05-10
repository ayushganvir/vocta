# Multi-Agent Build Execution Plan

This plan turns the PRD, questionnaire, and recommendations into an implementation order designed for multiple agents. The goal is to avoid agents stepping on each other by separating work by dependency and ownership.

Current forward plan: use [remaining_execution_plan.md](./remaining_execution_plan.md) for remaining work after the fake-provider MVP, queued jobs, export, stale-state workflow, provider routing, and configuration matrix progress. The historical waves below remain useful for context and ownership boundaries.

Recommended architecture for MVP:

- Frontend: Next.js
- Backend/API: Next.js route handlers or a small Node API package
- ORM: Prisma
- Prototype database: SQLite
- Future production database: PostgreSQL
- Queue: BullMQ + Redis
- Storage: local-first abstraction, later Cloudflare R2
- API style: REST
- Providers: fake providers first, then OpenAI text, GPT Image, Grok Imagine, Google Voice/TTS

Reason:

The selected `FastAPI + Prisma + BullMQ` stack mixes Python and Node-native infrastructure. For this MVP, keeping the app, Prisma, queue, workers, and provider adapters in TypeScript is simpler and easier for parallel agents to build safely.

## Build Rules for Agents

1. Do not build hidden autonomous AI behavior.
2. Every creative AI action must be user-triggered.
3. Generated assets may auto-select when there is one candidate, but previous assets stay in history.
4. Stale warnings can be created automatically, but regeneration never happens automatically.
5. Fake providers are built before real providers.
6. Agent write scopes must be separated by folder/module where possible.
7. Each wave has an integration gate before the next wave starts.

## Wave 0: Single-Agent Foundation Decision

Run this first with one agent only.

### Todo 0.1: Lock Architecture and Repo Shape

Owner: Foundation agent

Files/modules:

- root project config
- package manager config
- app/workspace structure
- docs updates

Tasks:

- [ ] Choose TypeScript-first stack: Next.js + Prisma + BullMQ + Redis.
- [ ] Decide package manager.
- [ ] Define folders for app, server modules, workers, provider adapters, storage, tests, and docs.
- [ ] Document local terminal commands.

Acceptance:

- Architecture mismatch is resolved.
- Later agents know where to write code.
- No application behavior is implemented yet.

## Wave 1: Parallel Foundation Tracks

Start after Wave 0 is complete. These three agents can work in parallel.

### Agent 1A: Data Model and Persistence

Ownership:

- Prisma schema
- database migrations
- seed data shape
- repository/data-access helpers

Todos:

- [ ] Implement Prisma schema for core models.
- [ ] Add SQLite local database config.
- [ ] Add seed script with one demo project.
- [ ] Add data-access helpers for Project, SourceMaterial, StyleBible, Entity, Scene, Panel, PromptLayer, GenerationJob, GeneratedAsset, ChatThread, ExportPackage.

Acceptance:

- Database can migrate/reset locally.
- Seed creates a usable skeleton project.
- No provider calls are required.

### Agent 1B: App Shell and UI Skeleton

Ownership:

- Next.js routes/pages
- layout shell
- navigation
- placeholder screens
- shared UI primitives

Todos:

- [ ] Build left sidebar + main workspace + right inspector layout.
- [ ] Add routes for projects, source material, Style Bible, entities, scenes/panels, jobs, export.
- [ ] Build compact power-user visual style.
- [ ] Add placeholder components for panel list/detail and prompt inspector.

Acceptance:

- App runs locally.
- User can navigate core screens.
- UI uses mock/static data until APIs exist.

### Agent 1C: Jobs, Queue, Storage, and Provider Contracts

Ownership:

- BullMQ setup
- worker shell
- provider adapter interfaces
- fake providers
- storage abstraction

Todos:

- [ ] Create GenerationJob lifecycle service.
- [ ] Create queue names and concurrency config.
- [ ] Implement polling-friendly job status APIs or service shape.
- [ ] Implement local storage adapter.
- [ ] Implement fake text/image/video/audio providers.
- [ ] Implement provider capability interface and payload redaction helper.

Acceptance:

- Fake jobs can run without real API keys.
- Fake providers create placeholder asset records/files.
- Redaction helper removes keys, auth headers, and signed secrets.

## Gate 1: Foundation Integration

Run after Wave 1.

Owner: Integration agent

Todos:

- [ ] Wire UI to real database-backed APIs for project list and project detail.
- [ ] Verify seed project appears in UI.
- [ ] Verify fake job can be queued and completed.
- [ ] Add basic smoke test for app boot.

Acceptance:

- One local command set can run app, database, Redis, and worker.
- Seed data is visible.
- Fake generation job lifecycle works end to end.

## Wave 2: Core Creative Workspace

Start after Gate 1. These agents can run mostly in parallel because they own separate product surfaces.

### Agent 2A: Project and Source Material

Ownership:

- project CRUD APIs/UI
- source material APIs/UI
- upload flow for scripts and image references

Todos:

- [ ] Implement project create/edit/archive.
- [ ] Implement Source Material screen for script text and image references.
- [ ] Add image thumbnail support.
- [ ] Keep links store-only or deferred.
- [ ] Add upload validation once limits are finalized.

Acceptance:

- User can create a project.
- User can add script source material.
- User can upload/view image references.

### Agent 2B: Style Bible and Entities

Ownership:

- Style Bible APIs/UI
- entity APIs/UI
- reference selection
- speaker/narrator entity support

Todos:

- [ ] Build Style Bible editor with selected fields.
- [ ] Build entity CRUD for Character, Place, Object.
- [ ] Support future custom entity types at backend level.
- [ ] Support narrator/speaker entities without image references.
- [ ] Require or hard-warn for visual entity reference before visual generation.
- [ ] Warn before deleting mapped entities.

Acceptance:

- User can create Style Bible manually.
- User can create entities and assign references.
- Narrator/speaker records can store voice metadata.

### Agent 2C: Scenes and Panels

Ownership:

- scene APIs/UI
- panel APIs/UI
- panel ordering
- panel detail editor

Todos:

- [ ] Implement required scenes.
- [ ] Implement scene-scoped panel order.
- [ ] Preserve stable panel IDs.
- [ ] Implement panel create/delete/duplicate/reorder.
- [ ] Build split list/detail panel workspace.
- [ ] Build panel detail fields for narration, visual intent, motion intent, references, notes, prompt fields.

Acceptance:

- Every panel belongs to a scene.
- User can edit core panel fields.
- Panel list/detail is usable in compact mode.

### Agent 2D: Prompt Layers and Compiler

Ownership:

- prompt layer model usage
- prompt compilation service
- prompt inspector data

Todos:

- [ ] Implement prompt layer creation from project/source/story/style/entity/scene/panel/user notes.
- [ ] Implement deterministic prompt compiler.
- [ ] Include entity visual prompts and reference asset IDs.
- [ ] Store PromptCompilation snapshots.
- [ ] Expose final prompt and layer breakdown for UI.

Acceptance:

- Same inputs produce same compiled prompt.
- PromptCompilation links to panel, provider/model, layers, and references.
- No raw final prompt override in MVP.

## Gate 2: Workspace Integration

Owner: Integration agent

Todos:

- [ ] Create a seeded project with source, Style Bible, entities, scenes, panels, and prompt layers.
- [ ] Verify prompt compiler includes Style Bible and mapped entities.
- [ ] Verify panel editor updates stale state inputs but does not regenerate.
- [ ] Add smoke tests for core navigation and panel editing.

Acceptance:

- A user can manually build a complete project skeleton before any AI generation.

## Wave 3: AI-Assisted Drafting and Mapping

Start after Gate 2. These agents can run in parallel because they use shared job/provider contracts.

### Agent 3A: Analyze Story and Draft Apply

Ownership:

- story analysis job
- draft result storage
- apply UI

Todos:

- [ ] Implement `Analyze Story` job using fake text provider first.
- [ ] Output story summary, entity suggestions, style suggestions, scenes, panels.
- [ ] Store output as draft.
- [ ] Build section-by-section and individual apply UI.

Acceptance:

- AI draft does not mutate project until applied.
- Applying draft creates real objects.

### Agent 3B: Entity Extraction and Mapping

Ownership:

- entity extraction job
- entity-to-panel mapping job
- mapping review UI

Todos:

- [ ] Extract draft entities from script/source material.
- [ ] Include duplicate detection, type suggestion, visual prompt, and rationale.
- [ ] Map entities to all/selected panels.
- [ ] Show confidence/rationale/missing reference warnings.
- [ ] Apply mappings only after user confirmation.

Acceptance:

- Entity suggestions and mappings are reviewable drafts.
- Mapped entities feed prompt compilation.

### Agent 3C: Style Bible Draft and Prompt Enhancement

Ownership:

- Style Bible draft job
- prompt generation/enhancement job
- apply UI for suggested edits

Todos:

- [ ] Generate Style Bible draft from source material.
- [ ] Generate/enhance panel prompt layers.
- [ ] Store all outputs as suggestions.
- [ ] Apply suggestions field-by-field where possible.

Acceptance:

- User remains in control of all AI-suggested creative changes.

## Gate 3: AI Drafting Integration

Owner: Integration agent

Todos:

- [ ] Run fake Analyze Story on demo project.
- [ ] Apply scenes/panels.
- [ ] Extract entities.
- [ ] Map entities to panels.
- [ ] Verify prompt compiler output changes only after apply.

Acceptance:

- End-to-end pre-generation creative planning works with fake provider.

## Wave 4: Generation, Assets, Voice, Debug

Start after Gate 3. These agents can run in parallel with clear boundaries.

### Agent 4A: Image, Frame, and Video Generation

Ownership:

- image generation action
- first/last frame generation
- video generation action
- visual asset records

Todos:

- [ ] Implement single-candidate image generation.
- [ ] Auto-select newly generated image and preserve previous history.
- [ ] Implement optional first/last frame generation.
- [ ] Implement video generation with provider capability warnings.
- [ ] Use selected image/first-last/entity refs when available and supported.

Acceptance:

- Panel can generate and select visual assets through explicit clicks.
- Previous assets remain in history.

### Agent 4B: Voiceover and Speaker Workflow

Ownership:

- speaker voice metadata
- voice selection/preview UI
- audio generation
- sync metadata

Todos:

- [ ] Add project-level voice defaults.
- [ ] Support narrator and character speaker assignments.
- [ ] Implement pace slow/normal/fast plus free-text tone/emotion.
- [ ] Generate WAV/MP3 if provider supports.
- [ ] Store sync metadata for export.

Acceptance:

- Panel can generate selected audio through explicit click.
- Narrator/speaker workflow supports multiple speakers.

### Agent 4C: Asset History and Selection UI

Ownership:

- asset grids/lists
- selected/not selected state
- admin delete controls
- preview components

Todos:

- [ ] Show generated images, videos, audio, first frames, last frames.
- [ ] Auto-deselect previous same-type selected asset when new one is selected.
- [ ] Allow first and last frame to coexist because they are different roles.
- [ ] Do not export unselected assets.
- [ ] Add admin hard delete behind confirmation.

Acceptance:

- Asset selection state is clear and export-ready.

### Agent 4D: Debug Inspector

Ownership:

- prompt inspector right sidebar
- full debug panel/job drawer
- payload display/redaction UI

Todos:

- [ ] Show final prompt with layer labels/colors.
- [ ] Show layers, references, provider/model, request payload, response summary, error payload, logs, token usage, cost estimate, generation time.
- [ ] Use redacted payloads only.
- [ ] Add copy buttons for prompt, request, response summary, and error.

Acceptance:

- Every job can be inspected without exposing secrets.

## Gate 4: Generation Integration

Owner: Integration agent

Todos:

- [ ] Generate fake image, first frame, last frame, video, and audio for a demo panel.
- [ ] Verify generated candidates auto-select correctly.
- [ ] Verify prompt/debug data is visible.
- [ ] Verify previous assets remain in history.

Acceptance:

- A panel can go from prompt to selected visual/audio assets with traceability.

## Wave 5: Stale State, Export, Chat

Start after Gate 4.

### Agent 5A: Stale State

Ownership:

- stale warning service
- stale badges
- stale resolution actions

Todos:

- [ ] Create stale warnings for entity reference/description changes.
- [ ] Create stale warnings for Style Bible changes.
- [ ] Create stale warnings for narration, visual intent, motion intent, prompt layer, references, panel reorder/split/merge, source changes.
- [ ] Show warnings on panel cards, panel detail, asset cards, and export readiness.
- [ ] Add resolve actions: regenerate, recompile prompt, mark reviewed, clear manually.

Acceptance:

- Stale warnings never trigger generation.

### Agent 5B: Export Package

Ownership:

- export job
- ZIP generation
- manifest JSON/CSV
- export readiness UI

Todos:

- [ ] Generate root folder `project_name_export_YYYYMMDD_HHMM`.
- [ ] Generate folders `panel_001`, `panel_002`, etc.
- [ ] Include selected video/audio/image/first-last frames where available.
- [ ] Include `metadata.json` per panel.
- [ ] Include full JSON manifest.
- [ ] Include simpler CSV manifest.
- [ ] Treat missing assets and stale state as warnings only.

Acceptance:

- Export ZIP can be manually imported into an editor in order.

### Agent 5C: Scoped Chat

Ownership:

- chat threads/messages
- scoped context builder
- suggested patch UI

Todos:

- [ ] Implement Project, Entity, Scene, Panel chat scopes.
- [ ] Make suggestion types configurable.
- [ ] Return structured patch suggestions.
- [ ] Apply field-by-field where possible.
- [ ] Never mutate creative state directly from chat.

Acceptance:

- Chat assists editing without becoming an autonomous editor.

## Gate 5: End-to-End MVP Demo

Owner: Integration agent

Todos:

- [ ] Create project.
- [ ] Add source material.
- [ ] Analyze story.
- [ ] Apply scenes/panels.
- [ ] Create Style Bible.
- [ ] Extract/create entities.
- [ ] Map entities to panels.
- [ ] Generate image, first/last frames, video, and audio.
- [ ] Inspect debug data.
- [ ] Trigger stale warning with an upstream edit.
- [ ] Export ordered ZIP.
- [ ] Verify manifest and file structure.

Acceptance:

- The internal team can produce an editor-ready ordered asset package using fake providers.

## Wave 7: Jobs Visibility and Queue-Backed Execution

Current active wave. Detailed implementation plan: [wave_7_jobs_queue_plan.md](./wave_7_jobs_queue_plan.md).

Run after the fake-provider generation, export, and stale-state flows exist.

### Agent 7A: Jobs Visibility API and UI

Ownership:

- jobs page
- jobs REST APIs
- job query/read model
- retry/cancel routes

Todos:

- [ ] Replace the mock jobs page with a database-backed polling workspace.
- [ ] Add jobs list/detail APIs with project, status, type, and panel filters.
- [ ] Add manual retry and cancel endpoints.
- [ ] Show compiled prompts, request payloads, response summaries, logs, errors, references, generated assets, and retry relationships.

Acceptance:

- Internal users can inspect every generation job from the app.
- Retry and cancel require explicit user clicks.

### Agent 7B: Queue-Backed Generation and Export Execution

Ownership:

- queue services
- worker execution
- generation request/execute split
- export package enqueue/execute split

Todos:

- [ ] Convert image, video, and audio generation POST routes to queued requests.
- [ ] Let the worker execute provider calls, persist assets, update selected pointers, and finalize job state.
- [ ] Convert export package creation into a queued export package job.
- [ ] Preserve request payloads, compiled prompts, references, logs, and errors.
- [ ] Keep BullMQ attempts at one; retries are manual.

Acceptance:

- Generation/export routes return queued state quickly.
- Worker completion updates Prisma records and selected assets/packages.
- Failed jobs preserve enough state for debug and manual retry.

## Gate 7: Queue Integration

Owner: Integration agent

Todos:

- [ ] Run typecheck, tests, and production build.
- [ ] Start Redis, app, and worker locally.
- [ ] Trigger image, video, audio, and export actions from the UI.
- [ ] Confirm jobs appear in `/jobs` as queued/running/completed.
- [ ] Confirm retry creates a new queued job and cancel only affects cancellable jobs.
- [ ] Confirm stale-state changes do not enqueue jobs.
- [ ] Commit and push after the gate passes.

Acceptance:

- The MVP has visible asynchronous execution without hidden creative automation.

## Wave 6: Real Provider Adapters

Start after the fake-provider MVP is stable.

### Agent 6A: OpenAI Text and GPT Image

Todos:

- [ ] Implement OpenAI text adapter for story/entity/prompt jobs.
- [ ] Implement GPT Image adapter.
- [ ] Confirm exact model names and image reference support.
- [ ] Map provider responses into GenerationJob and GeneratedAsset records.

### Agent 6B: Grok Imagine Video

Todos:

- [ ] Verify API availability and auth.
- [ ] Confirm prompt-only, image-to-video, first/last frame, 9:16, duration, audio/lip-sync support.
- [ ] Implement adapter only for confirmed capabilities.
- [ ] Surface unsupported capability warnings in UI.

### Agent 6C: Google Voice/TTS

Todos:

- [ ] Confirm Google Voice/TTS API choice.
- [ ] Confirm voice list, pace, emotion/style, WAV/MP3 support.
- [ ] Implement voice preview and generation adapter.
- [ ] Store actual audio duration if available.

## Gate 6: Real Provider Verification

Todos:

- [ ] Run one real story analysis.
- [ ] Generate one real image.
- [ ] Generate one real video.
- [ ] Generate one real voiceover.
- [ ] Export a real mixed package.
- [ ] Confirm debug data and redaction.

Acceptance:

- Real providers work behind the same job/provider interfaces as fake providers.

## Agent Assignment Summary

Good first single-agent task:

- Wave 0: Lock architecture and repo shape.

Good first parallel batch:

- Agent 1A: Data model.
- Agent 1B: App shell.
- Agent 1C: Jobs/storage/provider contracts.

Good second parallel batch:

- Agent 2A: Project/source.
- Agent 2B: Style/entities.
- Agent 2C: Scenes/panels.
- Agent 2D: Prompt compiler.

Good third parallel batch:

- Agent 3A: Analyze Story.
- Agent 3B: Entity extraction/mapping.
- Agent 3C: Style/prompt suggestions.

Good fourth parallel batch:

- Agent 4A: Visual generation.
- Agent 4B: Voiceover.
- Agent 4C: Asset selection.
- Agent 4D: Debug inspector.

Good fifth parallel batch:

- Agent 5A: Stale state.
- Agent 5B: Export.
- Agent 5C: Scoped chat.

Current parallel batch:

- Agent 7A: Jobs visibility API and UI.
- Agent 7B: Queue-backed generation and export execution.

Current remaining-work batch:

- Wave R1: provider safety, health checks, cheap live harness, and capability verification.
- Wave R2: real asset handling/previews and entity/reference warnings before generation.
- Wave R3: prompt enhancement review/apply and scoped chat suggestion/apply.
- Wave R4: final coordinated real provider smoke testing.
