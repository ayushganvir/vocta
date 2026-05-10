# PRD: AI-Native Creative Production Workspace MVP

## 1. Product Summary

Vocta is an internal web app for AI-assisted pre-production, asset generation, creative organization, and ordered timeline packaging for 9:16 vertical short videos. The target output is usually 2 to 4 minutes long, assembled later by human editors in tools such as Filmora, Premiere Pro, Resolve, or similar editors.

The MVP is not a full video editor, not an autonomous AI director, and not a simple chatbot. It is a structured creative production workspace that helps an internal team move from rough source material to ordered, traceable, editor-ready assets.

The canonical internal structure is:

```text
Project
-> Source Material
-> Model Stack
-> Style Bible
-> Narrative
-> Scenes
-> Panels
-> Prompt Layers
-> Generation Jobs
-> Generated Assets
-> Selected Assets
-> Timeline Manifest
-> Ordered Export Package
```

The app maintains a semantic timeline rather than a frame-perfect video timeline. Panels are narrative beats and generation containers. The final edit, exact timing, transitions, audio alignment, and frame-level work happen outside the app in a dedicated editor.

Core principle: the user remains in control. Every important AI action is triggered by an explicit user click. AI can suggest, draft, enhance, extract, map, or generate, but no AI action silently mutates final creative state. Any AI output that changes creative state must be reviewed and applied by the user.

## 2. Target Users

Primary users are members of a small internal creative production team.

Target user roles:

- Creative producer: owns the project, story direction, style decisions, and export readiness.
- Prompt operator: configures prompts, references, model settings, and generation batches.
- Editor handoff owner: validates ordered assets, manifests, metadata, and export ZIP quality.
- Technical operator or developer: inspects prompt compilation, provider payloads, job failures, and costs.
- Voice/audio operator: manages narration, TTS generation, pacing notes, and audio candidates.

MVP should optimize for:

- Speed of structured creative iteration.
- Power-user controls.
- Visible internals.
- Editable prompts.
- Debug mode.
- Manual overrides.
- Traceability from final selected asset back to prompt and job.
- Batch actions only when explicitly triggered.

MVP should not optimize for:

- Public SaaS onboarding.
- Beginner-friendly simplification.
- Complex permissions.
- Payments.
- Marketplace workflows.
- Fully automated direction.
- Real-time collaborative commenting or approvals.

## 3. MVP Goals

### Product Goals

- Let users create projects from raw ideas, scripts, notes, narration text, images, videos, uploaded files, and external links.
- Preserve a Source Material layer as the origin of story and visual context.
- Let users explicitly trigger story analysis, entity extraction, style draft generation, scene splitting, panel splitting, and entity-to-panel mapping.
- Provide a Style Bible with optional fields for characters, places, objects, visual style, color palette, lighting style, camera style, negative prompt rules, and global reference images.
- Support simple MVP entities: Character, Place, and Object.
- Support one canonical visual state and one selected reference image per entity.
- Allow panels to reference entities and panel-specific references.
- Generate image, first/last frame images, videos, and voiceover assets through async jobs.
- Preserve full asset history while allowing only one selected image, video, and audio per panel for export.
- Compile prompts from explicit layers and expose prompt internals.
- Provide a debug/developer mode for every API call.
- Maintain stale state when upstream dependencies change, without automatic regeneration.
- Export ordered asset packages with timeline manifests for manual editor import.

### Technical Goals

- Build as a web app first.
- Store files centrally on server/object storage for previews and collaboration.
- Use async background jobs for generation.
- Use configurable provider adapters for text, image, video, and voice models.
- Keep project-level Model Stack configuration simple in MVP.
- Support future exporter adapters without requiring direct Filmora or Premiere integration in MVP.

## 4. Non-Goals

The MVP must not include:

- Full video editor.
- Real-time timeline editor.
- Frame-perfect timeline management.
- Automatic final rendering.
- Public SaaS onboarding.
- Payments.
- Marketplace features.
- Full role/permission system.
- Direct Premiere, Filmora, Resolve, FCPXML, or XML automation.
- Autonomous AI director mode.
- Hidden automatic creative generation.
- Automatic retries without user action.
- Full branching narrative graph.
- Entity variants.
- Custom entity types in the UI.
- Outfit, age, mood, or style variants per entity.
- Frame-perfect lip sync.
- Automatic word timing, phoneme timing, subtitles, or audio/video alignment.
- Advanced collaboration comments and approvals.

