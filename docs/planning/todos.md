# MVP Implementation Todo Hierarchy

Status: derived from the answered questionnaire and recommendations. For multi-agent execution order, use [agent_execution_plan.md](./agent_execution_plan.md). This file keeps the detailed product/backlog hierarchy.

Legend:

- `P0`: required for MVP end-to-end demo.
- `P1`: required for reliable internal use.
- `P2`: useful after the core flow works.
- `Open`: needs one remaining decision before implementation.

## Phase 0: Locked Recommendations and Remaining Verification

- [ ] [P0] [Product] Lock manual-first automation policy
  - Source: Questionnaire sections 2, 18
  - Decision: AI actions require user clicks by default; automatic regeneration is not part of MVP.
  - Acceptance:
    - MVP rule is written as: no automatic creative generation or regeneration.
    - Any future automation setting is explicitly post-MVP unless approved.
    - Stale warnings may appear automatically because they are status indicators, not creative mutation.

- [ ] [P0] [Product] Lock single-candidate generation behavior
  - Source: Questionnaire sections 2, 12, 14
  - Decision: generate one candidate per click; auto-select the generated candidate; keep previous asset history.
  - Acceptance:
    - One image/video/audio candidate is created per generation action.
    - New generated candidate becomes selected by default.
    - Previous selected same-type asset is auto-deselected but remains in history.
    - First frame and last frame can both be selected because they are different frame roles.

- [ ] [P0] [Product] Finalize source upload limits
  - Source: Questionnaire section 5
  - Open: answers describe allowed media count/use, not file-size limits.
  - Acceptance:
    - Image, video, audio, and other file max sizes are decided.
    - MVP allowed source types are finalized as script and image references first; video reference support includes thumbnail/playback.

- [x] [P0] [Product] Lock export manifest completeness
  - Source: Questionnaire section 19
  - Recommendation: use the full recommended JSON manifest; keep CSV simpler for editor handoff.
  - Implemented: Wave 5 uses the recommended JSON manifest with project, export, ordered panel, selected asset, duration, stale warning, entity mapping, and generation job fields; CSV mirrors editor-useful fields.
  - Acceptance:
    - Required manifest fields are finalized.
    - Minimum recommendation is accepted or edited: project title, timestamp, scene/panel order, selected asset paths, narration, duration fields, stale warnings, entity mappings, provider/model, job IDs.

- [ ] [P0] [Providers] Verify provider capabilities
  - Source: Questionnaire sections 20, 24
  - Open:
    - Exact ChatGPT/OpenAI text model.
    - Exact image model referred to as `image2`.
    - xAI Grok Imagine API support for prompt-only, image-to-video, first/last frames, duration, 9:16, audio/lip-sync.
    - Google Voice/TTS support for pace, emotion/style, WAV/MP3.
  - Acceptance:
    - Provider capability matrix is filled.
    - Unsupported controls are shown as warnings rather than silently hidden.

- [ ] [P0] [Architecture] Lock TypeScript-first MVP stack
  - Source: Questionnaire section 21
  - Recommendation: Next.js + TypeScript API/server modules + Prisma + SQLite prototype + BullMQ/Redis + local storage first, later Cloudflare R2 and PostgreSQL.
  - Acceptance:
    - FastAPI is deferred unless there is a strong reason to reintroduce Python.
    - Prisma and BullMQ stay in the TypeScript runtime.
    - REST API style is used.

## Phase 1: App Foundation

- [ ] [P0] [DevOps] Scaffold the monorepo/app structure
  - Source: Questionnaire section 21
  - Acceptance:
    - Frontend app exists.
    - Backend API exists.
    - Worker process exists or is planned in the selected stack.
    - Local environment variables are documented.
    - Separate terminal commands are documented for frontend, backend, queue/worker, and Redis if needed.

