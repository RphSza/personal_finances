---
name: speckit.clarify
description: "Identify ambiguities and ask clarifying questions about a feature spec. Usage: /speckit.clarify. Reviews the current spec for gaps, contradictions, undefined behaviors and NEEDS CLARIFICATION markers, then produces a structured list of questions for the user."
user_invocable: true
---

# /speckit.clarify - Clarify Requirements

You are reviewing a feature specification to identify ambiguities, gaps, and open questions that need the user's input before implementation can proceed.

## Step 1: Locate Feature Context

```bash
bash .specify/scripts/bash/check-prerequisites.sh --paths-only --json
```

If not on a feature branch, ask the user which feature to review.

## Step 2: Read the Spec

Read the feature spec at `specs/YYYYMMDD-feature/spec.md` (REQUIRED).

Also read if they exist:
- `specs/YYYYMMDD-feature/plan.md`
- `specs/YYYYMMDD-feature/research.md`

And for context:
- `.specify/memory/constitution.md`
- `speckit/01-product-spec.md` (scope alignment)

## Step 3: Identify Issues

Scan the spec systematically for:

### 3a. Explicit Markers
- `[NEEDS CLARIFICATION: ...]` markers in requirements
- `TODO` or `TBD` annotations
- Empty sections or placeholder text

### 3b. Requirement Gaps
- User stories without acceptance scenarios
- Requirements without clear success criteria
- Edge cases not covered
- Error handling not specified
- Missing validation rules

### 3c. Ambiguities
- Vague language ("should handle appropriately", "may vary")
- Undefined terms or concepts
- Conflicting requirements between stories
- Implicit assumptions not stated

### 3d. Technical Gaps
- UI behavior not fully described (loading, empty, error states)
- Data flow not specified (what triggers what)
- Permission/access control not addressed
- Performance expectations not defined
- Migration/rollback strategy missing

### 3e. Alignment Issues
- Contradictions with product spec (`speckit/01-product-spec.md`)
- Constitution violations (missing workspace_id, RLS, etc.)
- Visual identity gaps (UI features without token references)

## Step 4: Present Questions

Organize questions by category and priority:

```
## Clarification Needed

### Critical (blocks implementation)
1. [Question about requirement X]
   - Context: [why this matters]
   - Suggestion: [proposed default if user doesn't have a preference]

### Important (affects quality)
2. [Question about behavior Y]
   - Context: [why this matters]
   - Options: A) ... B) ... C) ...

### Nice to Know (can proceed with assumption)
3. [Question about edge case Z]
   - Context: [why this matters]
   - Assumption if not answered: [what we'd do by default]
```

## Step 5: Interactive Resolution

After presenting questions, wait for user answers. For each answer:

1. Update the spec directly - replace `[NEEDS CLARIFICATION]` with the decision
2. Add acceptance scenarios if the answer reveals new behaviors
3. Add edge cases if the answer uncovers boundary conditions
4. Note the decision in the spec with a brief rationale

## Clarification Quality Rules

1. **Don't ask obvious questions** - If the answer is clearly implied by context, don't ask
2. **Suggest defaults** - Always provide a recommendation so the user can just approve
3. **Group related questions** - Don't ask 20 questions one at a time
4. **Prioritize** - Critical questions first, nice-to-know last
5. **Be specific** - "What should happen when X?" not "How should X work?"
6. **Reference the spec** - Point to the exact section/requirement being questioned
