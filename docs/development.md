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

At this scaffold stage, `lint` delegates to `typecheck` to keep the command non-interactive. A dedicated ESLint config can be added in the UI/app-shell wave.

## Current Scope

This is Wave 0 scaffolding. Product features are intentionally minimal. The next wave should split across:

1. Prisma data model and seed data.
2. App shell and placeholder screens.
3. Jobs, storage, and provider contracts.
