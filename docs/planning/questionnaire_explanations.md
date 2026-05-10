# Questionnaire Explanations and Recommended Defaults

This document explains the questionnaire items marked `EXPLAIN`, `didn't understand`, or left ambiguous. It also records a recommended MVP default so todos can move forward without blocking.

## 1. Stale Warnings

What it means:

Stale warnings are automatic status labels that say, "this generated thing may no longer match the latest inputs."

Example:

```text
You generate voiceover for Panel 4.
Later you edit Panel 4 narration.
The old voiceover still exists, but it is now stale because it was generated from older narration.
```

Why this is safe:

- A stale warning does not generate anything.
- It does not replace assets.
- It does not edit prompts.
- It only alerts the user that something may need review.

Recommended MVP default:

- Allow automatic stale warnings.
- Never allow automatic regeneration.

## 2. Batch Generation

What it means:

Batch generation means selecting multiple panels and running the same action across them from one click.

Example:

```text
Select panels 1-10.
Click Generate Voiceover.
The app queues one audio generation job per selected panel.
```

This does not mean replacing final assets silently. In your preferred MVP, each generation creates one candidate and that candidate can become selected while the previous asset remains in history.

Recommended MVP default:

- Start with single-panel generation.
- Add batch generation later only if needed.
- If batch exists, require explicit selected panels plus explicit click.

## 3. Link Handling

Options explained:

- Store link only: the app saves the URL but does not read it.
- Fetch after click: user clicks a button, then the app retrieves page content or metadata.
- Summarize after click: user clicks a button, the app fetches the content and asks AI to summarize it.

Example:

```text
A YouTube or article link is added as source material.
Store-only keeps the URL as reference.
Summarize-after-click turns it into usable story context.
```

Recommended MVP default:

- Store links only or defer links entirely.
- Do not fetch or summarize links silently.

## 4. Entity Extraction

What it means:

Entity extraction asks AI to read the project material and suggest reusable creative objects.

Examples:

- Character: Aarav
- Place: Flooded Temple
- Object: Ancient Lantern
- Speaker/narrator: Narrator Voice

Useful output fields:

- draft entity name
- type
- visual prompt block
- source rationale
- duplicate warning

Recommended MVP default:

- Extract from script/source material first.
- Show draft list.
- Include duplicate detection, type suggestion, and visual prompt suggestion.
- User applies entities manually.

## 5. Entity Mapping to Panels

What it means:

Entity mapping decides which entities are present in each panel.

Example:

```text
Panel: Aarav enters the flooded temple.
Mapped entities:
- Aarav
- Flooded Temple
- Ancient Lantern
```

Why it matters:

Mapped entities inject their visual prompts and reference images into generation prompts, helping consistency.

Recommended MVP default:

- Map selected panels or all panels.
- Merge suggestions with existing mappings only after user approves.
- Show missing reference warnings.
- Never auto-apply mappings.

## 6. Sync Metadata

What it means:

Sync metadata is not lip-sync automation. It is helpful information exported for the human editor.

Examples:

- narration text
- speaking pace: slow/normal/fast
- emotion: suspenseful, calm, angry
- target duration if available
- generated audio duration
- generated video duration
- notes for editor

Why it matters:

Editors can use this information in Filmora/Premiere when aligning audio and video manually.

Recommended MVP default:

- Include narration, pace, emotion, audio duration, video duration, and editor notes when available.
- Do not attempt frame-perfect lip sync.

## 7. Concurrency

What it means:

Concurrency is how many jobs of each type the system can run at the same time.

Example:

```text
prompt concurrency 10 = up to 10 text/prompt jobs at once
image concurrency 5 = up to 5 image jobs at once
video concurrency 2 = up to 2 video jobs at once
audio concurrency 3 = up to 3 voice jobs at once
```

Why video is lower:

Video jobs are usually slower, more expensive, and more rate-limited.

Recommended MVP default:

- Use environment-configurable values.
- Start with prompt 10, image 5, video 2, audio 3.
- Lower values if provider limits require it.

