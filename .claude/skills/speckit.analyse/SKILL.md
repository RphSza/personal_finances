---
name: speckit.analyse
description: "Deep analysis of a topic, feature area, or codebase concern. Usage: /speckit.analyse <topic>. Performs thorough research across code, specs, and external sources, then produces a structured analysis document in the feature's spec directory or in research/."
user_invocable: true
---

# /speckit.analyse - Deep Analysis

You are performing a deep analysis on a specific topic for the personal finances project.

## Step 1: Determine Scope

Parse `$ARGUMENTS` to understand what to analyze. Common analysis types:

- **Feature area**: "import system", "category management", "authentication flow"
- **Technical concern**: "performance of dashboard queries", "RLS policy coverage"
- **Architecture question**: "state management approach", "component structure"
- **Market research**: "best practices for X", "how competitors handle Y"
- **Codebase health**: "dead code", "inconsistencies", "technical debt"

## Step 2: Determine Output Location

- If on a feature branch (YYYYMMDD-*), save to `specs/YYYYMMDD-feature/research.md`
- Otherwise, save to `research/<topic-slug>-research.md`

## Step 3: Read Project Context

Always read:
1. `.claude/skills/speckit/references/licoes-aprendidas.md` - lessons learned
2. `.specify/memory/constitution.md` - project principles
3. `.claude/skills/speckit/references/spec-index.md` - spec index

Then read relevant specs based on the analysis topic.

## Step 4: Perform Analysis

### 4a. Internal Analysis (codebase)
- Use Glob and Grep to find all relevant files
- Read and understand the code thoroughly
- Map data flows, component trees, hook dependencies
- Identify patterns, inconsistencies, and gaps
- Check alignment with specs and constitution

### 4b. External Research (if needed)
- Use WebSearch for market research, best practices, library comparisons
- Cite sources with URLs
- Compare findings against current implementation

### 4c. Cross-Reference
- Check findings against product spec, architecture spec, data model spec
- Identify misalignments between code and specs
- Flag technical debt or spec drift

## Step 5: Write Analysis Document

Structure the output as:

```markdown
# Analysis: [Topic]

> **Date**: YYYY-MM-DD
> **Scope**: [what was analyzed]
> **Sources**: [internal codebase / external research / both]

## 1. Current State
[What exists today - files, patterns, data flow]

## 2. Findings
[Detailed findings organized by sub-topic]

## 3. Gaps and Issues
[Problems, inconsistencies, missing pieces]

## 4. Recommendations
[Prioritized recommendations with justification]

## 5. References
[Links to sources, file paths, spec sections]
```

## Analysis Quality Rules

1. **Evidence-based** - Every finding must reference a specific file, line, or source
2. **Actionable** - Recommendations must be concrete, not vague
3. **Prioritized** - Use P0/P1/P2 for recommendations
4. **Balanced** - Acknowledge what works well, not just problems
5. **Scoped** - Stay within the requested topic, flag related concerns separately

## Step 6: Output Summary

Show the user:
- Analysis document path
- Key findings (3-5 bullet points)
- Top recommendations
- Suggested next steps (e.g., "create a spec with `/speckit.specify`")
