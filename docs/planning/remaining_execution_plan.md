# Remaining Execution Plan

Status: current forward plan after the fake-provider MVP, queued jobs, export, stale-state workflow, provider routing, and configuration matrix work already recorded in `todos.md` and `docs/development.md`.

This plan covers remaining work only. It should not be used to add new product scope.

## Operating Rules

1. Fake providers remain the default for local development and automated tests.
2. Live provider calls require explicit user action, `PROVIDER_MODE=real`, and the needed provider credentials.
3. No hidden live API calls are allowed in app boot, page load, capability display, health display, or automated tests.
4. AI suggestions never mutate creative project state automatically.
5. Generation, retry, export, prompt enhancement apply, and chat suggestion apply all require explicit clicks.
6. Unsupported provider capabilities are shown as warnings or failed checks, not silently hidden or silently substituted.
7. Redaction is required before request payloads, response summaries, errors, or logs are shown in the UI.

## Current Baseline Gate

Run once before assigning the remaining waves.

Owner: single integration agent.

Checks:

- `npm run typecheck`
- `npm test`
- `npm run build`
- Local fake-provider browser smoke:
  - create or open the demo project
  - queue image, first-frame, last-frame, video, and audio generation from explicit panel actions
  - confirm `/jobs` shows queued/running/completed states
  - confirm export queues and completes
  - confirm stale warnings do not enqueue jobs
  - confirm `/configuration` does not make live calls

Acceptance:

- The remaining work starts from a passing fake-provider baseline.
- Any pre-existing failures are documented before parallel agents begin.

## Wave R1: Provider Safety, Health Checks, and Cheap Live Harness

Can run with multiple agents, followed by a single integration gate.

### Agent R1A: Provider Health and Capability Checks

Ownership:

- provider registry health/capability services
- provider capability matrix data
- provider safety tests

Tasks:

- Add provider health checks that distinguish configured, missing credentials, reachable, unsupported, and unverified states.
- Keep health/capability reads side-effect free by default.
- Add explicit cheap live check actions for configured real providers.
- Ensure live checks never run during app boot, page load, normal tests, or fake mode.
- Verify the capability matrix against adapter behavior for text, image, video, and TTS.

Acceptance:

- `/configuration` can show provider health without spending API calls.
- Cheap live checks require an explicit click and real mode credentials.
- Missing credentials fail clearly and do not fall back to fake providers in real mode.
- Capability warnings are visible for unsupported or unverified controls.

### Agent R1B: Cheap Live Test Harness

Ownership:

- manual live test routes/scripts
- live smoke documentation
- redaction assertions around live checks

Tasks:

- Add a minimal manual harness for one low-cost request per provider category.
- Use small text prompts, one image, low image quality where supported, shortest available video/audio settings, and no batch requests.
- Persist live test job/debug records the same way normal jobs do.
- Document required environment variables and exact commands or UI actions.

Acceptance:

- Automated tests run fully with fake providers and no real credentials.
- Manual live checks are repeatable and cheap.
- Live request/response debug data is redacted before display.

### Gate R1: Provider Safety Integration

Owner: single integration agent.

Checks:

- `npm run typecheck`
- `npm test`
- `npm run build`
- Browser smoke `/configuration` in fake mode with no credentials.
- Browser smoke live-check controls in fake mode and verify they do not call real providers.
- Optional manual real-mode dry run with one provider credential set.

Acceptance:

- Provider visibility is safe by default.
- Real checks are deliberate, visible, and traceable.

## Wave R2: Real Asset Handling, Previews, and Reference Warnings

Can run with multiple agents, followed by a single integration gate.

### Agent R2A: Asset Handling and Previews

Ownership:

- upload/generated asset preview handling
- asset metadata display
- selected asset preview surfaces

Tasks:

- Harden image, video, and audio preview behavior for uploaded references and generated assets.
- Show useful metadata for real assets: mime type, file size when known, dimensions or duration when available, storage path, and preview path.
- Ensure missing or broken preview files degrade to a clear UI state.
- Keep selected/unselected asset behavior unchanged: only selected assets export, history remains preserved.

Acceptance:

- Image references show thumbnails.
- Video references are previewable in-browser when supported.
- Audio assets are previewable in-browser when supported.
- Broken preview paths do not break the panel, asset history, jobs, or export screens.

### Agent R2B: Entity and Reference Warnings Before Generation

Ownership:

- generation preflight warnings
- entity/reference warning UI
- tests for warning-only behavior

Tasks:

