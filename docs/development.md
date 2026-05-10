# Development Setup

Vocta MVP uses a TypeScript-first foundation:

- Next.js app and REST route handlers
- Prisma ORM
- SQLite for local prototype data
- BullMQ + Redis for async jobs
- Local storage abstraction first, Cloudflare R2 later
- Fake providers by default, with provider adapter stubs for real integrations

## Local Commands

Install dependencies:

```bash
npm install
```

Copy environment defaults:

```bash
cp .env.example .env
```

Generate Prisma client:

```bash
npm run prisma:generate
```

Create or sync the local SQLite schema:

```bash
npm run prisma:push
```

Seed the demo project:

```bash
npm run prisma:seed
```

Run the web app:

```bash
npm run dev
```

Run a Redis server in a separate terminal before starting workers. A local Homebrew install usually works with:

```bash
redis-server
```

Run workers:

```bash
npm run worker
```

Run the hot-reload worker during development:

```bash
npm run worker:dev
```

Open all always-on local services in one iTerm2 tab:

```bash
npm run dev:iterm
```

This creates one iTerm2 tab with split panes for:

- `Web`: `PORT=3000 npm run dev`, the Next.js app and API routes with hot reload.
- `Worker`: `npm run worker:dev`, the BullMQ worker restarted by `tsx watch` when worker/server code changes.
- `Redis`: `redis-server`, or a hold-open status pane if Redis is already running.
- `Vitest Watch`: `npm run test:watch`, focused feedback while editing.

Optional Prisma Studio can be included with:

```bash
VOCTA_DEV_STUDIO=1 npm run dev:iterm
```

To use a different app port:

```bash
PORT=3008 npm run dev:iterm
```

Queue-backed generation and export now use Prisma as the source of truth and BullMQ/Redis for execution. The normal local workflow is:

1. Start Redis.
2. Start `npm run worker`.
3. Start `npm run dev`.
4. Click a generation or export action in the app.
5. Open `/jobs` to inspect queued/running/completed/failed state, request payloads, compiled prompts, logs, errors, and retry chains.

Manual retries are created from the `/jobs` page or retry API. A retry creates a new queued job and preserves the failed/cancelled source job. BullMQ automatic attempts stay at one in MVP.

Run tests:

```bash
npm test
```

Run typecheck:

```bash
npm run typecheck
```

Run the current lint gate:

```bash
npm run lint
```

At this scaffold stage, `lint` delegates to `typecheck` to keep the command non-interactive. A dedicated ESLint config can be added later.

## Current Scope

Wave 9 provider routing and debug visibility are integrated:

1. Project, source material, Style Bible, entities, scenes, panels, and prompt compilation are backed by Prisma APIs.
2. AI drafting exists for story analysis, entity extraction/mapping, Style Bible drafts, and panel prompt enhancement; drafts require explicit apply/save actions.
3. Panel detail queues manual fake-provider image, first-frame, last-frame, video, and audio generation.
4. The worker executes queued media jobs, stores generated assets through the local storage driver, preserves panel history, and updates selected outputs.
5. Panel debug inspector exposes recent generation jobs, compiled prompts, request payloads, response summaries, logs, errors, provider/model, and timing.
6. `/jobs` exposes database-backed job list/detail, polling, manual retry, and manual cancel.
7. Export readiness queues ordered package generation; the worker creates a downloadable ZIP with panel folders, selected assets, metadata JSON files, `timeline_manifest.json`, and `timeline_manifest.csv`.
8. Source material, Style Bible, entity, panel field, reference, mapping, and panel-order changes mark dependent panels stale without triggering generation. Users can manually mark a panel reviewed.
9. `/configuration` exposes project-level model stack defaults and provider settings JSON.
10. Entity records can store speaker/voice metadata and use explicit Google voice catalog/preview endpoints. Fake mode returns seeded voices and fake preview audio without external calls; real mode can list Google voices and synthesize a capped preview after a user click.
11. Panel video/audio settings persist in `timelineMetadata` and flow into queued generation payloads for debug inspection.
12. Media generation runs through a provider registry. Local/default mode uses fake adapters while preserving configured provider/model metadata; `PROVIDER_MODE=real` routes supported jobs to adapter stubs.
13. Real-mode adapter stubs exist for xAI video and Google TTS. They validate/build requests and fail clearly if required keys are missing.
14. `/jobs` shows resolved media settings above raw payloads for faster inspection.

Real image and text provider adapters are wired for narrow MVP routes.

## Provider Mode

Default local mode is fake:

```bash
PROVIDER_MODE=fake
```

Set real mode only when testing live adapters:

```bash
PROVIDER_MODE=real
XAI_API_KEY=...
GOOGLE_TTS_API_KEY=...
```

Current real-mode support is intentionally narrow:

- `openai` image jobs map to the OpenAI Images adapter.
- `openai` prompt jobs map to the OpenAI Responses adapter.
- `xai` video jobs map to the xAI video adapter.
- `google` audio jobs map to the Google TTS adapter.
- `GET /api/providers/google/voices` maps to seeded fake voices in fake mode and Google `voices:list` in real mode.
- `POST /api/providers/google/voice-preview` returns fake preview audio in fake mode and a capped Google TTS preview in real mode.
- Unsupported real routes fail loudly instead of silently falling back.

Use `/configuration` to see the current provider capability matrix. It shows the active provider mode, which providers have real adapters, which credentials are present, and which controls are not fully verified yet.

Live API smoke tests should be explicit and cheap:

- Keep `PROVIDER_MODE=fake` for normal development and automated tests.
- Use `PROVIDER_MODE=real` only for deliberate live adapter checks.
- The `/configuration` OpenAI text row has a separate `Live text smoke` button. It is the only live provider health check currently enabled.
- OpenAI text smoke uses the Responses API with `max_output_tokens=8`, creates no generation job, and stores no generated asset.
- For OpenAI Images, the adapter requests `n=1`, `quality=low`, and one generated image.
- For OpenAI Responses, the adapter caps prompt compilation at `max_output_tokens=300`.
- For Google voice preview, the endpoint caps sample text at 160 characters and returns inline preview audio instead of creating a generation job.
