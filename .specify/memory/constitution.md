<!--
  ==========================================================================
  SYNC IMPACT REPORT
  ==========================================================================
  Version change: N/A (initial) -> 1.0.0

  Added Principles:
  - I. Workspace Isolation by Default
  - II. Single Auth Source (Supabase Auth)
  - III. Type and Schema Consistency
  - IV. UX and Visual Identity Consistency
  - V. Feature Modularity and URL-Driven Navigation
  - VI. Spec-First Delivery
  - VII. Operational Safety and Observability

  Added Sections:
  - Stack Constraints
  - Delivery Workflow
  - Governance

  Follow-up TODOs:
  - Align Claude slash-command behavior with local .specify tooling if needed.
  ==========================================================================
-->

# Personal Finances Constitution

## Core Principles

### I. Workspace Isolation by Default

Every business entity that can vary by tenant MUST be scoped by `workspace_id` and protected by Row Level Security (RLS). Any new multi-tenant feature is invalid without:
- workspace-scoped keys/indexes,
- membership-based authorization (`owner`, `admin`, `viewer`),
- policy checks aligned with `has_workspace_role(...)`.

**Rationale**: Tenant isolation is a non-negotiable security and data-integrity boundary.

### II. Single Auth Source (Supabase Auth)

Authentication and identity MUST flow only through Supabase Auth. Parallel auth systems are prohibited. Profile and access control layers may extend auth data, but never replace it.

**Rationale**: A single identity source reduces security risk and state divergence.

### III. Type and Schema Consistency

Database evolution MUST be migration-first, and schema state MUST be auditable in `supabase/schema_snapshot.sql`. Frontend and backend contracts must remain type-safe and explicit.

Mandatory rules:
- schema changes require SQL migration + snapshot update,
- generated or canonical DB types must be preferred over ad-hoc duplicated shapes,
- each requirement in specs must map to verifiable acceptance criteria.

**Rationale**: Prevents drift between code, database, and documentation.

### IV. UX and Visual Identity Consistency

UI changes MUST preserve the documented visual identity (`speckit/07-visual-identity-spec.md`) and interaction quality:
- consistent tokens (colors, radius, typography, spacing),
- clear loading/empty/error states,
- smooth transitions without harming usability,
- responsive validation (desktop and mobile).

**Rationale**: Product quality depends on predictable visual language and interaction behavior.

### V. Feature Modularity and URL-Driven Navigation

Domain logic MUST be organized by feature modules (auth, dashboard, entries, settings, etc.), and navigation must be URL-based (TanStack Router). Large monolithic screens/components are prohibited when feature boundaries are clear.

**Rationale**: Improves maintainability, deep-link support, and safer evolution.

### VI. Spec-First Delivery

Before meaningful product/architecture/data/security changes, teams MUST consult:
- `LICOES_APRENDIDAS.md`,
- `speckit/README.md` and relevant specs.

Each delivery must document:
1. what changed,
2. why this decision was made,
3. roadmap impact,
4. objective next steps.

**Rationale**: Keeps decisions traceable and avoids repeating known failures.

### VII. Operational Safety and Observability

Changes affecting data integrity, auth, permissions, or financial calculations MUST include:
- rollback strategy,
- idempotency where retries are possible,
- explicit error handling and user feedback,
- build/test validation before merge.

**Rationale**: Finance workflows require reliability under failure conditions.

## Stack Constraints

- Frontend: React + Vite + TypeScript.
- Routing: TanStack Router.
- Server-state patterns: TanStack Query (progressive adoption).
- Backend/data platform: Supabase (Postgres, Auth, RLS, Storage when needed).
- SQL source of truth:
  - migrations in `supabase/migrations/`,
  - schema reference in `supabase/schema_snapshot.sql`.

## Delivery Workflow

### Before Implementation

1. Confirm scope in speckit docs.
2. Identify impacts in product, architecture, data, and security.
3. Define acceptance criteria and risks.

### During Implementation

1. Keep code modular by feature.
2. Apply visual tokens and UX states consistently.
3. Update SQL artifacts when schema changes.
4. Validate build and critical flows.

### After Implementation

1. Update roadmap/backlog status.
2. Register relevant learning in `LICOES_APRENDIDAS.md`.
3. Record residual risks and next iteration steps.

## Governance

This constitution defines mandatory guardrails for this project.

Amendment rules:
1. Proposal must include rationale and expected impact.
2. Changes require explicit approval.
3. Versioning follows semver:
   - MAJOR: principle removed/redefined,
   - MINOR: new principle/section,
   - PATCH: wording clarification.
4. Dependent docs (`speckit/*`) must be reviewed after updates.

**Version**: 1.0.0  
**Ratified**: 2026-02-17  
**Last Amended**: 2026-02-17
