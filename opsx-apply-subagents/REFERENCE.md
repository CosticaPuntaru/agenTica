# OpenSpec Parallel Agents — Reference

## Command Compatibility Matrix

| Scenario | Command Form | Description |
|----------|-------------|-------------|
| OPSX New | `/opsx:explore` `/opsx:new` `/opsx:continue` `/opsx:ff` `/opsx:apply` `/opsx:verify` `/opsx:sync` `/opsx:archive` `/opsx:bulk-archive` `/opsx:onboard` | Current main workflow |
| Legacy | `/openspec:proposal` `/openspec:apply` `/openspec:archive` | Compatible with old workflows |
| Codex CLI (New) | `/prompts:opsx-explore` `/prompts:opsx-new` `/prompts:opsx-continue` `/prompts:opsx-ff` `/prompts:opsx-apply` `/prompts:opsx-verify` `/prompts:opsx-sync` `/prompts:opsx-archive` `/prompts:opsx-bulk-archive` `/prompts:opsx-onboard` | `~/.codex/prompts/opsx-<id>.md` |
| Codex CLI (Old) | `/prompts:openspec-proposal` `/prompts:openspec-apply` `/prompts:openspec-archive` | Legacy prompt format |

## Command-Level Strategies

- `/opsx:new`: Concurrently create independent changes
- `/opsx:ff`: Concurrently generate planning artifacts grouped by change
- `/opsx:apply`: One subagent per independent task (parallel)
- `/opsx:verify`: Concurrently verify each change, unified adjudication
- `/opsx:archive`: Pre-archive checks concurrent; final archiving serial
- `/opsx:bulk-archive`: Health checks concurrent, archive serially in conflict order

## Codex CLI Notes

- Prompt dirs: `$CODEX_HOME/prompts` → fallback `~/.codex/prompts`
- If new and old aliases coexist, prioritize OPSX semantics, note "Compatible entry triggered"
- For `/prompts:*`, if a change can't be uniquely located, select it explicitly — no guessing

## Round Summary Template

```markdown
## Round {N} Summary

### Trigger Entry
- Original Command: {e.g., /openspec:proposal or /prompts:opsx-apply}
- Normalized Semantic: {corresponds to /opsx:*}

### Round Goal
- {One-sentence goal}

### Sub-task Status
1. {Task A} | {Completed/Blocked/Failed} | Output: {File or result}
2. {Task B} | {Completed/Blocked/Failed} | Output: {File or result}

### Conflicts and Resolution
- Write Conflict Check: {None/Yes, location}
- Resolution Action: {Reschedule/Switch to serial/Split boundaries}

### Dependency Chain Status
- Serial Chain: {A -> B -> C}
- Current Progress: {Node}

### Next Round Plan
- Parallel Tasks: {List}
- Serial Tasks: {List}
- Archival Readiness: {Ready/Not Ready + Reason}
```