- [ ] [P0] [Database] Create initial database schema
  - Source: PRD section 7, questionnaire sections 3-20
  - Acceptance:
    - Models exist for User, Team, Project, SourceMaterial, ModelStack, StyleBible, Entity, Scene, Panel, PromptLayer, PromptCompilation, GenerationJob, GeneratedAsset, ChatThread, ChatMessage, TimelineManifest, ExportPackage, and settings.
    - MVP fields match answered decisions: editable aspect ratio, no required project duration, draft/archive statuses, simple permissions.

- [ ] [P0] [Backend] Implement basic internal auth/session model
  - Source: Questionnaire section 3
  - Acceptance:
    - Single-user/internal mode works.
    - Everyone can do everything in MVP.
    - Debug mode is available to everyone.
    - created_by fields can be stored even if auth is simple.

- [ ] [P0] [Storage] Implement local-first storage abstraction
  - Source: Questionnaire sections 5, 21, 22
  - Acceptance:
    - Local storage works for prototype uploads/generated files.
    - Storage interface can later point to Cloudflare R2.
    - Asset records store storage path, preview path, mime type, and metadata.
    - Signed URLs are deferred but not blocked by design.

## Phase 2: Project and Source Material

- [ ] [P0] [Frontend] Build project list and create-project flow
  - Source: Questionnaire section 4
  - Acceptance:
    - User can create a project.
    - Aspect ratio defaults to 9:16 and is editable.
    - Language supports English and Hindi labels/metadata.
    - Project status supports at least Draft and Archived.

- [ ] [P0] [Backend] Implement project CRUD APIs
  - Source: Questionnaire section 4
  - Acceptance:
    - REST endpoints create, read, update, archive projects.
    - Archived behavior is marked as later unless explicitly implemented.

- [ ] [P0] [Frontend] Build Source Material screen for scripts and image references
  - Source: Questionnaire section 5
  - Acceptance:
    - User can add/edit script text.
    - User can upload image references.
    - User can view image thumbnails.
    - Source material is tied to project.

- [ ] [P1] [Frontend] Add video reference preview support
  - Source: Questionnaire section 5
  - Acceptance:
    - User can upload video references if file limits are confirmed.
    - Video thumbnails and browser playback are available.

- [ ] [P2] [Backend] Add external link handling
  - Source: Questionnaire section 5
  - Acceptance:
    - Store-only, fetch-after-click, or summarize-after-click behavior is implemented after decision.
    - No link content is fetched silently.

## Phase 3: Story Analysis

- [ ] [P0] [Backend] Implement `Analyze Story` generation job
  - Source: Questionnaire section 6
  - Acceptance:
    - User clicks `Analyze Story`.
    - Job produces story summary, entities, style suggestions, scene structure, and panel structure.
    - Narration improvements, duration estimates, and warnings are not required unless later selected.
    - Output is stored as a draft, not directly applied.

- [ ] [P0] [Frontend] Build story analysis review/apply UI
  - Source: Questionnaire section 6
  - Acceptance:
    - User can apply section by section.
    - User can apply individual suggestions where practical.
    - Applying drafts creates/updates real project objects only after explicit click.

## Phase 4: Style Bible

- [ ] [P0] [Database] Implement Style Bible fields
  - Source: Questionnaire section 7
  - Acceptance:
    - Fields include characters, places, objects, visual style, color palette, lighting, camera style.
    - Negative prompt, global references, and brand notes remain optional/future-ready.

- [ ] [P0] [Frontend] Build Style Bible editor
  - Source: Questionnaire section 7
  - Acceptance:
    - User can manually edit selected fields.
    - No Style Bible field is required before generation unless later changed.
    - Empty or weak style data shows warnings, not blockers.

- [ ] [P0] [Backend] Mark related outputs stale when Style Bible changes
  - Source: Questionnaire sections 7, 18
  - Acceptance:
    - Changing Style Bible marks panel prompts/assets stale.
    - No regeneration is triggered.

- [ ] [P1] [Backend] Implement Style Bible draft job
  - Source: PRD section 10
  - Acceptance:
    - User clicks to generate draft.
    - Draft can be applied manually.

