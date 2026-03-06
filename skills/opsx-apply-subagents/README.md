# OpenSpec Parallel Agents

This skill is used for orchestrating concurrent sub-agents in OpenSpec, compatible with new OPSX commands, legacy openspec commands, and Codex CLI prompt commands. The goal is to cover both new and old command semantics, ensuring safe concurrency in multi-change scenarios, controlled summarization, and avoiding write conflicts.

## Features

- **Multi-entry Compatibility**: Supports `/opsx:*` (New), `/openspec:*` (Legacy), and `/prompts:*` (Codex CLI) command entries.
- **Concurrent Orchestration**: Intelligently splits 3-6 sub-tasks for parallel execution in multi-change scenarios.
- **Conflict Management**: Dependency analysis to identify strong dependency chains (serial) and independent nodes (parallel), avoiding write conflicts.
- **Unified Summarization**: Standardized state summary after each round of concurrency to decide the next plan.

## Installation

Install this skill using `npx skills`:

```bash
npx skills add https://github.com/rexleimo/rex-skills/tree/main/openspec-parallel-agents
```

## Usage Scenarios

- **New OPSX Commands**: `/opsx:explore`, `/opsx:new`, `/opsx:apply`, `/opsx:archive`, etc.
- **Legacy Commands**: `/openspec:proposal`, `/openspec:apply`, etc. (Automatically mapped to OPSX semantics).
- **Codex CLI**: `/prompts:opsx-*` or `/prompts:openspec-*`.

Automatically triggered when any of the following conditions are met:

1. Simultaneously processing 2 or more changes.
2. Batch archiving required (`/opsx:bulk-archive`).
3. Both parallelizable nodes and strong dependency chains exist in the tasks.
4. User explicitly requests parallel execution.