## 8. Queue Behavior

Options explained:

- Polling updates: browser asks server every few seconds for job status. Easiest MVP.
- SSE updates: server streams job updates to browser. Cleaner than polling, moderate complexity.
- WebSockets: two-way real-time connection. Most complex, useful for heavy real-time collaboration.
- Manual retry only: failed jobs stay failed until user clicks Retry.
- Auto-retry technical failures: system retries network/timeouts automatically. This can be useful later, but it is less transparent.
- Cancel queued jobs: user can cancel jobs before they start.
- Cancel running jobs if supported: user can ask provider to stop a running job if provider API supports cancellation.

Recommended MVP default:

- Polling updates.
- Manual retry only.
- Cancel queued jobs.
- Running cancellation only if provider supports it easily.

## 9. Chat Apply Behavior

What it means:

Chat can suggest edits, but it should not directly change panels/entities/style.

Apply options:

- Apply whole card: user accepts the entire suggestion at once.
- Apply field by field: user accepts only specific parts.

Example:

```text
AI suggests:
- New narration
- New visual intent
- New prompt note

User applies only the narration.
```

Recommended MVP default:

- Field-by-field apply where possible.
- Whole-card apply can be offered for simple suggestions.

## 10. Local Development

Terms explained:

- Docker: runs dependencies like Redis/database in containers. Useful, not mandatory if you prefer local terminals.
- Fake providers: local adapter that pretends to generate assets without spending API calls.
- Seed data: ready-made demo project inserted locally for testing.
- Real-provider staging: separate environment where real API keys are used safely.
- Env files: `.env` files store local configuration/API keys.
- Different terminal tabs: one terminal for frontend, one for backend, one for worker, one for Redis/database.

Recommended MVP default:

- Support env-based local development with separate terminals.
- Add fake providers for automated tests and cheap demos.
- Docker optional.

## 11. Provider Tests

What "provider tests" means:

Automated tests should not spend money or depend on external APIs. They should use fake providers.

Real providers should be tested manually or in staging with API keys.

Recommended MVP default:

- Unit/integration tests use fake providers.
- Manual staging tests use real API keys.
- Provider adapter contract tests verify that fake and real adapters follow the same interface.

## 12. Payload Storage and Redaction

What it means:

Generation jobs should store enough request/response information to debug failures, but secrets must not leak.

Do not display:

- API keys
- auth headers
- signed URL secrets
- sensitive user data

Recommended MVP default:

- Store redacted request payload.
- Store response summary.
- Store full raw response only if safe and explicitly needed.

## 13. Debug UI Location

Options:

- Right sidebar: always nearby, good for prompt inspector.
- Panel detail tab: good for deeper per-panel debug.
- Job drawer: best for generation job payloads and failures.
- Separate screen: useful later for global job/debug dashboard.

Recommended MVP default:

- Prompt inspector in right sidebar.
- Full debug details in panel detail tab or job drawer.

## 14. Model-Specific Formatting Layer

What it means:

Different providers need different request formats. The model-specific formatting layer turns your clean project/panel prompt into provider-specific instructions.

Example:

```text
General prompt: cinematic flooded temple shot.
Provider formatting: 9:16 vertical, duration 6 sec, motion prompt field, reference image IDs.
```

Recommended MVP default:

- Keep this layer internal and visible in debug.
- Do not make it a normal editable field at first.

## 15. Export Manifest Fields

Why more fields are recommended:

The editor needs more than title and timestamp to assemble the timeline correctly.

Recommended MVP manifest fields:

- project title
- export timestamp
- aspect ratio
- scene order
- panel order
- panel title
- selected asset paths
- narration
- audio/video duration when known
- pace/emotion
- editor notes
- stale warnings
- entity mappings
- provider/model metadata
- generation job IDs

Recommended MVP default:

- Include the full recommended manifest in JSON.
- Keep CSV simpler for spreadsheet/editor handoff.

    