- Show missing entity visual reference warnings before visual generation.
- Show warnings when mapped entities, selected panel references, or provider controls are likely unsupported.
- Keep warnings explicit and visible at the point of generation.
- Do not silently create references, modify prompts, or trigger generation from warning creation.

Acceptance:

- Users see entity/reference warnings before image/video generation.
- Warnings do not create `GenerationJob` records.
- Users can still proceed when the existing product decision is warning-only.
- Hard blocks are used only where already implemented or explicitly decided.

### Gate R2: Asset and Warning Integration

Owner: single integration agent.

Checks:

- `npm run typecheck`
- `npm test`
- Browser smoke upload/reference previews.
- Browser smoke generated image/video/audio preview cards.
- Browser smoke missing-reference warning before generation.
- Confirm warning display does not enqueue or execute jobs.

Acceptance:

- Real assets are inspectable enough for internal use.
- Pre-generation warnings are clear without becoming autonomous behavior.

## Wave R3: Review/Apply Flows for Prompt Enhancement and Scoped Chat

Can run with multiple agents, followed by a single integration gate.

### Agent R3A: Prompt Enhancement Review and Apply

Ownership:

- prompt enhancement suggestion review UI
- structured suggestion storage/read models
- field-level apply behavior

Tasks:

- Ensure prompt enhancement output is stored as suggestions or drafts.
- Show before/after values where practical.
- Apply suggestions only after explicit user clicks.
- Support field-by-field apply where the data shape allows it.
- Preserve existing prompt compilation and stale-warning behavior.

Acceptance:

- Prompt enhancement never edits panel fields directly on job completion.
- Applying a suggestion updates only the approved fields.
- Applying a suggestion can mark affected prompts/assets stale, but does not regenerate.

### Agent R3B: Scoped Chat Suggestion and Apply Flow

Ownership:

- Project, Entity, Scene, and Panel chat scopes
- structured chat patch suggestions
- chat apply UI

Tasks:

- Persist chat threads/messages by scope.
- Build a scoped context builder that includes only the selected scope's relevant context.
- Return structured patch suggestions rather than direct mutations.
- Allow whole-card and field-level apply where practical.
- Keep configurable suggestion types.

Acceptance:

- Chat does not mutate creative state directly.
- Applying chat suggestions requires explicit user action.
- Chat patches are scoped to the selected project/entity/scene/panel.
- Suggestions that touch generation inputs create stale warnings only after apply.

### Gate R3: Suggestion Integration

Owner: single integration agent.

Checks:

- `npm run typecheck`
- `npm test`
- Browser smoke prompt enhancement suggestion review/apply.
- Browser smoke scoped chat suggestion review/apply.
- Confirm job completion and chat response creation do not mutate creative state.
- Confirm apply actions are auditable and trigger stale warnings without generation.

Acceptance:

- AI can assist editing through reviewable patches only.
- No suggestion path bypasses explicit apply.

## Wave R4: Provider Capability Verification and Final Real Provider Smoke

Requires a single integration agent. Do not split live provider smoke across uncoordinated agents because it uses real credentials, real cost, and shared provider limits.

Prerequisites:

- Gates R1, R2, and R3 have passed in fake mode.
- The provider capability matrix lists unverified, supported, and unsupported controls.
- The user has intentionally provided the real credentials needed for the smoke.

Tasks:

- Run one real OpenAI text/prompt job through the normal job path.
- Run one real OpenAI image job through the normal job path.
- Run one real xAI video job only for capabilities that have been verified as available.
- Run one real Google TTS job only for confirmed voice/output controls.
- Verify request payloads, response summaries, errors, logs, timing, and output assets are stored and redacted.
- Export a mixed package with real generated assets where available.
- Update the capability matrix with confirmed support, warnings, and known gaps.

Checks:

- `npm run typecheck`
- `npm test`
- `npm run build`
- Manual real-mode browser smoke:
  - set `PROVIDER_MODE=real`
  - trigger each live action by explicit click
  - inspect each job in `/jobs`
  - inspect generated assets/previews
  - inspect export ZIP and manifests
  - return local env to fake mode after smoke

Acceptance:

- The same job/provider interfaces work for fake and real providers.
- No live call happens without an explicit click.
- Real provider failures are visible, redacted, and actionable.
- The final export can be produced with selected assets and warnings.

## Parallelization Summary

- Parallel waves: R1, R2, and R3 can each use multiple agents with separated write scopes.
- Single-agent gates: Current Baseline Gate, Gate R1, Gate R2, Gate R3, and Wave R4.
- Live-provider work: only Wave R4 should use real credentials for final smoke, except optional deliberate R1 cheap checks.
- Documentation updates: keep them small and append-only unless replacing stale wave status with this plan link.
