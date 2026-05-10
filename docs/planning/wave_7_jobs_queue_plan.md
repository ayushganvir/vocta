# Wave 7 Jobs and Queue Execution Plan

Status: ready for parallel implementation.

This wave turns generation and export actions into first-class queued operations while preserving the product rule that every creative action starts from an explicit user click.

## Goal

Build the MVP job execution layer:

- generation routes enqueue work instead of running provider calls synchronously
- the worker executes queued image, video, audio, and export work
- job history is visible from the app
- failed jobs can be inspected and manually retried
- queued/running jobs can be manually cancelled where practical
- export packages remain traceable through `ExportPackage`
- tests prove that stale warnings do not trigger generation

## Product Rules

1. No hidden creative generation.
2. No automatic retries. A retry creates a new queued job only after user action.
3. Prisma remains the product source of truth.
4. BullMQ is execution infrastructure, not the canonical creative record.
5. Every provider call must be traceable to a stored request payload, compiled prompt, and saved job record.
6. Export is traceable through `ExportPackage`; do not force export into `GenerationJob` for this wave.
7. Fake providers remain the default local/test provider path.

## Execution Shape

### Track 7A: Jobs Visibility API and UI

Can run in parallel with Track 7B.

Ownership:

- `src/app/jobs/page.tsx`
- `src/features/jobs/**`
- `src/app/api/jobs/**`
- `src/server/jobs/query.ts`
- jobs UI additions in `src/styles/workspace.css`
- `src/app/api/jobs/jobs-api.test.ts`

Do not modify:

- generation service execution internals
- export service execution internals
- BullMQ worker implementation
- provider adapters

Tasks:

- Add `GET /api/jobs` with filters for project, status, type, panel, limit, and cursor.
- Add `GET /api/jobs/[jobId]`.
- Add `POST /api/jobs/[jobId]/retry`.
- Add `POST /api/jobs/[jobId]/cancel`.
- Replace the mock jobs screen with a real polling jobs workspace.
- Show status, type, provider/model, panel target, retry relationship, output count, error summary, and timestamps.
- Show a detail drawer/panel with compiled prompt, input layers, references, request payload, response summary, logs, errors, assets, and retry/cancel buttons.
- Use existing workspace visual style.

Acceptance:

- Jobs page loads from the database.
- Filters work for status/type/project where data exists.
- Job detail shows the debug fields already stored on `GenerationJob`.
- Retry/cancel actions require a click.
- Tests cover list, detail, retry, and cancel behavior.

## Track 7B: Queue-Backed Generation and Export Execution

Can run in parallel with Track 7A.

Ownership:

- `src/server/jobs/service.ts`
- `src/server/jobs/queues.ts`
- `src/server/jobs/worker.ts`
- `src/server/jobs/types.ts`
- `src/server/generation/service.ts`
- `src/server/export/service.ts`
- `src/app/api/generation/image/route.ts`
- `src/app/api/generation/video/route.ts`
- `src/app/api/generation/audio/route.ts`
- `src/app/api/export-package/route.ts`
- service tests under `src/server/jobs/**`
- generation/export service tests as needed

Do not modify:

- `/jobs` page UI
- `/api/jobs` routes except shared payload types if absolutely necessary

Tasks:

- Split generation into enqueue and execute paths.
- Keep a synchronous executor function available for tests and worker execution.
- `requestPanelImage`, `requestPanelVideo`, and `requestPanelAudio` should:
  - compile prompts
  - create `GenerationJob` with status `QUEUED`
  - store `PromptCompilation`
  - save request payload
  - enqueue BullMQ with DB job id as the stable job id
  - return the queued job and refreshed panel data
- Worker should:
  - load payload
  - mark DB job `RUNNING`
  - execute fake provider
  - persist output assets
  - update selected asset pointers
  - mark DB job `COMPLETED` or `FAILED`
  - preserve logs, request payload, response summary, token/cost estimates when available
- Export route should create an `ExportPackage` record and enqueue an export job.
- Worker should execute export package creation and update the `ExportPackage` status/path.
- BullMQ attempts should stay at one unless explicitly changed later.
- Enqueue failure should mark the DB record failed or cancelled with a useful error.

Acceptance:

- Generation POST routes return a queued response instead of blocking on fake provider execution.
- Worker can complete image/video/audio jobs and selected assets update correctly.
- Export POST returns a queued package record and worker completes the package.
- Failed execution stores request, model/provider, prompt, references, and error.
- Manual retry can create a new queued job from a failed job.
- Tests cover queue enqueue, worker success, worker failure, and export execution.

