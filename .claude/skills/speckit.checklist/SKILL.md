---
name: speckit.checklist
description: "Generate a checklist for the current feature. Usage: /speckit.checklist [type]. Types: review (code review), release (pre-release), security, accessibility. Produces a actionable checklist based on the feature spec and project standards."
user_invocable: true
---

# /speckit.checklist - Generate Checklist

You are generating a checklist for an existing feature specification.

## Step 1: Determine Checklist Type

Parse the arguments to determine the type. Supported types:

- **review** - Code review checklist (default if no type specified)
- **release** - Pre-release validation checklist
- **security** - Security and data protection checklist
- **accessibility** - Accessibility compliance checklist
- **custom** - User-specified checklist topic

If no type is provided, ask the user which type they want.

## Step 2: Locate Feature Context

```bash
bash .specify/scripts/bash/check-prerequisites.sh --paths-only --json
```

## Step 3: Read Context

Read relevant documents based on checklist type:

| Type | Required Reading |
|------|-----------------|
| All | `spec.md`, `.specify/memory/constitution.md` |
| review | `plan.md`, `tasks.md` (if exists) |
| release | `plan.md`, `speckit/07-visual-identity-spec.md`, `AGENTS.md` (PR Checklist section) |
| security | `speckit/04-security-lgpd-spec.md`, `speckit/03-data-model-spec.md` |
| accessibility | `speckit/07-visual-identity-spec.md` (section 7) |

## Step 4: Generate Checklist

Write `specs/YYYYMMDD-feature/checklist-[type].md` following the checklist template.

### Checklist Quality Rules

1. Items must be **actionable** - each item is a concrete check, not a vague guideline
2. Items must be **verifiable** - someone can definitively mark it as done or not done
3. Items must reference **specific files or requirements** from the spec when applicable
4. Use sequential IDs: CHK001, CHK002, etc.
5. Group by logical category
6. Include the feature-specific items first, then general project standards

### Type-Specific Content

**review**: Code quality, naming conventions, error handling, RLS compliance, visual identity tokens, responsive behavior, TypeScript types, TanStack Query patterns.

**release**: Build passes, responsive testing, PT-BR strings, no console.logs, no hardcoded secrets, spec updated, lessons learned registered, routes work with direct URL.

**security**: workspace_id scoping, RLS policies, input sanitization, auth checks, LGPD compliance, no data leakage between tenants.

**accessibility**: WCAG compliance, focus management, keyboard navigation, ARIA attributes, color contrast, screen reader compatibility.

## Step 5: Output Summary

Show the user:
- Checklist type and file path
- Total items count
- Categories covered
