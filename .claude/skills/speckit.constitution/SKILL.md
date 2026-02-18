---
name: speckit.constitution
description: "View, validate, or amend the project constitution. Usage: /speckit.constitution [action]. Actions: view (show current principles), check (validate codebase compliance), amend (propose a change). The constitution defines mandatory guardrails for the project."
user_invocable: true
---

# /speckit.constitution - Project Constitution Management

You are managing the project constitution that defines mandatory guardrails.

## Constitution Location

`.specify/memory/constitution.md`

## Actions

Parse `$ARGUMENTS` to determine the action:

### Action: `view` (default if no argument)

Read and display the constitution with a formatted summary:

1. Read `.specify/memory/constitution.md`
2. Present each principle with its rationale
3. Show current version and last amendment date
4. List the stack constraints and delivery workflow

### Action: `check`

Validate the current codebase against the constitution principles:

1. Read `.specify/memory/constitution.md`
2. For each principle, perform targeted checks:

**I. Workspace Isolation by Default**
- Grep for tables/queries missing `workspace_id` filter
- Check RLS policies exist for business tables
- Verify membership-based authorization

**II. Single Auth Source (Supabase Auth)**
- Check there's no parallel auth system
- Verify auth flows use Supabase Auth only

**III. Type and Schema Consistency**
- Check migrations exist in `supabase/migrations/`
- Verify `supabase_ddl.sql` or schema snapshot exists
- Look for ad-hoc type definitions that should use canonical DB types

**IV. UX and Visual Identity Consistency**
- Check CSS for hardcoded colors not from design tokens
- Verify loading/empty/error states in components
- Check responsive breakpoints usage

**V. Feature Modularity and URL-Driven Navigation**
- Verify features are organized by `src/features/*`
- Check routes are URL-based (TanStack Router)
- Look for monolithic components that should be split

**VI. Spec-First Delivery**
- Check that recent changes have corresponding spec updates
- Verify lessons learned file exists and is maintained

**VII. Operational Safety and Observability**
- Check error handling in mutations
- Verify idempotency in critical operations
- Look for missing user feedback on errors

3. Present results as a compliance report:

```
## Constitution Compliance Report

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Workspace Isolation | PASS/WARN/FAIL | details |
| II. Single Auth Source | PASS/WARN/FAIL | details |
| ... | ... | ... |

Overall: X/7 passing, Y warnings, Z failures
```

### Action: `amend`

Propose a change to the constitution:

1. Read current constitution
2. Ask the user what they want to change:
   - Add a new principle
   - Modify an existing principle
   - Remove a principle
   - Update stack constraints
   - Update delivery workflow
3. Draft the amendment with:
   - Rationale for the change
   - Expected impact on existing code and specs
   - Version bump (MAJOR for removal/redefinition, MINOR for addition, PATCH for clarification)
4. Present the diff for user approval
5. On approval, update the constitution with:
   - New content
   - Updated version number
   - Updated "Last Amended" date
6. Identify dependent docs (`speckit/*`) that may need review

## Constitution Quality Rules

1. **Principles must have rationale** - No rule without a "why"
2. **Principles must be enforceable** - If it can't be checked, it's a guideline, not a principle
3. **Amendments require approval** - Never modify without explicit user consent
4. **Version semantics matter** - Follow semver for constitutional changes
5. **Cascading review** - After amendment, list affected specs for review