## Phase 5: Entities, Speakers, and References

- [ ] [P0] [Database] Implement entity model with future custom type support
  - Source: Questionnaire section 8
  - Acceptance:
    - UI exposes Character, Place, Object.
    - Backend type field can support future custom values.
    - Entity fields include name, type, visual prompt block, selected reference image, and metadata.
    - Description and notes can exist but are not required in MVP.

- [ ] [P0] [Product/Database] Support speaker-only people/narrator entities
  - Source: Questionnaire section 13
  - Acceptance:
    - Entity model can represent people/speakers who have voices but no image reference.
    - Narrator can be added as a speaker/entity.
    - Character speakers can have previewable voice settings.

- [ ] [P0] [Frontend] Build entity CRUD and reference selection UI
  - Source: Questionnaire section 8
  - Acceptance:
    - User can create Character, Place, Object.
    - User can set visual prompt block.
    - Reference image is required or hard-warned before visual generation.
    - Deleting a mapped entity shows warning.

- [ ] [P0] [Backend] Implement entity extraction job
  - Source: Questionnaire section 9
  - Acceptance:
    - Job reads decided source scope.
    - Output is a draft list with duplicate detection, type suggestions, visual prompt suggestions, and optional rationale.
    - User applies entities manually.

- [ ] [P0] [Backend] Implement entity-to-panel mapping job
  - Source: Questionnaire section 9
  - Acceptance:
    - Job maps all panels, selected panels, or one scene depending on chosen scope.
    - Suggestions include confidence/rationale/missing-reference warnings if selected.
    - Mapping never applies automatically.

- [ ] [P0] [Frontend] Build panel entity mapping editor
  - Source: Questionnaire section 9
  - Acceptance:
    - User can add/remove mapped entities manually.
    - User can accept AI mappings per panel.
    - User sees missing reference warnings.

## Phase 6: Scenes and Panels

- [ ] [P0] [Database] Implement required scenes and scene-scoped panel ordering
  - Source: Questionnaire section 10
  - Acceptance:
    - Each panel belongs to a scene.
    - Panel order is within scene.
    - Stable panel ID is preserved.
    - Current decision says preserve original numbering; if display order differs, show both stable ID and current order where needed.

- [ ] [P0] [Backend] Implement panel CRUD and reorder
  - Source: Questionnaire section 10
  - Acceptance:
    - Create, delete, duplicate, reorder are implemented.
    - Duplicate copies selected text/prompts/references according to final decision.
    - Split and merge are deferred unless re-selected.

- [ ] [P0] [Frontend] Build split list/detail panel workspace
  - Source: Questionnaire section 22
  - Acceptance:
    - Left sidebar + main workspace + right inspector layout exists.
    - Default panel view is split list/detail.
    - Panel card shows number, title, narration, entities, image/video preview, audio status, durations, stale badges, and generation buttons.
    - UI is compact/power-user oriented.

- [ ] [P0] [Frontend] Build panel detail editor
  - Source: Questionnaire section 10
  - Acceptance:
    - User can edit text, prompts, references.
    - User can trigger image, video, and voice generation from panel detail.
    - Generation requirement warnings match decisions: prompt required; references optional unless entity/reference rule blocks or warns.

## Phase 7: Prompt System

- [ ] [P0] [Database] Implement prompt layers and prompt compilations
  - Source: Questionnaire section 11
  - Acceptance:
    - Layers include global intent, source summary, story context, Style Bible, entity references, scene context, panel context, and user notes/manual edits.
    - Model-specific formatting can exist internally even if not user-editable.
    - Raw final prompt override is not supported in MVP.

- [ ] [P0] [Prompting] Implement deterministic prompt compiler
  - Source: Questionnaire section 11
  - Acceptance:
    - Compiler creates final prompt from layers.
    - Compiler attaches entity and panel reference asset IDs.
    - PromptCompilation stores layer snapshot, final prompt, references, provider, model, and estimates where available.