## 5. Core Workflow

### MVP Happy Path

1. User creates a project.
2. User adds Source Material:
   - raw idea
   - full script
   - narration text
   - rough notes
   - images
   - videos
   - external links
   - uploaded files
3. User clicks `Analyze Story`.
4. AI creates a draft story summary, entities, style suggestions, scene structure, and panel structure.
5. User reviews and applies selected suggestions.
6. User edits Style Bible fields manually or clicks `Generate Style Bible Draft`.
7. User clicks `Extract Entities` if needed.
8. User reviews entities, adds visual prompt blocks, and selects one canonical reference image per entity.
9. User clicks `Split into Scenes` or `Split into Panels`.
10. User reviews scenes and panels.
11. User clicks `Map Entities to Panels`.
12. AI suggests entity mappings per panel.
13. User accepts, edits, removes, or overrides mappings.
14. User edits panel narration, visual intent, motion intent, notes, references, and prompt layers.
15. User generates assets manually:
    - image
    - first frame and last frame
    - video
    - voiceover
16. User compares generated candidate assets and selects one output per asset type.
17. User reviews stale warnings and debug details.
18. User clicks `Export Ordered Package`.
19. App creates ZIP, timeline manifest JSON, and optional CSV.
20. Editor imports ordered assets manually into Filmora, Premiere Pro, or another editor.

### Core Control Rules

- AI suggestions do not mutate final state until applied.
- Every generation action starts from a user click.
- Batch generation is allowed only after explicit user selection and click.
- Changes upstream can mark dependent prompts or assets stale, but do not regenerate anything.
- Only selected assets enter export.
- All generated assets remain traceable to Generation Jobs.
- Every API call is inspectable in debug mode.

## 6. Information Architecture

### Top-Level Navigation

- Projects
- Project Dashboard
- Source Material
- Style Bible
- Entities
- Scenes and Panels
- Generation Jobs
- Assets
- Export Packages
- Settings

### Project Workspace Layout

Suggested three-column layout:

Left sidebar:

- project switcher
- source material
- style bible
- entity list
- scene/panel outline
- generation jobs
- export history

Main area:

- panel board/list
- scene grouping
- selected panel detail
- asset candidates
- generation controls
- export readiness view

Right sidebar:

- scoped chat
- AI actions
- prompt inspector
- debug panel
- stale dependency details

### Core Object Relationships

- A Project has one Model Stack.
- A Project has many Source Materials.
- A Project has one Style Bible.
- A Project has many Entities.
- A Project has many Scenes.
- A Scene has many Panels.
- A Panel has many Prompt Layers.
- A Panel has many Generation Jobs.
- A Generation Job can create many Generated Assets.
- A Panel can select one image, one video, and one audio asset.
- A Timeline Manifest is generated from selected panel assets.
- An Export Package contains ordered selected assets and manifests.

## 7. Data Model

The data model should be practical for MVP and support future expansion.

### User

Fields:

- id
- name
- email
- avatar_url optional
- created_at
- updated_at

MVP notes:

- Public signup is not required.
- User can be manually seeded or tied to internal auth.
- Permissions can remain simple.

### Team

Fields:

- id
- name
- slug
- created_at
- updated_at

MVP notes:

- One internal team is enough.
- Keep model for future multi-team support.

### Project

Fields:

- id
- team_id
- title
- slug
- description
- status: draft, active, exported, archived
- aspect_ratio: default `9:16`
- target_duration_min_seconds
- target_duration_max_seconds
- created_by
- created_at
- updated_at

### SourceMaterial

Fields:

- id
- project_id
- type: note, script, narration, image, video, link, file
- title
- body_text optional
- url optional
- file_asset_id optional
- metadata json
- created_by
- created_at
- updated_at

### ModelStack

Fields:

- id
- project_id
- text_provider
- text_model
- image_provider
- image_model
- video_provider
- video_model
- voice_provider
- voice_model
- default_voice_id optional
- provider_settings json
- created_at
- updated_at

Default MVP stack:

