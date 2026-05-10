# Vocta Documentation Index

This folder is the working source of truth for the internal MVP product definition, discovery questions, and implementation planning.

## Core Documents

- [Development Setup](./development.md)
  - Local commands, stack decisions, and current scaffold scope.

- [Product PRD](./product/ai_native_creative_workspace_prd.md)
  - Full product requirements document for the AI-native creative production workspace MVP.
  - Defines product philosophy, workflow, data model, screens, generation jobs, debug mode, export package, and architecture.

- [Practical MVP Decision Questionnaire](./planning/discovery_questionnaire.md)
  - Checkbox-first questionnaire with short blanks and practical examples.
  - Use this as the input document for stakeholder interviews and internal planning.

- [Todo Generation Framework](./planning/todo_generation_framework.md)
  - Explains how questionnaire answers should be converted into epics, implementation tasks, acceptance checks, and later sprint plans.

- [Initial MVP Todo Backlog](./planning/todos.md)
  - Dependency-ordered implementation todo hierarchy derived from the answered questionnaire.

- [Multi-Agent Build Execution Plan](./planning/agent_execution_plan.md)
  - Wave-based build order for using multiple agents without conflicting ownership.
  - Defines serial gates, parallel workstreams, ownership boundaries, and acceptance checks.

- [Questionnaire Explanations](./planning/questionnaire_explanations.md)
  - Explains the questionnaire items that were marked unclear, including stale warnings, batch generation, queue behavior, concurrency, sync metadata, local development, provider tests, and debug payload redaction.

## Maintenance Rules

1. Product decisions belong in the PRD.
2. Unknowns belong in the questionnaire until answered.
3. Work to be done belongs in the todo backlog.
4. If an implementation decision changes product behavior, update the PRD first.
5. If a questionnaire answer creates work, add or update todos in the backlog.
6. Keep AI behavior explicit: no automatic creative mutation, no hidden regeneration, no silent final-state changes.

## Suggested Workflow

1. Answer the questionnaire with stakeholders.
2. Mark each answer as `Decision`, `Assumption`, `Open`, or `Deferred`.
3. Convert decisions into backlog items using the todo generation framework.
4. Prioritize MVP critical path:
   - Project and source material
   - Style Bible and entities
   - Scenes, panels, and panel operations
   - Prompt layering and compilation
   - Generation jobs and provider adapters
   - Asset history and selected assets
   - Timeline manifest and ZIP export
   - Debug inspector
5. Keep future exporter integrations out of MVP unless explicitly re-scoped.