- [ ] [P0] [Frontend] Build prompt layer editor and inspector
  - Source: Questionnaire sections 11, 16, 22
  - Acceptance:
    - Normal mode allows structured fields, user notes, and selected prompt layers.
    - Debug inspector shows final prompt, layer breakdown, references, request payload, response summary, and cost/token estimates.
    - Final prompt is color-coded or labeled by contributing layer.

## Phase 8: Jobs, Queue, and Providers

- [ ] [P0] [Queue] Implement GenerationJob lifecycle
  - Source: Questionnaire section 15
  - Acceptance:
    - Job types include story analysis, Style Bible draft, entity extraction, scene/panel split, entity mapping, prompt generation/enhancement, image, video, audio, and export.
    - Statuses include queued, running, completed, failed, cancelled.
    - Job stores provider/model, prompt, references, request/response summaries, logs, timing, errors, cost/token data where available.

- [ ] [P0] [Queue] Implement queue update strategy
  - Source: Questionnaire section 15
  - Recommendation: start with polling; upgrade to SSE/WebSockets only if UX needs it.
  - Acceptance:
    - UI can show queued/running/completed/failed states.
    - Manual retry is supported.
    - Queued jobs can be cancelled.
    - Running job cancellation is attempted only if provider supports it.

- [ ] [P0] [Queue] Implement concurrency settings
  - Source: Questionnaire section 15
  - Recommendation: prompt 10, image 5, video 2, audio 3 unless provider limits require lower values.
  - Acceptance:
    - Concurrency is configurable by environment/settings.
    - Video concurrency is lower than text/image because video jobs are slower and costlier.

- [ ] [P0] [Providers] Implement provider adapter interface
  - Source: Questionnaire section 20
  - Acceptance:
    - Adapters support validateInput, buildRequest, execute, parseResponse, saveAssets, estimateCost, redactPayload.
    - Capability warnings can be shown without disabling user workflow.

- [ ] [P0] [Providers] Implement fake provider adapters for development/testing
  - Source: Questionnaire section 23
  - Acceptance:
    - Fake text/image/video/audio adapters run without paid API calls.
    - Fake adapters create realistic records and placeholder assets.
    - Real API keys can be used manually outside automated tests.

- [ ] [P1] [Providers] Implement real text/image/video/voice adapters after capability verification
  - Source: Questionnaire sections 20, 24
  - Acceptance:
    - Text adapter supports story/entity/prompt jobs.
    - Image adapter supports 9:16 and references if available.
    - Video adapter supports confirmed Grok Imagine capabilities.
    - Voice adapter supports Google Voice/TTS with chosen output formats.

## Phase 9: Generation and Asset Selection

- [x] [P0] [Backend] Implement single-candidate image generation
  - Source: Questionnaire section 12
  - Implemented: Wave 4 added manual image generation API, layered prompt compilation, fake provider storage, selected-image update, asset history preservation, and service tests.
  - Acceptance:
    - One image is generated per click.
    - Entity references and panel references are attached.
    - Generated image becomes selected by default.
    - Previous selected image remains in asset history.

- [ ] [P0] [Backend] Implement optional first/last frame generation
  - Source: Questionnaire sections 12, 14
  - Progress: Wave 4 added explicit first-frame and last-frame generation actions with separate selected asset IDs. Keep open until export inclusion is implemented.
  - Acceptance:
    - User can generate first frame and last frame assets.
    - Each role can have one selected asset.
    - First/last frames are exported if final export settings include them.

- [ ] [P0] [Backend] Implement video generation
  - Source: Questionnaire section 12
  - Progress: Wave 4 added manual fake-provider video generation API using compiled panel prompts plus selected image/frame references. Keep open for real provider capability handling and duration estimation.
  - Acceptance:
    - Video generation can run without mandatory video input if provider supports prompt-only.
    - Uses selected image/first-last/motion prompt/entity references when available and supported.
    - Default duration is derived from narration/script estimate where practical.
    - Generated video becomes selected by default if video export remains selected.

