---
name: speckit.tasks
description: "Generate a task list for the current feature. Usage: /speckit.tasks. Reads the spec and plan, then produces a detailed task list organized by user story with dependencies, parallel opportunities, and execution order."
user_invocable: true
---

# /speckit.tasks - Generate Task List

You are generating a task list for an existing feature that already has a spec and implementation plan.

## Step 1: Locate Feature Context

Run the prerequisites check requiring plan.md:

```bash
bash .specify/scripts/bash/check-prerequisites.sh --json --include-tasks
```

This validates that `spec.md` and `plan.md` exist. Abort with a clear message if either is missing:
- Missing spec: "Run `/speckit.specify` first"
- Missing plan: "Run `/speckit.plan` first"

## Step 2: Read Required Documents

Read ALL available documents for the feature:

1. `specs/YYYYMMDD-feature/spec.md` - user stories and requirements (REQUIRED)
2. `specs/YYYYMMDD-feature/plan.md` - implementation approach (REQUIRED)
3. `specs/YYYYMMDD-feature/research.md` - technical research (if exists)
4. `specs/YYYYMMDD-feature/data-model.md` - database changes (if exists)
5. `.specify/memory/constitution.md` - project principles

## Step 3: Generate Task List

Write `specs/YYYYMMDD-feature/tasks.md` following the tasks template structure.

### Task Organization Rules

1. **Group by user story** - Each user story from the spec gets its own phase
2. **Foundational tasks first** - Shared infrastructure that blocks all stories goes in Phase 2
3. **Setup phase** - Project scaffolding and dependencies in Phase 1
4. **Polish phase** - Cross-cutting concerns at the end
5. **MVP first** - P1 user story should be completable independently

### Task Format

```
- [ ] T001 [P] [US1] Description with exact file path
```

- `T001` - Sequential ID
- `[P]` - Can run in parallel (different files, no dependencies)
- `[US1]` - Which user story this belongs to
- Description must include the exact file path being modified/created

### Task Quality Rules

- Every requirement (FR-*) from the spec must map to at least one task
- Tasks must be granular: one task = one logical change in one file
- Mark parallel opportunities with `[P]` when tasks touch different files
- Include exact file paths from the plan (e.g., `src/features/entries/ImportModal.tsx`)
- Each phase ends with a **Checkpoint** describing what should be testable
- Do NOT include test tasks unless explicitly requested in the spec
- Tasks should follow the implementation order from the plan

### Dependencies Section

After all phases, include:
- **Phase Dependencies** - Which phases block which
- **User Story Dependencies** - Cross-story dependencies (minimize these)
- **Parallel Opportunities** - Groups of tasks that can run simultaneously

## Step 4: Output Summary

Show the user:
- Total task count
- Tasks per user story
- Number of parallel opportunities
- Suggested execution order
- Estimated phases count
