# Development Setup

Vocta MVP uses a TypeScript-first foundation:

- Next.js app and REST route handlers
- Prisma ORM
- SQLite for local prototype data
- BullMQ + Redis for async jobs
- Local storage abstraction first, Cloudflare R2 later
- Fake providers before real provider integrations

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

Wave 7 jobs visibility and queue-backed execution is integrated:

1. Project, source material, Style Bible, entities, scenes, panels, and prompt compilation are backed by Prisma APIs.
2. AI drafting exists for story analysis, entity extraction/mapping, Style Bible drafts, and panel prompt enhancement; drafts require explicit apply/save actions.
3. Panel detail queues manual fake-provider image, first-frame, last-frame, video, and audio generation.
4. The worker executes queued media jobs, stores generated assets through the local storage driver, preserves panel history, and updates selected outputs.
5. Panel debug inspector exposes recent generation jobs, compiled prompts, request payloads, response summaries, logs, errors, provider/model, and timing.
6. `/jobs` exposes database-backed job list/detail, polling, manual retry, and manual cancel.
7. Export readiness queues ordered package generation; the worker creates a downloadable ZIP with panel folders, selected assets, metadata JSON files, `timeline_manifest.json`, and `timeline_manifest.csv`.
8. Source material, Style Bible, entity, panel field, reference, mapping, and panel-order changes mark dependent panels stale without triggering generation. Users can manually mark a panel reviewed.

Real provider adapters are still planned work.