- Text reasoning/prompt generation: configurable OpenAI text model.
- Image generation: GPT Image.
- Video generation: xAI Grok Imagine.
- Voice/TTS: Google Voice or Google TTS.

### StyleBible

Fields:

- id
- project_id
- characters_text optional
- places_text optional
- objects_text optional
- visual_style optional
- color_palette optional
- lighting_style optional
- camera_style optional
- negative_prompt_rules optional
- global_reference_asset_ids array
- notes optional
- created_at
- updated_at

MVP notes:

- Everything is optional.
- Style Bible can be manually edited at all times.
- AI-generated Style Bible drafts require user apply.

### Entity

Fields:

- id
- project_id
- name
- type: character, place, object
- description
- visual_prompt_block
- notes optional
- selected_reference_asset_id optional
- source_generation_job_id optional
- metadata json
- created_at
- updated_at

MVP rules:

- One entity has one canonical visual state.
- One entity usually has one approved reference image.
- No variants in MVP.
- UI only exposes Character, Place, Object.
- Backend should not block future custom types.

### Scene

Fields:

- id
- project_id
- order_index
- title
- summary
- narrative_purpose optional
- notes optional
- created_at
- updated_at

### Panel

Fields:

- id
- project_id
- scene_id optional
- order_index
- title
- narrative_purpose
- narration_text
- visual_intent
- motion_intent
- target_duration_seconds optional
- notes
- mapped_entity_ids array
- panel_reference_asset_ids array
- first_frame_asset_id optional
- last_frame_asset_id optional
- selected_image_asset_id optional
- selected_video_asset_id optional
- selected_audio_asset_id optional
- timeline_metadata json
- stale_state json
- created_at
- updated_at

### PromptLayer

Fields:

- id
- project_id
- panel_id optional
- entity_id optional
- scene_id optional
- layer_type:
  - global_project_intent
  - source_material_summary
  - story_context
  - style_bible
  - entity_references
  - scene_context
  - panel_context
  - user_notes
  - model_specific_formatting
- title
- content
- is_editable
- sort_order
- version
- created_by
- created_at
- updated_at

### PromptCompilation

Fields:

- id
- project_id
- panel_id optional
- generation_job_id optional
- purpose: image, video, audio, text, entity_extraction, panel_split, entity_mapping
- compiled_prompt
- layers_snapshot json
- attached_reference_asset_ids array
- provider
- model
- token_estimate optional
- cost_estimate optional
- created_at

### GenerationJob

Fields:

- id
- project_id
- panel_id optional
- type:
  - prompt
  - image
  - video
  - audio
  - entity_extraction
  - panel_split
  - entity_mapping
  - style_bible_draft
  - story_analysis
- provider
- model
- status: queued, running, completed, failed, cancelled
- input_layers json
- attached_reference_asset_ids array
- compiled_prompt
- request_payload json
- response_payload_summary json
- output_asset_ids array
- logs json
- error_payload json
- cost_estimate optional
- token_usage json optional
- duration_ms optional
- retry_of_generation_job_id optional
- created_by
- created_at
- started_at optional
- completed_at optional

### GeneratedAsset

Fields:

- id
- project_id
- panel_id optional
- entity_id optional
- generation_job_id optional
- asset_type: image, video, audio, reference, file
- file_url
- preview_url optional
- storage_path
- mime_type
- duration_seconds optional
- width optional
- height optional
- is_selected
- metadata json
- created_at

MVP selection rules:

- Asset selection state is selected or not selected.
- No approval/rejected/maybe workflow in MVP.
- A panel can have many generated assets but only one selected output per asset type.

### ChatThread

Fields:

- id
- project_id
- scope_type: project, entity, scene, panel
- scope_id optional
- title optional
- created_by
- created_at
- updated_at

### ChatMessage

Fields:

- id
- chat_thread_id
- role: user, assistant, system, tool
- content
- suggested_patch json optional
- applied_at optional
- applied_by optional
- generation_job_id optional
- created_at

MVP rule:

- Chat never directly mutates creative state.
- Chat may return suggested edits.
- User must click Apply.

### TimelineManifest

Fields:

- id
- project_id
- export_package_id optional
- manifest_json
- manifest_csv optional
- created_by
- created_at

