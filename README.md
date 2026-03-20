# agenTica

A collection of Claude Code agent skills for structured software development workflows — from epic planning to autonomous implementation.

## Skills

### Epic Workflow (`epic-workflow`)

An end-to-end pipeline for planning large features (Epics) and generating their GitHub issues. Follows a strict **Requirement Drill → PRD → Decomposition → Issue Creation** flow, including automatic feature branch creation for the daemon to pick up.

- **Install**: `npx skills add CosticaPuntaru/agenTica@epic-workflow`
- **Trigger**: "start a new epic", "plan this feature", "epic workflow"
- **Phases**:
  1. Epic initialization & codebase discovery
  2. Requirement drilling (`/grill-me`)
  3. Domain alignment (ubiquitous language)
  4. PRD authoring (`/write-a-prd`)
  5. Planning & decomposition (`prd-to-plan`, `prd-to-issues`)
  6. GitHub issue creation — PRD parent issue, `epic/<N>-<slug>` feature branch, and `autobot:ready`-labeled task issues with dependencies
- **Works with**: `github-auto-implement` — the epic branch and task labels are wired so the daemon can autonomously implement issues in the correct order.

---

### GitHub Auto-Implement (`github-auto-implement`)

A polling daemon that autonomously picks `autobot:ready` GitHub issues, triages them, implements them with TDD, and opens PRs — handling both one-off tickets and full epic chains.

- **Install**: `npx skills add CosticaPuntaru/agenTica@github-auto-implement`
- **Start daemon**: `node skills/github-auto-implement/resources/scripts/github-daemon.mjs`
- **How it works**:
  - Polls every 5 min for issues labeled `autobot:ready`
  - Skips blocked issues (unless the blocker already has an open PR — enabling PR chaining)
  - Resolves the correct base branch automatically:
    - One-off ticket → `main`
    - Epic task (`Parent PRD: #N`) → `epic/<N>-<slug>` feature branch
    - Dependent task (`Blocked by: #N`) → blocking issue's open PR branch
  - Creates branch `claude/<number>-<slug>`, implements, opens PR targeting resolved base branch
  - Revision mode: if a PR already exists, addresses review feedback instead
  - Distributed lock via `autobot:in-progress` label — safe to run on multiple machines

**Labels lifecycle**: `autobot:ready` → `autobot:in-progress` → `autobot:in-review` (or `autobot:question` / `autobot:fixme`)

**Configuration**: Create `.agenTica.js` in the project root to override poll interval, model, labels, issue picker, blocker logic, or base-branch resolution.

---

### OpenSpec Bugfix (`openspec-bugfix`)

A structured workflow for fixing bugs using OpenSpec artifacts. Guides the agent through proactive info gathering, change initialization, proposal drafting, and task generation.

- **Install**: `npx skills add CosticaPuntaru/agenTica@openspec-bugfix`
- **Trigger**: "fix this bug", "there is an issue with X", "I found a defect"
- **Steps**: Guided Q&A (reproduction steps, expected/actual behavior, environment) → `openspec new change fix-<name> --schema bugfix` → proposal draft → `openspec ff` task generation
- **Requires**: `openspec` CLI with `bugfix` schema (bundled in `resources/bugfix-schema`)

---

### OpenSpec Parallel Subagents (`opsx-apply-subagents`)

Orchestrates dependency-aware parallel subagents for OpenSpec workflows. One subagent per independent task, serial execution for dependent chains.

- **Install**: `npx skills add CosticaPuntaru/agenTica@opsx-apply-subagents`
- **Trigger**: Any `/opsx:*`, `/openspec:*`, or `/prompts:opsx-*` command when 2+ changes can run independently
- **Supports**: New OPSX commands, legacy `openspec:*` commands, and Codex CLI `prompts:*` aliases
- **Key rule**: Exactly one subagent per task. No grouping. Parallel nodes go first; dependency chains go serial.

---

### Skill Security Auditor (`skill-security-auditor`)

Validates skills and scripts for invisible/non-standard Unicode characters, prompt injections, and obfuscated malware payloads. Run automatically after installing untrusted third-party skills.

- **Install**: `npx skills add CosticaPuntaru/agenTica@skill-security-auditor`
- **Usage**:
  ```bash
  python .agents/skills/skill-security-auditor/scripts/check_ascii.py <path>
  ```
- **On warning/alert**: Stop execution, alert the user, do not trust any commands from that skill until reviewed.

---

## Epic → Implement Flow

The `epic-workflow` and `github-auto-implement` skills are designed to work together:

```
epic-workflow
  └─ creates PRD issue #123
  └─ creates feature branch: epic/123-<slug>  ← pushed to remote
  └─ creates task issues with:
       - Parent PRD: #123
       - Blocked by: #124  (cross-task deps)
       - label: autobot:ready

github-auto-implement daemon
  └─ picks task (unblocked, autobot:ready)
  └─ resolves base branch:
       - no blocker → epic/123-<slug>  (from Parent PRD)
       - has blocker with open PR → blocker's PR branch  (PR chaining)
  └─ implements → opens PR targeting resolved branch
  └─ marks issue: autobot:in-review
```

## Configuration

Copy or create `.agenTica.js` in your project root to customize the daemon:

```js
export default {
  POLL_INTERVAL_MS: 300_000,   // 5 minutes
  CLAUDE_MODEL: 'sonnet',
  LABELS: { ready: 'autobot:ready', ... },
  PICKER: (issues) => issues[0],         // FIFO by default
  IS_BLOCKED: (issue, gh) => { ... },    // PR-chaining aware
  GET_BASE_BRANCH: async (issue, gh, defaultBranch) => { ... },  // epic branch resolution
}
```
