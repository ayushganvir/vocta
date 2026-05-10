# Todo Generation Framework

This document explains how to turn questionnaire answers into implementation todos. It is intended for later Codex sessions, product planning, and sprint breakdown.

## 1. Input Documents

Use these documents together:

- Product source of truth: `docs/product/ai_native_creative_workspace_prd.md`
- Discovery input: `docs/planning/discovery_questionnaire.md`
- Working backlog: `docs/planning/todos.md`

## 2. Answer Classification

Every questionnaire answer should be classified as one of:

- `Decision`: create or update todos immediately.
- `Assumption`: create todos but tag with `assumption`.
- `Open`: create discovery todo only.
- `Deferred`: add to future roadmap only, not MVP.

## 3. Todo Shape

Use this format for todos:

```text
- [ ] [Priority] [Workstream] Task title
  - Source: Question IDs or PRD section
  - Why: reason this exists
  - Acceptance:
    - observable result 1
    - observable result 2
  - Dependencies: task IDs or decisions
  - Notes: implementation constraints or risks
```

Priority scale:

- `P0`: required for MVP end-to-end workflow.
- `P1`: required for reliable internal use.
- `P2`: useful for workflow speed or polish.
- `P3`: future or optional.

Workstreams:

- Product
- UX
- Frontend
- Backend
- Database
- Queue
- Storage
- Providers
- Prompting
- Assets
- Export
- Debug
- Testing
- DevOps
- Security

## 4. Decision-to-Todo Mapping

### Product Scope Answers

If answers define MVP boundary:

- Update PRD goals/non-goals.
- Create P0 end-to-end workflow todos.
- Create acceptance criteria todos.

Example:

```text
Decision: incomplete projects are exportable with warnings.
Todos:
- Add export validation warnings.
- Include missing asset warnings in manifest.
- Add UI confirmation before exporting incomplete project.
```

### User/Role Answers

If answers define users or permissions:

- Create auth and user model todos.
- Create debug access todos if restricted.
- Create audit metadata todos if required.

### Source Material Answers

If answers define accepted inputs:

- Create upload validation todos.
- Create source material CRUD todos.
- Create file preview/transcoding todos if required.
- Create story analysis prompt and job todos.

### Narrative/Panel Answers

If answers define panel behavior:

- Create panel CRUD todos.
- Create reorder/split/merge logic todos.
- Create stale behavior todos for panel operations.
- Create UI interaction todos.

### Style Bible Answers

If answers define Style Bible fields:

- Create schema migration todos.
- Create edit UI todos.
- Create prompt-layer integration todos.
- Create stale dependency todos.

### Entity Answers

If answers define entity rules:

- Create entity CRUD todos.
- Create reference selection todos.
- Create entity extraction todos.
- Create entity mapping todos.
- Create prompt propagation todos.

### Prompt Answers

If answers define prompt layer behavior:

- Create prompt layer schema todos.
- Create prompt compiler todos.
- Create prompt inspector todos.
- Create raw override todos.
- Create prompt snapshot tests.

### Generation Answers

If answers define provider behavior:

- Create provider adapter todos.
- Create job lifecycle todos.
- Create asset ingestion todos.
- Create queue workers.
- Create provider capability matrix.

### Queue Answers

If answers define queue and concurrency:

- Create queue setup todos.
- Create concurrency config todos.
- Create job cancellation/retry todos.
- Create worker deployment todos.

### Chat Answers

If answers define scoped chat:

- Create chat schema todos.
- Create scoped context builder todos.
- Create suggested patch apply flow.
- Create UI right rail todos.

### Debug Answers

If answers define debug mode:

- Create debug toggle.
- Create payload redaction.
- Create request/response inspection UI.
- Create job log persistence.
- Create debug access tests.

### Stale State Answers

If answers define dependency rules:

- Create stale rule table or JSON strategy.
- Create stale event emission after edits.
- Create stale warning UI.
- Create export manifest stale warnings.
- Create tests for each stale trigger.

### Export Answers

If answers define export behavior:

- Create export job.
- Create ZIP folder naming.
- Create metadata.json schema.
- Create timeline_manifest.json schema.
- Create CSV manifest.
- Create export readiness UI.
- Create export ZIP integration tests.

### Technical Architecture Answers

If answers define stack:

- Create app scaffold todos.
- Create database setup todos.
- Create object storage setup todos.
- Create queue setup todos.
- Create deployment todos.
- Create local dev docs.

### Provider Adapter Answers

If answers define provider APIs:

- Create adapter interface.
- Create fake provider for local tests.
- Create provider-specific adapters.
- Create capability validation.
- Create provider error normalization.

### Security Answers

If answers define sensitive content:

- Create signed URL todos.
- Create secret handling todos.
- Create log redaction todos.
- Create retention policy todos.
- Create access control todos.

### Testing Answers

If answers define test expectations:

- Create test plan.
- Create provider mock tests.
- Create prompt compiler tests.
- Create manifest schema tests.
- Create Playwright UI tests.

## 5. MVP Epic Template

Use this structure when converting answers into epics.

```text
Epic:
Goal:
PRD sections:
Question IDs:
User stories:
P0 tasks:
P1 tasks:
Acceptance criteria:
Risks:
Deferred items:
```

## 6. Suggested MVP Epic Order

1. Project foundation and internal auth
2. Source Material and uploads
3. Style Bible and entities
4. Scenes and panels
5. Prompt layers and prompt compiler
6. Generation jobs and queue
7. Provider adapter MVPs
8. Asset history and selection
9. Scoped chat and suggested apply flow
10. Debug inspector
11. Stale dependency behavior
12. Export package and manifests
13. Testing, seed data, and demo project
14. Deployment and operations

## 7. Definition of Ready for Implementation

A todo is ready when:

- It has a clear source decision or PRD requirement.
- It names the affected objects/screens/services.
- It has concrete acceptance criteria.
- Dependencies are known.
- Provider behavior is confirmed or mockable.
- It is small enough to complete in one focused implementation session.

## 8. Definition of Done

A todo is done when:

- Code or documentation has been updated.
- Acceptance criteria pass.
- Relevant tests are added or consciously skipped with reason.
- The PRD is updated if product behavior changed.
- The todo is checked off with completion notes.