### ExportPackage

Fields:

- id
- project_id
- status: queued, running, completed, failed
- zip_file_url optional
- manifest_json_asset_id optional
- manifest_csv_asset_id optional
- included_panel_ids array
- logs json
- error_payload json
- created_by
- created_at
- completed_at optional

### SystemSettings / ConcurrencySettings

Fields:

- id
- team_id optional
- prompt_jobs_concurrency default 10
- image_jobs_concurrency default 5
- video_jobs_concurrency default 2
- audio_jobs_concurrency default 3
- max_batch_size optional
- provider_rate_limit_settings json
- created_at
- updated_at

## 8. UI/UX Screens

### Projects Screen

Purpose:

- List internal projects.
- Create project.
- Resume active project.
- Access export history.

Core UI:

- project table or dense cards
- title
- status
- last updated
- number of panels
- selected asset completeness
- export status

### Project Dashboard

Purpose:

- Provide project-level status and next actions.

Core UI:

- source material completeness
- Style Bible status
- entity count
- scene/panel count
- stale warning count
- selected image/video/audio completeness
- queued/running/failed jobs
- latest export package

### Source Material Screen

Purpose:

- Add and manage raw creative inputs.

Core UI:

- text editor for notes/scripts/narration
- file uploader
- link input
- image/video reference grid
- `Analyze Story` button
- analysis draft preview
- Apply selected suggestions

### Style Bible Screen

Purpose:

- Manage global visual rules and references.

Core UI:

- editable fields:
  - characters
  - places
  - objects
  - visual style
  - color palette
  - lighting style
  - camera style
  - negative prompt rules
  - notes
- global reference image uploader
- `Generate Style Bible Draft`
- draft diff/review panel

### Entities Screen

Purpose:

- Manage Character, Place, and Object entities.

Core UI:

- entity list
- entity detail editor
- selected reference image
- generated reference candidates
- visual prompt block
- notes
- source metadata
- `Extract Entities`
- reference generation button if supported

### Scenes and Panels Screen

Purpose:

- Main production workspace.

Core UI:

- scene grouped panel list
- panel cards
- reorder controls
- split/merge/duplicate/delete panel controls
- batch select panels
- explicit AI action buttons

Panel card displays:

- panel number
- title
- narration snippet
- mapped entities
- selected image preview
- selected video preview
- selected audio status
- stale badges
- generation buttons

### Panel Detail Screen

Sections:

1. Narrative
2. Visual
3. References
4. Image Generation
5. Video Generation
6. Voiceover
7. Prompt Layers
8. Generation Jobs
9. Debug Inspector

### Generation Jobs Screen

Purpose:

- Monitor async work and inspect failures.

Core UI:

- job table
- filters by status, type, panel, provider, model
- retry failed job
- open prompt inspector
- view request/response summary
- cancel queued/running where supported

### Export Screen

Purpose:

- Validate selected assets and create editor-ready package.

Core UI:

- ordered panel list
- selected image/video/audio status
- stale warnings
- missing asset warnings
- manifest preview
- optional CSV toggle
- `Export Ordered Package`
- export history
- download ZIP

## 9. Panel Workflow

A panel is a narrative beat plus generation container.

Panel fields:

- order/index
- title
- narrative purpose
- scene association
- narration/voiceover text
- visual intent
- motion intent
- optional target duration
- notes
- mapped entities
- references
- prompt layers
- generated images
- generated videos
- generated audio
- selected image/video/audio
- timeline metadata
- scoped chat

Panel operations:

- create panel
- delete panel
- duplicate panel
- reorder panel
- split panel
- merge panels
- edit narration
- edit visual intent
- edit motion intent
- edit references
- edit prompts
- edit notes
- regenerate assets manually
- swap selected asset

Panel generation modes:

1. Single image mode
   - User generates one image/keyframe for the panel.

2. First frame and last frame mode
   - User checks an option indicating the panel should generate both first and last frame images.
   - Generated first/last frames can be used as references for video generation.

3. Video generation mode
   - Video may use selected image only, first and last frames, panel prompt, motion prompt, entity references, and provider-specific fields.

Panel state rules:

- Narrative stays linear.
- Panel reorder updates semantic timeline order.
- Split/merge/reorder can mark downstream prompt compilations and assets stale.
- Existing generated assets remain available after edits.
- User decides whether to regenerate.

## 10. Style Bible Workflow

The Style Bible provides global visual and stylistic consistency before and during panel generation.

MVP Style Bible fields:

- characters
- places
- objects
- visual style
- color palette
- lighting style
- camera style
- negative prompt rules
- global reference images
- notes

Workflow:

1. User adds Source Material.
2. User clicks `Generate Style Bible Draft` or edits Style Bible manually.
3. AI returns a draft.
4. User reviews draft.
5. User applies accepted fields.
6. Style Bible participates in prompt compilation.
7. If Style Bible changes, affected panel prompts and generated assets can be marked stale.

Rules:

- All fields are optional.
- Manual edits are always allowed.
- AI draft does not overwrite fields without user apply.
- Style Bible should be visible as a prompt layer.

## 11. Entity Mapping Workflow

Entities actively inject visual context into generation. They are not passive metadata.

Workflow:

1. User creates or extracts entities.
2. Each entity has a name, type, description, visual prompt block, notes, and optional selected reference image.
3. User creates or splits panels.
4. User clicks `Map Entities to Panels`.
5. AI suggests which entities belong to each panel.
6. User reviews suggested mappings.
7. User applies selected mappings.
8. User can manually add, remove, or override mapped entities per panel.
9. Prompt compilation includes mapped entity visual descriptions and reference images.

Example:

```text
Panel 12: "Aarav enters the flooded temple"
Mapped entities:
- Aarav
- Flooded Temple
```

Panel reference hierarchy:

- Global entity reference image belongs to the Entity.
- Panel-specific uploaded references belong only to the Panel.
- Generated/selected panel images belong to the Panel.
- First frame and last frame images belong to the Panel.

Rules:

- Entity mapping is explicit.
- Mapping suggestions do not apply until user accepts.
- Entity changes mark affected panel prompts/assets stale.
- Panel-specific references do not mutate the global entity reference.

## 12. Prompt Layering System

The prompt system must support structured layers and editable raw prompts.

Prompt layers:

1. Global project intent
2. Source material summary
3. Story context
4. Style Bible
5. Entity references
6. Scene context
7. Panel context
8. User notes/manual edits
9. Model-specific formatting layer

Prompt compilation rules:

- Every API call compiles a final prompt from layers.
- The compiled prompt and layer snapshot are saved.
- Users can inspect layer contributions.
- Users can edit relevant layers.
- Users can view and edit raw prompt before generation when appropriate.
- Model-specific formatting should be adapter-owned but visible.
- Prompt compilation should be deterministic given the same inputs.

Prompt layer visibility:

- Normal mode shows concise editable prompt fields.
- Debug mode shows full layer tree, final prompt, references, provider payload, response summary, cost, token estimate, timing, and errors.

Prompt operations:

- Generate Panel Prompt
- Enhance Panel Prompt
- Generate Image Prompt
- Generate Video Prompt
- Generate Voiceover Prompt/metadata
- Recompile Prompt
- Save Manual Prompt Override

Manual override behavior:

- A manual prompt override should not delete layer data.
- The system should record that a generated job used manual override.
- Editing upstream layers should mark manual prompt override as possibly stale, but not overwrite it.

## 13. Generation Job System

Generation jobs are first-class objects and should be async-first.

Supported job types:

- prompt
- image
- video
- audio
- entity_extraction
- panel_split
- entity_mapping
- style_bible_draft
- story_analysis

Job lifecycle:

1. User clicks action.
2. App validates inputs.
3. App compiles prompt and references.
4. App creates queued GenerationJob.
5. Worker claims job.
6. Worker calls provider adapter.
7. Worker stores response payload summary and assets.
8. Worker marks job completed or failed.
9. UI updates job and asset history.
10. User selects generated asset if desired.

Failure behavior:

- Save failed request.
- Save provider and model.
- Save compiled prompt.
- Save references.
- Save error payload.
- Allow user to retry from failed job.
- Retry creates a new GenerationJob with `retry_of_generation_job_id`.

Traceability requirements:

- Every generated output links to its GenerationJob.
- Every GenerationJob links to compiled prompt and attached references.
- Every selected asset remains traceable to job, provider, model, and prompt.

## 14. Queue/Concurrency System

Generation should run through a background job system.

Default concurrency:

- prompt jobs concurrency: 10
- image jobs concurrency: 5
- video jobs concurrency: 2
- audio jobs concurrency: 3

Queue requirements:

- Jobs have status: queued, running, completed, failed, cancelled.
- Jobs can be filtered by project, panel, type, provider, and status.
- Batch actions create multiple queued jobs only after explicit user click.
- Batch size should be configurable.
- Provider rate limits should be respected.
- Failed jobs should not retry automatically in MVP.
- Cancel should be supported for queued jobs and supported running providers where possible.

Batch examples:

- Generate images for selected panels.
- Generate voiceover for all panels.
- Generate videos for selected panels.
- Recompile prompts for selected panels.

## 15. Debug/Developer Mode

Debug mode is required in MVP.

For every API call, users should be able to inspect:

- final compiled prompt
- contributing prompt layers
- attached image references
- model/provider used
- request payload
- response payload summary
- token estimates if available
- estimated cost if available
- generation time
- logs
- error payload if failed

Debug UI behavior:

- Normal mode remains clean.
- Debug mode exposes internals.
- Debug mode can be toggled per user/session.
- Debug details should be linked from Generation Jobs and Panel Detail.
- Sensitive provider secrets must never be displayed.

Developer needs:

- Copy final prompt.
- Copy request payload with secrets redacted.
- Copy response summary.
- View reference asset IDs and file names.
- View stale dependency chain.
- Retry failed job.

## 16. Voiceover/Lip-Sync Strategy

MVP uses Google Voice or Google TTS for voice generation.

Each panel may have:

- narration text
- selected voice
- voice style/pacing notes
- generated audio candidates
- selected audio
- estimated duration
- actual audio duration

Lip-sync distinction:

1. Generation-time sync
   - Voice speed and video prompt should be aligned enough so mouth motion can look plausible if using video generation with lip-sync style behavior.
   - Prompt metadata should include speaking pace and emotional tone.

2. Editing-time alignment
   - Actual audio/video alignment happens in Filmora, Premiere, Resolve, or another editor.
   - MVP does not attempt frame-perfect lip sync.

Sync-friendly metadata:

- panel narration text
- intended speaking pace: slow, normal, fast
- emotion
- target duration
- audio duration
- video duration
- notes for editor

Future:

- word timing
- phoneme timing
- subtitle generation
- automatic alignment
- lip-sync validation

## 17. Export Package Design

MVP export formats:

1. Ordered asset package ZIP
2. Timeline manifest JSON
3. Optional CSV manifest

Example structure:

```text
project_name_export/
  001_panel_intro/
    video.mp4
    audio.wav
    image.png
    first_frame.png
    last_frame.png
    metadata.json
  002_panel_problem/
    video.mp4
    audio.wav
    image.png
    metadata.json
  timeline_manifest.json
  timeline_manifest.csv
```

Export rules:

- Only selected assets enter export.
- Missing selected assets should produce warnings, not necessarily block export.
- Stale warnings should be included in manifest.
- Export preserves panel order.
- Export file names should be stable, ordered, and editor-friendly.
- Export should include enough metadata for manual assembly.

`timeline_manifest.json` should include:

- project title
- export timestamp
- aspect ratio 9:16
- panel order
- panel title
- selected video path
- selected audio path
- selected image path
- first frame path
- last frame path
- narration text
- target duration
- actual video duration
- actual audio duration
- notes
- stale warnings
- entity mappings
- provider/model metadata

Optional CSV columns:

- panel_order
- panel_title
- video_path
- audio_path
- image_path
- first_frame_path
- last_frame_path
- narration_text
- target_duration_seconds
- actual_video_duration_seconds
- actual_audio_duration_seconds
- notes
- stale_warnings

Future exporters:

- Premiere XML
- FCPXML
- Resolve XML
- Filmora-compatible workaround if possible

## 18. Stale State/Dependency Behavior

No automatic regeneration.

When upstream content changes, dependent prompts/assets may be marked stale or needing review.

Stale triggers:

- entity changed
- entity reference image changed
- Style Bible changed
- panel narration changed
- visual intent changed
- motion intent changed
- prompt layer changed
- references changed
- panel reordered
- panel split
- panel merged
- scene changed
- model stack changed

Example dependency behavior:

- Narration changed:
  - voiceover stale
  - video prompt possibly stale
  - timeline metadata stale

- Entity image changed:
  - affected panel image prompts stale
  - affected panel video prompts stale
  - previously generated image/video assets stale

- Style Bible changed:
  - all panel prompts possibly stale
  - entity visual blocks possibly need review

Stale state fields:

- stale_type
- affected_outputs
- reason
- source_object_type
- source_object_id
- created_at
- resolved_at optional
- resolved_by optional

Resolution options:

- regenerate manually
- mark reviewed
- keep existing
- update prompt only

## 19. Error Handling and Retries

Error handling principles:

- Preserve failed job details.
- Make failures inspectable.
- Do not discard prompts or payloads.
- Do not retry automatically in MVP.
- Let user retry explicitly.

Failure types:

- provider authentication error
- provider rate limit
- provider validation error
- content policy rejection
- upload/reference failure
- timeout
- worker crash
- storage failure
- unknown provider error

UI behavior:

- Failed jobs show panel, provider, model, failure type, and short message.
- Debug mode shows redacted request payload and error payload.
- User can retry failed job.
- Retry creates a new job linked to failed job.
- If retry needs changed inputs, user can edit prompt/references first.

## 20. Future Roadmap

Near-term after MVP:

- Per-job model overrides.
- Gemini provider adapters.
- More video/image providers.
- Local model adapters.
- Provider capability matrix.
- Better export validation.
- Premiere XML export.
- FCPXML export.
- Resolve XML export.
- Filmora-specific workaround research.
- Word timing and subtitles.
- More granular stale dependency graph.

Mid-term:

- Entity variants.
- Outfit/age/style variants.
- Custom entity types.
- Richer collaboration comments.
- Approval states beyond selected/not selected.
- Shot library and reusable prompt templates.
- Subtitles and caption styling.
- Audio bed/music/SFX organization.
- Prompt version diffing.
- Cost dashboards.

Long-term:

- Optional assisted timeline assembly.
- Optional final render pipeline.
- Direct editor plugin/export integrations.
- AI validation for continuity and consistency.
- Multi-team permissions and public SaaS features if needed.
- Publishing workflow into the future consumer app.

## 21. Technical Architecture Recommendation

Recommended MVP architecture:

- Web frontend: React/Next.js or similar.
- Backend API: Node.js/TypeScript or Python/FastAPI.
- Database: PostgreSQL.
- Object storage: S3-compatible storage for uploads, previews, generated assets, and exports.
- Queue: Redis-backed queue, BullMQ, Celery, or equivalent.
- Workers: separate worker processes by job type.
- Auth: simple internal auth or provider-backed single organization login.
- Observability: structured logs, job logs, provider error capture.

Suggested services:

- Web app service
- API service
- Worker service
- Queue/Redis service
- PostgreSQL
- Object storage

File handling:

- All uploads stored centrally.
- Previews generated where useful.
- Export packages stored as downloadable ZIP assets.
- Local desktop automation is not required in MVP.

Architecture rules:

- Provider calls go through adapters.
- Prompt compilation is a backend service.
- GenerationJob is the source of truth for API call history.
- Frontend never calls generation providers directly.
- Secrets stay server-side.
- Debug payloads are redacted before display.

## 22. API/Provider Adapter Architecture

Provider adapters should normalize capabilities while preserving provider-specific fields.

Adapter categories:

- TextAdapter
- ImageAdapter
- VideoAdapter
- VoiceAdapter

Common adapter interface concepts:

- provider
- model
- capabilities
- validateInput()
- buildRequest()
- execute()
- parseResponse()
- extractAssets()
- estimateCost()
- redactPayload()

Provider capability examples:

- supports image references
- supports multiple image references
- supports first/last frame conditioning
- supports motion prompt
- supports negative prompt
- supports aspect ratio
- supports seed
- supports duration control
- supports voice selection
- supports pacing/style

MVP provider mapping:

