---
name: speckit.implement
description: "Execute the implementation of the current feature based on the task list. Usage: /speckit.implement [task_id]. Reads tasks.md and executes tasks sequentially or from a specific task ID, writing actual code following the plan and spec."
user_invocable: true
---

# /speckit.implement - Execute Feature Implementation

You are implementing a feature by executing tasks from the task list.

## Step 1: Locate Feature Context

```bash
bash .specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
```

Abort if missing:
- Missing spec: "Run `/speckit.specify` first"
- Missing plan: "Run `/speckit.plan` first"
- Missing tasks: "Run `/speckit.tasks` first"

## Step 2: Read All Feature Documents

Read in order:

1. `specs/YYYYMMDD-feature/tasks.md` - task list (REQUIRED)
2. `specs/YYYYMMDD-feature/spec.md` - user stories and requirements (REQUIRED)
3. `specs/YYYYMMDD-feature/plan.md` - implementation approach (REQUIRED)
4. `specs/YYYYMMDD-feature/research.md` - technical research (if exists)
5. `specs/YYYYMMDD-feature/data-model.md` - database changes (if exists)
6. `.specify/memory/constitution.md` - project principles
7. `speckit/07-visual-identity-spec.md` - visual tokens (if UI work)

## Step 3: Determine Starting Point

- If `$ARGUMENTS` contains a task ID (e.g., `T005`), start from that task
- If no argument, find the first unchecked task (`- [ ]`) in tasks.md
- If all tasks are checked, inform the user that implementation is complete

## Step 4: Execute Tasks

For each task, follow this cycle:

### 4a. Read Before Writing
- Read ALL files that will be modified before making changes
- Understand existing patterns and conventions in those files
- Verify the task's dependencies are completed (check prior tasks are `[x]`)

### 4b. Implement
- Write the code changes described by the task
- Follow existing patterns in the codebase
- Respect the project constitution principles
- Use design tokens from visual identity spec for UI changes
- Ensure workspace_id scoping and RLS compliance for data changes

### 4c. Mark Complete
- Update `tasks.md`: change `- [ ]` to `- [x]` for the completed task
- If a checkpoint is reached, pause and inform the user

### 4d. Continue or Stop
- If the task is at a phase checkpoint, stop and report status
- If the next task has `[P]` marker and is independent, inform the user it can run in parallel
- Otherwise, continue to the next task

## Implementation Quality Rules

1. **Read before writing** - Never modify a file you haven't read in this session
2. **One task at a time** - Complete and mark each task before starting the next
3. **Follow the plan** - Don't deviate from the implementation approach in plan.md
4. **Match existing patterns** - Look at how similar code is written in the project
5. **Constitution compliance** - Every change must respect the 7 principles
6. **No over-engineering** - Implement exactly what the task describes, nothing more
7. **Build check** - Run `npm run build` after completing each phase
8. **Commit after checkpoint** - Suggest a commit at each phase checkpoint

## Step 5: Progress Report

After each session, show:
- Tasks completed in this session
- Current task (if paused mid-phase)
- Remaining tasks count
- Next checkpoint
- Any blockers or decisions needed
