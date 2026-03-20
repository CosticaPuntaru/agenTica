---
name: epic-workflow
description: A comprehensive workflow for research, domain alignment, and multi-phase implementation planning from discovery to GitHub Issue creation. Optimized for generating linked GitHub issues starting with a conceptual grill.
metadata:
  author: CosticaPuntaru
  version: '2.2'
---

# Epic Workflow Skill

This skill guides the agent through an end-to-end process for planning large features (Epics) and generating their respective GitHub issues. It follows a strict **Requirement Drill ➔ Documentation ➔ Decomposition** pipeline.

## When to use

- When starting a new feature (Epic) that requires research and multi-issue planning.
- Specifically triggers when the user says "start a new epic", "plan this feature", or mentions "epic workflow".

## Context Management (Checkpointing)

Long-running workflows like Epics can exceed the model's context window. To maintain efficiency and accuracy:

1. **Phase Checkpointing**: After EVERY phase, summarize the findings into a dedicated Epic directory: `.agents/epics/<epic-name>/context/`. 
   - After `/grill-me`: Save to `grill-summary.md`.
   - After research: Save to `research-notes.md`.
2. **"Stateless" Resumption**: If the session gets too long, instruct the user that you are "checkpointing". Next time you start, simply `view_file` on these summaries instead of re-processing the entire chat history.
3. **Artifact-as-Truth**: Treat the generated files (PRD, Plan, Tasks) as the persistent source of truth. Read the latest file version from disk rather than relying on previous chat messages.

## Steps

### Phase 0: Epic Initialization
1. **Naming**: Propose a kebab-case name for the Epic (e.g., `team-billing-dashboard`).
2. **Discovery (Autonomous)**: Use `improve-codebase-architecture` and `codebase-cleanup-tech-debt` to map the playing field. Answer your own technical questions by reading the codebase before asking the user.

### Phase 1: Requirement Drilling (The "Grill")
3. **Initialize the Grill**
   - **Command**: `/grill-me`
   - **Goal**: Resolving all conceptual ambiguity and design tree branches before drafting.
4. **Checkpoint Findings**
   - **Action**: Save all resolved branches and user decisions to `.agents/epics/<name>/context/grill-summary.md`.

### Phase 2: Domain Alignment
5. **Establish Ubiquitous Language**
   - **Skill**: `ubiquitous-language`.
   - **Goal**: Define canonical terms in `UBIQUITOUS_LANGUAGE.md`.

### Phase 3: Formalizing the PRD
6. **Draft the PRD**
   - **Command**: `/write-a-prd` 
   - **REQUIRED TEMPLATE**: `resources/prd.md`
   - **Guardrail (Recursive Grill)**: If the agent encounters a significant unresolved dependency or technical gap during drafting, they **MUST re-trigger a mini-grill** focused on that specific gap before proceeding.

### Phase 4: Planning & Decomposition
7. **Phase-Level Planning**: Use `prd-to-plan`.
8. **Issue Decomposition**: Use `prd-to-issues`.

### Phase 5: GitHub Issue Creation (Synchronous)
9. **Create the Parent Epic (PRD Issue)**
   - **Tool**: `gh issue create`.
   - **BLOCKING ACTION**: You MUST capture the resulting **Issue Number** (e.g., `#123`). This number is required for linking all subsequent tasks.
10. **Create Task Issues**
    - **Template**: `resources/prd-task.md`.
    - **Mandatory Linking**: Every task body MUST reference the parent PRD issue number (e.g., "Parent PRD: #123").

## Guardrails

- **CRITICAL: Start with Research-Backed Grill**. Proactively read the codebase to answer questions before asking the user.
- **Strict Templating**: The PRD MUST follow the bundled `resources/prd.md` structure exactly.
- **Tracer Bullets**: Slices must be functional vertical slices—never horizontal/layer implementation tasks.
- **Sequential Linking**: Create and link the Parent PRD issue first before creating ANY task issues.