- OpenAI text model for reasoning/prompt generation.
- GPT Image for image generation.
- xAI Grok Imagine for video generation.
- Google Voice/TTS for audio.

Future adapter expansion:

- Gemini
- additional OpenAI models
- additional video providers
- local models
- subtitle providers
- transcription/alignment providers

Adapter rules:

- Adapters own model-specific formatting.
- Formatting layer remains inspectable.
- Provider-specific payloads are saved to GenerationJob.
- Secrets are never stored in request payload snapshots.
- Failed responses are saved with sensitive fields redacted.

## 23. Acceptance Criteria

### Product Control

- Every AI action in MVP is triggered by a visible user click.
- AI suggestions do not mutate creative state until user applies them.
- No automatic creative regeneration occurs after upstream edits.
- Batch generation requires explicit user selection and click.

### Source Material and Story

- User can create a project from mixed source material.
- User can upload files and add links/text notes.
- User can click `Analyze Story`.
- Analysis creates draft story summary, entities, style suggestions, scenes, and panels.
- User can apply or discard draft outputs.

### Style Bible and Entities

- User can edit all MVP Style Bible fields.
- User can create/edit/delete Character, Place, and Object entities.
- Each entity can store one canonical selected reference image.
- Entity visual prompt blocks are included in panel prompt compilation when mapped.

### Panels

- User can create, delete, duplicate, reorder, split, and merge panels.
- User can edit narration, visual intent, motion intent, notes, references, and prompt layers.
- User can map entities manually.
- User can use AI-assisted entity mapping only after clicking `Map Entities to Panels`.

### Generation

- User can generate image, first/last frames, video, and voiceover through explicit buttons.
- Jobs run asynchronously.
- Jobs preserve prompt, provider, model, request summary, response summary, errors, logs, timing, cost estimate if available, and token usage if available.
- Failed jobs can be retried manually.

### Assets

- Generated assets are preserved in history.
- User can select one image, one video, and one audio asset per panel.
- Only selected assets enter export.
- Asset traceability to GenerationJob and PromptCompilation is available.

### Prompt and Debug

- Prompt compilation uses layered prompt data.
- User can inspect final compiled prompt.
- Debug mode shows contributing layers, references, provider/model, payloads, logs, cost estimates, token estimates, duration, and errors.
- Payloads display with secrets redacted.

### Stale State

- Editing upstream dependencies marks affected prompts/assets stale.
- Stale warnings explain the source change and affected outputs.
- Stale warnings do not trigger regeneration.
- User can regenerate manually or mark reviewed.

### Export

- User can create ordered ZIP package.
- ZIP contains ordered panel folders.
- Panel folders contain selected video/audio/image/frames when available and metadata JSON.
- Export includes timeline_manifest.json.
- Export can optionally include timeline_manifest.csv.
- Manifest includes project title, export timestamp, aspect ratio, panel order, selected asset paths, narration, durations, notes, and stale warnings.

## 24. Open Questions

### Product Scope

- What is the exact MVP definition for first release: single-user internal tool or small-team collaboration?
- Should project creation require templates or start from a blank project only?
- Should users be able to export partially incomplete projects?
- Which missing selected assets should block export, if any?

### Providers

- Which exact OpenAI text model should be default?
- Which GPT Image API configuration should be used?
- What exact xAI Grok Imagine API capabilities are available for reference images, first/last frames, duration, and lip-sync style behavior?
- Which Google TTS product and voices should be used?
- Are provider accounts, quotas, and rate limits already available?

### Files and Storage

- What object storage provider should be used?
- What maximum upload size is required for reference videos?
- Should source reference videos be transcoded for preview?
- How long should export ZIPs be retained?

### UI and Workflow

- Should the primary panel workspace default to board, table, or split-detail view?
- Should scene grouping be mandatory or optional?
- Should scoped chat appear in a right rail or modal?
- What level of prompt editing should be shown in normal mode?

### Data and Operations

- Is PostgreSQL the preferred database?
- What queue system should be used?
- What hosting environment is preferred?
- What internal auth mechanism should be used?
- Who can access debug mode?

### Export

- What exact naming convention should ordered folders use?
- Should CSV be generated by default?
- Should manifests include full provider payload summaries or only job IDs?
- Should original source material be included in export packages?

