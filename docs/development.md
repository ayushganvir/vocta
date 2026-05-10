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

Run a Redis server in a separate terminal before starting workers.

Run workers:

```bash
npm run worker
```

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

Wave 4 core generation is integrated:

1. Project, source material, Style Bible, entities, scenes, panels, and prompt compilation are backed by Prisma APIs.
2. AI drafting exists for story analysis, entity extraction/mapping, Style Bible drafts, and panel prompt enhancement; drafts require explicit apply/save actions.
3. Panel detail supports manual fake-provider image, first-frame, last-frame, video, and audio generation.
4. Generated assets are stored through the local storage driver, preserved in panel history, and selected manually or by the explicit generation action.
5. Panel debug inspector exposes recent generation jobs, compiled prompts, request payloads, response summaries, logs, errors, provider/model, and timing.

Real provider adapters, export ZIP/manifest generation, stale-state propagation, and queue-backed asynchronous execution are still planned work.
