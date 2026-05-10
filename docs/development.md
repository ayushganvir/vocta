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

Wave 1 foundation is integrated. Product behavior remains scaffolded:

1. Prisma data model, repository helpers, and a seeded demo project.
2. App shell and placeholder workspace screens.
3. BullMQ queue contracts, worker shell, fake providers, and local storage.
