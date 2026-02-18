---
name: speckit.plan
description: "Create an implementation plan for the current feature. Usage: /speckit.plan. Reads the feature spec, analyzes the codebase, and produces a detailed implementation plan with technical context, project structure, and phased approach."
user_invocable: true
---

# /speckit.plan - Create Implementation Plan

You are creating an implementation plan for an existing feature specification.

## Step 1: Locate Feature Context

Run the prerequisites check to find the current feature:

```bash
bash .specify/scripts/bash/check-prerequisites.sh --paths-only --json
```

This returns JSON with `REPO_ROOT`, `BRANCH`, `FEATURE_DIR`, `FEATURE_SPEC`, `IMPL_PLAN`, `TASKS`.

If NOT on a feature branch (YYYYMMDD-*), ask the user which feature to plan. They can set `SPECIFY_FEATURE` env var or switch branches.

## Step 2: Read Required Context

Read these files in order:

1. **Feature spec** (`specs/YYYYMMDD-feature/spec.md`) - the specification to plan for (REQUIRED - abort if missing)
2. `.claude/skills/speckit/references/licoes-aprendidas.md` - lessons learned
3. `.specify/memory/constitution.md` - project principles and stack constraints
4. `speckit/02-architecture-spec.md` - architecture reference
5. `speckit/03-data-model-spec.md` - data model reference
6. `speckit/07-visual-identity-spec.md` - visual identity (if spec has UI changes)

## Step 3: Research the Codebase

Before writing the plan, explore the codebase to understand:

1. **Existing code** affected by the feature (search for relevant files, components, hooks)
2. **Patterns in use** (how similar features are implemented)
3. **Dependencies** (what libraries are available, what needs to be added)
4. **Database schema** (existing migrations in `supabase/migrations/`)

Use Glob, Grep and Read tools to gather this information. Do NOT guess - verify.

## Step 4: Write the Plan

Copy the plan template and fill it in:

```bash
bash .specify/scripts/bash/setup-plan.sh --json
```

Then edit `specs/YYYYMMDD-feature/plan.md` with the actual content.

### Plan Structure (from template)

1. **Summary** - Primary requirement + technical approach
2. **Technical Context** - Language, dependencies, storage, testing, platform, constraints
3. **Constitution Check** - Verify against the 7 principles in constitution.md
4. **Project Structure** - Documentation tree + source code tree with real paths
5. **Complexity Tracking** - Only if constitution violations need justification

### Plan Quality Rules

- Every user story from the spec must map to concrete files and changes
- Identify ALL files that will be created or modified
- Note dependencies between changes (what must be done first)
- Flag risks and propose mitigations
- Do NOT include task lists - those are for `/speckit.tasks`
- Do NOT write code - only describe the approach
- Reference existing patterns in the codebase when proposing new code
- Keep the plan concise - focus on decisions and structure, not prose

## Step 5: Create Research Document (if needed)

If the feature requires significant technical research (new libraries, unfamiliar patterns, external APIs), create `specs/YYYYMMDD-feature/research.md` with findings.

## Step 6: Create Data Model Document (if needed)

If the feature involves database changes, create `specs/YYYYMMDD-feature/data-model.md` with:
- New tables/columns
- Migration strategy
- RLS policies needed
- Index requirements

## Step 7: Output Summary

Show the user:
- Files created/updated
- Constitution check results (pass/fail per principle)
- Key technical decisions made
- Identified risks
- Next step: run `/speckit.tasks` to generate the task list
