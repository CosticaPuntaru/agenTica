---
name: Product Requirements Document (PRD)
about: agenTica Lifecycle Hooks — full overhaul of daemon config API and extensibility model
title: 'PRD: agenTica Lifecycle Hooks'
labels: 'prd, enhancement'
assignees: ''
---

## Problem Statement

The `github-daemon.mjs` exposes only a handful of coarse config functions in SCREAMING_SNAKE_CASE (`GET_AGENT`, `GET_REVIEW_PROMPT`, etc.) with no type safety. Individual steps of the daemon's execution — listing issues, picking a task, building prompts, spawning agents, running reviews, creating PRs — cannot be intercepted or extended without forking the daemon source. There is also no hook surface for the planning workflow (grill, PRD, issue decomposition). The developer experience is poor and error-prone.

## Solution

Introduce a **typed lifecycle hook system** backed by [`hookable`](https://github.com/unjs/hookable) (the library powering Nuxt 3's plugin system). Every discrete step in both the daemon runtime and the epic-workflow planning phases exposes a `pre<Step>` / `post<Step>` hook pair. Hooks receive a typed, mutable context object; mutating the context modifies what the step receives or produces. All hook contexts are validated with exported Zod schemas. The config API is fully renamed to camelCase, ships with a `types.d.ts`, and supports both `.agenTica.js` (JSDoc) and `.agenTica.ts` (transpiled via `tsx`).

## User Stories

1. As a developer, I want `preStartReview` / `postStartReview` hooks so that I can inject custom context into the review prompt and post-process the agent output without touching daemon source.
2. As a developer, I want `preCreatePullRequest` / `postCreatePullRequest` hooks so that I can modify PR title/body or trigger external notifications after a PR is opened.
3. As a developer, I want `preListIssues` / `postListIssues` hooks so that I can augment the query or filter results before an issue is picked.
4. As a developer, I want `preBuildPrompt` / `postBuildPrompt` hooks so that I can inject additional instructions into every coding prompt globally.
5. As a developer, I want `preSpawnAgent` / `postSpawnAgent` hooks so that I can log, trace, or wrap every agent execution regardless of step type.
6. As a developer, I want `onStart` / `onStop` callbacks so that I can warm up or tear down external integrations (Linear client, Slack, etc.) around the daemon process.
7. As a developer, I want `preGrillMe` / `postGrillMe` and `preWritePrd` / `postWritePrd` hooks so that I can inject domain knowledge into the planning workflow.
8. As a developer, I want a fully typed `AgenTicaConfig` interface with autocomplete and type errors for misconfigured keys.
9. As a developer, I want to import Zod schemas from `schemas.ts` so that I can validate my hook contexts in unit tests.

## Implementation Decisions

### Library: `hookable` from unjs

```bash
npm install hookable
```

- `createHooks<AgenTicaHookMap>()` creates the hook registry
- `hooks.addHooks(config.hooks)` bulk-registers all user hooks from config
- Handlers mutate the context object in place (no return value needed)
- `hooks.callHook('preStartTask', ctx)` awaits all registered handlers sequentially
- Fully async, TypeScript-generic, zero dependencies

### Config API rename (clean break, all keys optional)

| Old (v2)            | New (v3)          |
|---------------------|-------------------|
| `GET_AGENT`         | `getAgent`        |
| `IS_BLOCKED`        | `isBlocked`       |
| `GET_BASE_BRANCH`   | `getBaseBranch`   |
| `PICKER`            | `pickIssue`       |
| `QUERY`             | `buildQuery`      |
| `GET_REVIEW_PROMPT` | `getReviewSkill`  |
| `GET_CODE_PROMPT`   | `getCodePrompt`   |
| `LABELS`            | `labels`          |
| `POLL_INTERVAL_MS`  | `pollIntervalMs`  |
| `BRANCH_PREFIX`     | `branchPrefix`    |
| `GET_SKILL`         | `getSkill`        |
| `GET_MODEL`         | `getModel`        |
| `ARGS`              | `args`            |

### Complete Hook Map

#### Process lifecycle (not hooks — plain async callbacks)

| Key       | When                        | Context type    |
|-----------|-----------------------------|-----------------|
| `onStart` | Once at daemon process start | `StartContext`  |
| `onStop`  | Once at daemon process stop  | `StopContext`   |

#### Per-tick hooks

| Hook pair                    | Context fields                 |
|------------------------------|--------------------------------|
| `preLoop` / `postLoop`       | `{ tick: number; startedAt: Date }` |

#### Issue management hooks

| Hook pair                          | Context fields                                                          |
|------------------------------------|-------------------------------------------------------------------------|
| `preListIssues` / `postListIssues` | `{ query: string; issues?: Issue[] }`                                   |
| `prePickIssue` / `postPickIssue`   | `{ issues: Issue[]; picked?: Issue \| null }`                           |
| `preGetIssue` / `postGetIssue`     | `{ issueNumber: number; issue?: Issue }`                                |
| `preSetLabel` / `postSetLabel`     | `{ issueNumber: number; add: string[]; remove: string[] }`              |
| `preAddComment` / `postAddComment` | `{ issueNumber: number; body: string; commentId?: number \| null }`     |

#### Task execution hooks

| Hook pair                                        | Context fields                                                                                  |
|--------------------------------------------------|-------------------------------------------------------------------------------------------------|
| `preGetBaseBranch` / `postGetBaseBranch`         | `{ issue: Issue; defaultBranch: string; baseBranch?: string }`                                  |
| `preBuildPrompt` / `postBuildPrompt`             | `{ issue: Issue; agent: Agent; branch: string; baseBranch: string; step: 'coding' \| 'review'; prompt?: string }` |
| `preBuildRevisionPrompt` / `postBuildRevisionPrompt` | `{ issue: Issue; pr: PR; prompt?: string }`                                                |
| `preSpawnAgent` / `postSpawnAgent`               | `{ agent: Agent; issue: Issue; prompt: string; output?: string }`                               |
| `preStartTask` / `postStartTask`                 | `{ issue: Issue; agent: Agent; branch: string; baseBranch: string; output?: string }`           |
| `preAutoCommit` / `postAutoCommit`               | `{ issueNumber: number; branch: string; message: string; committed?: boolean }`                 |

#### Review hooks

| Hook pair                              | Context fields                                                                         |
|----------------------------------------|----------------------------------------------------------------------------------------|
| `preGetReviewSkill` / `postGetReviewSkill` | `{ issue: Issue; prd: Issue \| null; agent: Agent; skill?: string }`               |
| `preStartReview` / `postStartReview`   | `{ issue: Issue; agent: Agent; branch: string; baseBranch: string; output?: string }` |

#### Pull request hooks

| Hook pair                                    | Context fields                                                                                       |
|----------------------------------------------|------------------------------------------------------------------------------------------------------|
| `preCreatePullRequest` / `postCreatePullRequest` | `{ issue: Issue; branch: string; baseBranch: string; title: string; body: string; url?: string }` |

#### Planning workflow hooks (epic-workflow skill level)

These hooks are read from `.agenTica.js` by the SKILL.md instructions and executed as shell/config callbacks at each planning checkpoint.

| Hook pair                                        | Context fields                                             |
|--------------------------------------------------|------------------------------------------------------------|
| `preGrillMe` / `postGrillMe`                     | `{ epicName: string; requirements: string; summary?: string }` |
| `preWritePrd` / `postWritePrd`                   | `{ epicName: string; grillSummary: string; prd?: string }` |
| `prePrdToIssues` / `postPrdToIssues`             | `{ prd: string; issues?: PlannedIssue[] }`                 |
| `preCreateGitHubIssue` / `postCreateGitHubIssue` | `{ issue: PlannedIssue; issueNumber?: number }`            |
| `preCreateEpicBranch` / `postCreateEpicBranch`   | `{ epicName: string; prdIssueNumber: number; branch?: string }` |

### Context mutation pattern

```ts
// .agenTica.ts
import type { AgenTicaConfig } from './github-auto-implement/resources/scripts/types'

export default {
  hooks: {
    preStartReview(ctx) {
      ctx.prompt += '\n\nFocus especially on security and input validation.'
    },
    postStartReview(ctx) {
      // ctx.output is the raw agent stdout — you can transform it
      ctx.output = ctx.output?.replace(/LGTM/g, 'LGTM (verified by custom hook)')
    },
    preCreatePullRequest(ctx) {
      ctx.title = `[${ctx.issue.labels[0]?.name ?? 'task'}] ${ctx.title}`
    },
    async onStart() {
      await myLinearClient.connect()
    },
    async onStop() {
      await myLinearClient.disconnect()
    },
  },
} satisfies AgenTicaConfig
```

### File structure (new)

```
github-auto-implement/resources/scripts/
  github-daemon.mjs    ← refactored: hookable wired into every step
  types.d.ts           ← AgenTicaConfig, all context types, AgenTicaHookMap
  schemas.ts           ← Zod schemas per context type, exported for reuse
  lifecycle.ts         ← createDaemonHooks(), callStep() wrapper
```

### `callStep` wrapper (internal)

`lifecycle.ts` exports a `callStep` helper that wraps `callHook` with Zod validation and structured logging:

```ts
async function callStep<K extends keyof AgenTicaHookMap>(
  hooks: ReturnType<typeof createHooks>,
  name: K,
  ctx: AgenTicaHookMap[K] extends (arg: infer C) => any ? C : never
): Promise<void>
```

### TypeScript config support

- `loadConfig()` checks for `.agenTica.ts` first; if present, transpiles in-process via `tsx/esm` loader
- `.agenTica.js` users add: `/** @type {import('./github-auto-implement/resources/scripts/types').AgenTicaConfig} */`
- `AgenTicaConfig` uses `satisfies` pattern; all top-level keys and all hooks are optional

## Testing Decisions

- Test `callStep()` in isolation: pre-hook mutation is visible to the step fn; post-hook mutation is visible in final ctx
- Test Zod validation: invalid context shape logs a structured error with step name
- Test config loader: `.agenTica.js` and `.agenTica.ts` both load; `.ts` is transpiled before import
- Test `addHooks(config.hooks)` correctly registers all keys from user config
- Use `vitest` (confirm from `package.json`; add if absent)
- Do not test daemon tick end-to-end — too many external deps. Test each step extractor in isolation.

## Out of Scope

- GUI / dashboard for hook observability
- A plugin registry or npm-publishable hook packages
- Changing the epic-workflow SKILL.md planning phases themselves (only the hook surface is added)
- Migrating `.agenTica.js` in this repo to v3 (separate task, task 6)

## Proposed Task Roadmap (REFERENCE ONLY)

> [!IMPORTANT]
> This section is for ARCHITECTURAL REFERENCE ONLY.
> Individual tasks are managed via separate GitHub Issues.
> DO NOT implement these features unless they are explicitly part of your CURRENTLY assigned Issue.

1. **Core types + Zod schemas** (#Issue-ID) — `types.d.ts` with `AgenTicaConfig`, `AgenTicaHookMap`, all context types. `schemas.ts` with Zod schemas per context. No daemon changes.
2. **`lifecycle.ts` + hookable integration** (#Issue-ID) — `createDaemonHooks()`, `callStep()` wrapper with Zod validation and logging. Unit-tested. Blocked by task 1.
3. **Config loader v3** (#Issue-ID) — Rewrite `loadConfig()` with camelCase keys, `.agenTica.ts` support via tsx, `onStart`/`onStop` wiring, `addHooks(config.hooks)`. Blocked by task 2.
4. **Wire hooks: loop + issue management** (#Issue-ID) — `preLoop`/`postLoop`, `preListIssues`/`postListIssues`, `prePickIssue`/`postPickIssue`, `preGetIssue`/`postGetIssue`, `preSetLabel`/`postSetLabel`, `preAddComment`/`postAddComment`. Blocked by task 3.
5. **Wire hooks: task execution + review + PR** (#Issue-ID) — `preBuildPrompt`/`postBuildPrompt`, `preBuildRevisionPrompt`/`postBuildRevisionPrompt`, `preSpawnAgent`/`postSpawnAgent`, `preStartTask`/`postStartTask`, `preAutoCommit`/`postAutoCommit`, `preGetReviewSkill`/`postGetReviewSkill`, `preStartReview`/`postStartReview`, `preGetBaseBranch`/`postGetBaseBranch`, `preCreatePullRequest`/`postCreatePullRequest`. Blocked by task 4.
6. **Planning workflow hooks** (#Issue-ID) — Extend epic-workflow SKILL.md to read and call `preGrillMe`/`postGrillMe`, `preWritePrd`/`postWritePrd`, `prePrdToIssues`/`postPrdToIssues`, `preCreateGitHubIssue`/`postCreateGitHubIssue`, `preCreateEpicBranch`/`postCreateEpicBranch` from `.agenTica.js` at each planning checkpoint. Blocked by task 3.
7. **Migrate `.agenTica.js` to v3 API** (#Issue-ID) — Update the repo's own config to use camelCase keys and add example hooks. Blocked by task 5.

## Further Notes

- Hook errors should be caught, logged with step name + hook type, and re-thrown so the daemon applies existing error recovery (fixme label, comment).
- `callStep` should log whether any hook mutated the context, to aid debugging.
- Confirm `tsx` is in `package.json` before adding; fallback to `@swc-node/register` if absent.
- `hookable` uses sequential async execution — hooks fire in registration order, which matches `.agenTica.js` single-file registration.