- [x] [P0] [Frontend] Build asset history and selection UI
  - Source: Questionnaire section 14
  - Implemented: Wave 4 added panel asset history cards, selected/not selected badges, preview for images, and manual select action for image/video/audio assets.
  - Acceptance:
    - Panel shows current selected image/audio/first/last frame and any selected video if used.
    - Asset state is selected/not selected only.
    - Admin hard delete is available only for admin/debug users or deferred behind confirmation.
    - Unselected assets are not exported.

## Phase 10: Voiceover and Speaker Workflow

- [ ] [P0] [Database] Add speaker/voice metadata
  - Source: Questionnaire section 13
  - Acceptance:
    - Project can have narrator/speaker entries.
    - Character entities can be associated with voice settings.
    - Narrator can exist without image reference.

- [ ] [P0] [Frontend] Build voice selection and preview UI
  - Source: Questionnaire section 13
  - Acceptance:
    - User can choose project-level voice defaults.
    - Multiple speakers can be previewed.
    - Panel voice assignment can refer to narrator or character speaker where needed.

- [ ] [P0] [Backend] Implement audio generation
  - Source: Questionnaire section 13
  - Progress: Wave 4 added manual fake-provider audio generation API with pace, emotion, WAV/MP3, duration metadata, and selected-audio update. Keep open for the real Google Voice/TTS adapter.
  - Acceptance:
    - Uses Google Voice/TTS provider adapter.
    - Supports pace as slow/normal/fast plus tone/emotion free text.
    - Supports WAV and MP3 if provider supports both.
    - Generated audio becomes selected by default.

- [ ] [P0] [Export] Include sync-friendly metadata
  - Source: Questionnaire section 13
  - Acceptance:
    - Manifest can include narration text, pace, emotion, target duration if available, actual audio duration if known, actual video duration if known, and editor notes.
    - Metadata helps editor align audio/video manually outside the app.

## Phase 11: Debug Mode

- [ ] [P0] [Backend] Implement redacted debug payload storage
  - Source: Questionnaire section 16
  - Recommendation: store redacted payload plus response summary.
  - Acceptance:
    - API keys, auth headers, signed URL secrets, and sensitive user data are never displayed.
    - Redaction is tested.

- [ ] [P0] [Frontend] Build debug inspector UI
  - Source: Questionnaire section 16
  - Progress: Wave 4 added panel-level recent job inspector showing compiled prompt, request payload, response summary, logs, errors, status, provider/model, and duration. Keep open for token/cost/layer breakdown polish.
  - Acceptance:
    - User can inspect final prompt, layers, references, provider/model, request payload, response summary, error payload, logs, token usage, cost estimate, generation time.
    - Provider request ID is optional.
    - Debug UI location is decided: recommended panel detail tab plus job drawer.

## Phase 12: Scoped Chat

- [ ] [P1] [Database] Implement chat threads/messages
  - Source: Questionnaire section 17
  - Acceptance:
    - Chat scopes include Project, Entity, Scene, Panel.
    - Messages persist by scope.

- [ ] [P1] [Backend] Implement configurable chat suggestion types
  - Source: Questionnaire section 17
  - Acceptance:
    - Admin/config controls which edit types chat can suggest.
    - Chat returns structured suggested patches.
    - Chat never directly mutates creative state.

- [ ] [P1] [Frontend] Build scoped chat apply UI
  - Source: Questionnaire section 17
  - Acceptance:
    - User can apply whole suggestion card or field-by-field based on final choice.
    - Recommendation: field-by-field for MVP because user asked for control.

## Phase 13: Stale State

- [ ] [P0] [Backend] Implement stale warning rules
  - Source: Questionnaire section 18
  - Acceptance:
    - Stale warnings are created when entity description/reference, Style Bible, narration, visual/motion intent, prompt layer, references, panel order/split/merge, or source material changes.
    - Model Stack changes can be added later unless selected.
    - Stale warnings never generate assets.

