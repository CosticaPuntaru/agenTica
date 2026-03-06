---
name: opsx-apply-subagents
description: Use when OpenSpec workflows need dependency-aware parallel subagents across OPSX commands, legacy openspec commands, and Codex CLI prompt aliases.
---

# OpenSpec Parallel Agents

## Overview

This skill is used for orchestrating concurrent sub-agents in OpenSpec, compatible with three types of entries:

1. New OPSX commands (`/opsx:*`)
2. Legacy commands (`/openspec:*`)
3. Codex CLI prompt commands (`/prompts:*`)

The goal is to cover both new and old command semantics, ensuring safe concurrency in multi-change scenarios, controlled summarization, and avoiding write conflicts.

## Command Compatibility Matrix (Must Recognize)

| Scenario        | Command Form                                                                                                                                                                                                                           | Description                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| OPSX New        | `/opsx:explore` `/opsx:new` `/opsx:continue` `/opsx:ff` `/opsx:apply` `/opsx:verify` `/opsx:sync` `/opsx:archive` `/opsx:bulk-archive` `/opsx:onboard`                                                                                 | Current main workflow                          |
| Legacy          | `/openspec:proposal` `/openspec:apply` `/openspec:archive`                                                                                                                                                                             | Compatible with old workflows                  |
| Codex CLI (New) | `/prompts:opsx-explore` `/prompts:opsx-new` `/prompts:opsx-continue` `/prompts:opsx-ff` `/prompts:opsx-apply` `/prompts:opsx-verify` `/prompts:opsx-sync` `/prompts:opsx-archive` `/prompts:opsx-bulk-archive` `/prompts:opsx-onboard` | Corresponds to `~/.codex/prompts/opsx-<id>.md` |
| Codex CLI (Old) | `/prompts:openspec-proposal` `/prompts:openspec-apply` `/prompts:openspec-archive`                                                                                                                                                     | Legacy prompt format, must be compatible       |

## Legacy Command to New Workflow Mapping

1. `/openspec:proposal` or `/prompts:openspec-proposal`

- Equivalent to the "create planning artifact" semantic.
- Recommended mapping: `/opsx:new` + `/opsx:ff` (or `/opsx:continue` stepwise as needed).

2. `/openspec:apply` or `/prompts:openspec-apply`

- Directly maps to `/opsx:apply`.

3. `/openspec:archive` or `/prompts:openspec-archive`

- Directly maps to `/opsx:archive`.

## Codex CLI Special Handling

1. Prompt file directories prioritize `$CODEX_HOME/prompts`, otherwise use `~/.codex/prompts`.
2. If synonymous commands exist with both new and old aliases, prioritize OPSX semantic execution and note "Compatible entry triggered" in the summary.
3. For `/prompts:*` entries, parameters may be passed as a single string; if a change cannot be uniquely located, a change selection must be performed first (no guessing).

## Trigger Conditions

Enable if any condition is met:

1. Simultaneously processing 2 or more changes, where some tasks can be executed independently.
2. Batch archiving or pre-archive checks are required (especially `/opsx:bulk-archive`).
3. Both parallelizable nodes and strong dependency chains exist in the tasks.
4. User uses any new or old command from the table above and explicitly requests parallel sub-agent execution.
5. User runs `/opsx:apply` (or its aliases) and there are multiple pending tasks that can be isolated into independent subagents without conflicting file edits.

## Concurrent Execution Rules

1. Default to splitting 3-6 sub-tasks per round; if fewer than 3, the reason for switching to serial must be explained.
2. Only nodes without pre-dependencies can be concurrent; strong dependency chains must be serial.
3. Parallel writing to overlapping regions of the same file is prohibited; downgrade to serial immediately if conflict risk is detected.
4. When archiving and merging specs involve shared indexes, the final submission must be serial.
5. A round of concurrency must fully return before unified summarization; incremental advancement across rounds is not allowed.

## Command-Level Strategies

### New Commands (`/opsx:*`)

- `/opsx:new`: Can concurrently create independent changes.
- `/opsx:ff`: Concurrently generate planning artifacts grouped by change.
- `/opsx:apply`: Execute the `opsx-apply` workflow by spawning a distinct subagent for each independent task (see Parallel Implementation details).
- `/opsx:verify`: Concurrently verify each change before unified adjudication.
- `/opsx:archive`: Pre-archive checks can be concurrent; final archiving is serial submission.
- `/opsx:bulk-archive`: Perform health checks concurrently first, then archive serially in conflict order.

### Legacy Commands (`/openspec:*`)

- Retain user entry points; do not force users to change commands.
- Convert to OPSX semantics at execution time and apply the same concurrency rules according to the "Legacy to New Mapping".

### Codex CLI (`/prompts:*`)

- Recognize both new and old prompt names.
- Scheduling rules are consistent with `/opsx:*`, only entry aliases differ.

## Specific Workflow for `/opsx:apply` (Parallel Subagent Implementation)

**YOUR MAIN GOAL** when handling `/opsx:apply` (or its aliases) is to offload the actual implementation work to **subagents**. You are the orchestrator; the subagents do the work.

1. **Check instructions**: Run `openspec instructions apply --change "<name>" --json` to get the list of pending tasks and required context files.
2. **Analyze Dependencies**: Read the files listed in `contextFiles`. Analyze the pending tasks to determine which ones can be executed independently without writing to overlapping code regions.
3. **DISPATCH SUBAGENTS (STRICTLY ONE PER TASK)**: For _every_ independent task, you MUST spawn a separate subagent concurrently.
   - **CRITICAL RULE: EXACTLY ONE SUBAGENT PER TASK.** If you have 4 independent tasks, you MUST spawn exactly 4 parallel subagents. Do not group multiple tasks into one subagent.
   - **Do not implement the code yourself.** You only coordinate.
   - Provide each subagent with the `contextFiles` and the precise instructions for its single isolated task.
   - You may pass the `openspec-apply-change` skill to the subagents if necessary, but strictly restrict their scope to their single assigned task.
4. **Aggregate & Update Status**: Wait for all concurrent subagents to return. Review their changes to ensure success and no write conflicts. If a subagent succeeds, mark its task as complete (`- [x]`) in the tasks file. Do this sequentially to prevent merge conflicts.
5. **Iterate**: Find the next batch of unblocked tasks and repeat until the change is complete or blocked.

## Standard Loop

1. Identify entry type (OPSX / Legacy / Codex Prompt).
2. Normalize to OPSX semantics (mapping legacy commands where necessary).
3. Dependency analysis and split into 3-6 conflict-free task cards.
4. Execute parallelizable nodes concurrently.
5. Summarize conflicts, blocks, and risks; decide the next round (parallel or serial).

## Round Summary Template

```markdown
## Round {N} Summary

### Trigger Entry

- Original Command: {e.g., /openspec:proposal or /prompts:opsx-apply}
- Normalized Semantic: {corresponds to /opsx:\*}

### Round Goal

- {One-sentence goal}

### Sub-task Status (3-6)

1. {Task A} | {Completed/Blocked/Failed} | Output: {File or result}
2. {Task B} | {Completed/Blocked/Failed} | Output: {File or result}
3. {Task C} | {Completed/Blocked/Failed} | Output: {File or result}

### Conflicts and Resolution

- Write Conflict Check: {None/Yes, location}
- Resolution Action: {Reschedule concurrency/Switch to serial/Split boundaries}

### Dependency Chain Status

- Serial Chain: {A -> B -> C}
- Current Progress: {Node}

### Next Round Plan

- Parallel Tasks: {List}
- Serial Tasks: {List}
- Archival Readiness: {Ready/Not Ready + Reason}
```
