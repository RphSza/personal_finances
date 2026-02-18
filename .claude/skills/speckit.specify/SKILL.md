---
name: speckit.specify
description: "Create a new feature specification. Usage: /speckit.specify <feature description>. Creates the feature branch (YYYYMMDD-name), spec directory, and guides writing a complete spec with user stories, acceptance scenarios, requirements and success criteria."
user_invocable: true
---

# /speckit.specify - Create Feature Specification

You are creating a new feature specification for the personal finances project.

## Step 1: Setup Feature Structure

Run the create-new-feature script to set up the branch and spec directory:

```bash
bash .specify/scripts/bash/create-new-feature.sh --json "$ARGUMENTS"
```

The script will:
- Create a git branch named `YYYYMMDD-feature-name`
- Create `specs/YYYYMMDD-feature-name/` directory
- Copy the spec template to `specs/YYYYMMDD-feature-name/spec.md`
- Output JSON with `BRANCH_NAME`, `SPEC_FILE`, `BRANCH_DATE`

If the user provided a `--short-name`, pass it through. If they provided `--date`, pass it through.

## Step 2: Read Required Context

Before writing the spec, read these files:

1. `.claude/skills/speckit/references/licoes-aprendidas.md` - lessons learned (mandatory)
2. `.specify/memory/constitution.md` - project principles
3. `speckit/01-product-spec.md` - product scope (for alignment)
4. `speckit/06-roadmap-backlog.md` - roadmap (for positioning)

## Step 3: Write the Specification

Fill in the spec template at the path returned by the script. Replace ALL placeholders with real content based on the user's feature description and the project context.

### Spec Quality Rules

1. **User stories** must be prioritized (P1, P2, P3) and independently testable
2. **Acceptance scenarios** must use Given/When/Then format
3. **Requirements** must use MUST/SHOULD/MAY language (RFC 2119)
4. **Requirements IDs** must be sequential: FR-001, FR-002, etc.
5. **Success criteria** must be measurable
6. **Edge cases** must cover boundary conditions and error scenarios
7. **Multi-tenant**: Any data feature must address `workspace_id` scoping and RLS
8. **Security**: Flag any auth, permission or data integrity concerns
9. **Visual identity**: Reference tokens from `speckit/07-visual-identity-spec.md` when UI is involved
10. **Feature name** in the branch must be in English

### Spec Structure (mandatory sections)

- Feature metadata (branch, date, status, input)
- User Scenarios & Testing (user stories with acceptance scenarios)
- Edge Cases
- Requirements (Functional Requirements + Key Entities)
- Success Criteria (Measurable Outcomes)

### Optional sections (add when relevant)

- Design e Visual Identity (when UI changes are involved)
- Implementation Order (when there are dependencies between stories)
- Out of Scope (to document explicit exclusions)

## Step 4: Output Summary

After writing the spec, show the user:
- The branch name and spec file path
- A summary table of user stories with priorities
- Total count of requirements and success criteria
- Any items marked as NEEDS CLARIFICATION

## Important Rules

- The spec language should match the project convention: technical terms in English, user-facing descriptions in Portuguese
- Do NOT create implementation plans or task lists - those are separate commands
- Do NOT modify existing speckit/ files - this command creates feature specs in specs/
- If the feature description is too vague, ask the user for clarification before writing