- [ ] [P0] [Frontend] Show stale warnings in workflow
  - Source: Questionnaire section 18
  - Acceptance:
    - Warnings show on panel cards, panel detail, asset cards, and export readiness.
    - Manifest inclusion is open and handled by export decision.
    - User can regenerate, recompile, mark reviewed, or clear manually.

## Phase 14: Export

- [x] [P0] [Export] Define export package structure
  - Source: Questionnaire section 19
  - Implemented: Wave 5 creates `project_export_YYYYMMDD_HHMM.zip` with ordered panel folders, panel metadata JSON, timeline_manifest.json, and timeline_manifest.csv.
  - Acceptance:
    - Root folder is `project_name_export_YYYYMMDD_HHMM`.
    - Panel folders use ordered names such as `001_panel_intro`.
    - Files use stable semantic names with source extensions, such as `video.mp4`, `audio.wav`, `image.png`/`image.svg`, `first_frame.png`/`first_frame.svg`, and `last_frame.png`/`last_frame.svg`.
    - Export currently includes ordered folders, selected video, selected audio, selected image, first/last frames, JSON manifest, and CSV manifest.

- [x] [P0] [Export] Decide whether selected images and first/last frames should export
  - Source: Questionnaire sections 14, 19
  - Decision: include selected image plus first/last frames by default because editors may need keyframes for manual assembly.
  - Acceptance:
    - Include selected image/frame assets because editors may need them.

- [x] [P0] [Export] Implement timeline manifest JSON and CSV
  - Source: Questionnaire section 19
  - Implemented: Wave 5 stores TimelineManifest rows and manifest JSON/CSV assets, and includes both manifest files in the ZIP.
  - Acceptance:
    - Manifest includes all finalized required fields.
    - CSV mirrors editor-useful fields.
    - Asset paths are relative to ZIP root.

- [x] [P0] [Frontend] Build export readiness and export action
  - Source: Questionnaire sections 1, 19
  - Implemented: Wave 5 adds the Export page readiness checks, warning list, explicit validate action, explicit package creation action, and latest ZIP download link.
  - Acceptance:
    - Missing assets and stale warnings are shown as warnings.
    - Nothing blocks export unless later selected.
    - User explicitly clicks export.

## Phase 15: Testing and Demo

- [ ] [P0] [Testing] Add prompt compiler tests
  - Source: Questionnaire section 23
  - Acceptance:
    - Layer ordering, entity reference propagation, and prompt snapshots are tested.

- [ ] [P0] [Testing] Add provider adapter contract tests with fake providers
  - Source: Questionnaire section 23
  - Acceptance:
    - Automated tests do not require real API keys.
    - Real providers can be tested manually/staging with environment variables.

- [ ] [P0] [Testing] Add queue/job lifecycle tests
  - Source: Questionnaire section 23
  - Acceptance:
    - Queued/running/completed/failed/retry/cancel paths are covered.

- [ ] [P0] [Testing] Add stale-state tests
  - Source: Questionnaire section 23
  - Acceptance:
    - Selected stale triggers create warnings.
    - No stale trigger creates a generation job.

- [x] [P0] [Testing] Add export ZIP and manifest tests
  - Source: Questionnaire section 23
  - Implemented: Wave 5 adds service coverage for selected assets, ZIP signature, JSON manifest paths, CSV content, ExportPackage records, TimelineManifest rows, and stored package objects.
  - Acceptance:
    - ZIP folder structure is validated.
    - JSON schema is validated.
    - CSV exists when enabled.

- [ ] [P1] [Testing] Add UI smoke tests
  - Source: Questionnaire section 23
  - Acceptance:
    - Demo flow covers project creation, source material, story analysis, Style Bible, entities, mappings, image/frame/video/audio generation, selection, debug, stale warning, and export.

- [ ] [P0] [Product/Testing] Create first demo project fixture
  - Source: Questionnaire sections 1, 23, 24
  - Acceptance:
    - Demo project has script, image references, scenes, panels, entities, and fake/generated assets.
    - Demo exports a valid ordered package.