## Track 7C: Integration, Tests, and Documentation

Run locally after Tracks 7A and 7B return, unless a third agent is needed for docs-only work.

Ownership:

- `docs/planning/todos.md`
- `docs/development.md`
- `docs/product/ai_native_creative_workspace_prd.md`
- integration tests and browser smoke notes

Tasks:

- Update Phase 8 todos to reflect queue-backed generation status.
- Document commands for app, Redis, worker, and test execution.
- Document the manual retry/cancel semantics.
- Add or update tests proving stale state marks warnings only and does not enqueue jobs.
- Run full gate:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - browser smoke for `/jobs`, generation enqueue, worker completion, retry/cancel, export enqueue

Acceptance:

- Documentation matches the implementation.
- Tests pass locally.
- Browser smoke confirms the user-facing workflow.
- Changes are committed and pushed after the gate passes.

## Recommended Agent Prompts

### Worker 7A Prompt

You are Worker 7A for the Vocta Wave 7 jobs visibility track. Own only the jobs API and jobs UI surface.

Write scope:

- `src/app/jobs/page.tsx`
- `src/features/jobs/**`
- `src/app/api/jobs/**`
- `src/server/jobs/query.ts`
- jobs UI additions in `src/styles/workspace.css`
- `src/app/api/jobs/jobs-api.test.ts`

Do not edit generation execution services, export execution services, BullMQ worker code, or provider adapters.

Implement database-backed jobs list/detail APIs, manual retry/cancel API routes, and replace the mock jobs page with a compact polling workspace. Show job status, type, provider/model, panel target, retry relationship, output count, error summary, timestamps, and debug detail fields such as compiled prompt, input layers, request payload, response summary, logs, error payload, attached references, and output assets.

Rules:

- AI/job actions must require explicit user clicks.
- Retry creates a new queued job from a failed/cancelled job; do not mutate the old job into queued.
- Cancel should only apply to queued/running jobs.
- Preserve existing workspace style and test patterns.
- Do not revert unrelated user or agent changes.

Finish by listing files changed, behavior added, tests run, and any integration assumptions.

### Worker 7B Prompt

You are Worker 7B for the Vocta Wave 7 queue-backed execution track. Own queue/generation/export execution only.

Write scope:

- `src/server/jobs/service.ts`
- `src/server/jobs/queues.ts`
- `src/server/jobs/worker.ts`
- `src/server/jobs/types.ts`
- `src/server/generation/service.ts`
- `src/server/export/service.ts`
- `src/app/api/generation/image/route.ts`
- `src/app/api/generation/video/route.ts`
- `src/app/api/generation/audio/route.ts`
- `src/app/api/export-package/route.ts`
- service tests under `src/server/jobs/**`
- generation/export service tests as needed

Do not edit `/jobs` UI or `/api/jobs` routes except shared payload types if absolutely necessary.

Split image/video/audio generation into request/enqueue and execute paths. Request functions should compile prompts, create `GenerationJob` records with queued status, store prompt compilations, save request payloads, enqueue BullMQ using the database job id as the stable queue id, and return queued job plus refreshed panel data. Worker execution should mark jobs running, call fake providers, persist generated assets, update selected asset pointers, and mark completed/failed with logs and error payloads.

Move export packaging behind the queue by creating an `ExportPackage` record first, enqueueing a job, and letting the worker create the ZIP and update package status/path. Keep `ExportPackage` as the export source of truth in this wave.

Rules:

- No automatic retries.
- No creative provider call without an explicit route/action creating a queued job.
- Prisma is the canonical job/package state.
- Preserve traceability: request payload, compiled prompt, references, logs, provider, model, errors.
- Do not revert unrelated user or agent changes.

Finish by listing files changed, behavior added, tests run, and any integration assumptions.

## Integration Sequence

1. Merge Worker 7B first if it changes shared queue types.
2. Merge Worker 7A next and adapt retry/cancel APIs to the final queue service names.
3. Run unit tests for jobs, generation, and export.
4. Run full project gate.
5. Start local app, Redis, and worker.
6. Browser smoke the manual workflow:
   - open `/jobs`
   - trigger image generation from a panel
   - confirm the job appears as queued/running/completed
   - confirm the selected asset updates only after worker completion
   - create or inspect a failed job and retry manually
   - export ordered package and confirm package completion
7. Commit and push Wave 7 as one integration commit unless the implementation naturally splits into two passing commits.
