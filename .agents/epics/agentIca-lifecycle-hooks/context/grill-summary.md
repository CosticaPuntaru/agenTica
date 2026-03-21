# Grill Summary — agenTica Lifecycle Hooks

## Resolved Decisions

### Hook Model
- Hooks live under `hooks:` namespace in `.agenTica.js` / `.agenTica.ts`
- **Pre-hooks**: receive a typed context object → return partial overrides of that context (modify inputs), OR `{ skip: true }` to abort the step, OR `{ result: ... }` to replace the step output entirely
- **Post-hooks**: receive the step output → return a modified output (or `undefined` to pass through unchanged)
- Zod validates all hook return values; schemas are exported for user reuse

### Naming Convention
- All config keys: **camelCase** (React standards) — e.g. `getAgent`, `isBlocked`, `pickIssue`, `buildQuery`
- Hook names: `pre<Step>` / `post<Step>` — e.g. `preStartReview`, `postCreatePullRequest`
- **Clean break** from SCREAMING_SNAKE_CASE — no deprecation shim. All config keys are optional.

### TypeScript / Type Safety
- Ship a `.d.ts` type definition file alongside the daemon
- Support both `.agenTica.js` (with JSDoc `@type` annotation) AND `.agenTica.ts` (transpiled via `tsx` at load time)
- Zod schemas live in a dedicated `schemas.ts` file, exported for user import

### Loop Hook Granularity
- `preLoop` / `postLoop` = fires every poll tick
- `onStart` / `onStop` = fires once at daemon process start/stop

### Hookable Steps (confirmed)
| Step name        | Pre hook            | Post hook            |
|------------------|---------------------|----------------------|
| loop (tick)      | preLoop             | postLoop             |
| listIssues       | preListIssues       | postListIssues       |
| getIssue         | preGetIssue         | postGetIssue         |
| setLabel         | preSetLabel         | postSetLabel         |
| getReviewSkill   | preGetReviewSkill   | postGetReviewSkill   |
| startTask        | preStartTask        | postStartTask        |
| startReview      | preStartReview      | postStartReview      |
| createPullRequest| preCreatePullRequest| postCreatePullRequest|

### `getReviewSkill` replaces `GET_REVIEW_PROMPT`
- The new config key is `getReviewSkill(ctx) => string` (plain function, not a hook)
- The hooks `preGetReviewSkill` / `postGetReviewSkill` wrap it

### File Structure (target)
```
github-auto-implement/resources/scripts/
  github-daemon.mjs       ← main daemon (refactored)
  types.d.ts              ← AgenTicaConfig + all context/result types
  schemas.ts              ← Zod schemas (exported)
  lifecycle.ts            ← runStep() executor
```
