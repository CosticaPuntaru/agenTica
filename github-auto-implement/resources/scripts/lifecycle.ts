/**
 * agenTica Lifecycle — hookable integration
 *
 * Exports:
 *  - `createDaemonHooks()` — instantiate the typed hookable instance once at daemon startup
 *  - `callStep(hooks, name, ctx)` — Zod-validated hook invocation with mutation logging
 */

import { createHooks } from 'hookable'
import type { Hookable } from 'hookable'
import { z } from 'zod'
import type { AgenTicaHookMap, HookableWithReturns } from './types'
import {
  loopContextSchema,
  listIssuesContextSchema,
  pickIssueContextSchema,
  getIssueContextSchema,
  setLabelContextSchema,
  addCommentContextSchema,
  getBaseBranchContextSchema,
  buildPromptContextSchema,
  buildRevisionPromptContextSchema,
  spawnAgentContextSchema,
  startTaskContextSchema,
  autoCommitContextSchema,
  getReviewSkillContextSchema,
  startReviewContextSchema,
  createPullRequestContextSchema,
  grillMeContextSchema,
  writePrdContextSchema,
  prdToIssuesContextSchema,
  createGitHubIssueContextSchema,
  createEpicBranchContextSchema,
} from './schemas'

// ── Schema registry ───────────────────────────────────────────────────────────

const hookSchemas: Record<keyof AgenTicaHookMap, z.ZodTypeAny> = {
  preLoop: loopContextSchema,
  postLoop: loopContextSchema,
  preListIssues: listIssuesContextSchema,
  postListIssues: listIssuesContextSchema,
  prePickIssue: pickIssueContextSchema,
  postPickIssue: pickIssueContextSchema,
  preGetIssue: getIssueContextSchema,
  postGetIssue: getIssueContextSchema,
  preSetLabel: setLabelContextSchema,
  postSetLabel: setLabelContextSchema,
  preAddComment: addCommentContextSchema,
  postAddComment: addCommentContextSchema,
  preGetBaseBranch: getBaseBranchContextSchema,
  postGetBaseBranch: getBaseBranchContextSchema,
  preBuildPrompt: buildPromptContextSchema,
  postBuildPrompt: buildPromptContextSchema,
  preBuildRevisionPrompt: buildRevisionPromptContextSchema,
  postBuildRevisionPrompt: buildRevisionPromptContextSchema,
  preSpawnAgent: spawnAgentContextSchema,
  postSpawnAgent: spawnAgentContextSchema,
  preStartTask: startTaskContextSchema,
  postStartTask: startTaskContextSchema,
  preAutoCommit: autoCommitContextSchema,
  postAutoCommit: autoCommitContextSchema,
  preGetReviewSkill: getReviewSkillContextSchema,
  postGetReviewSkill: getReviewSkillContextSchema,
  preStartReview: startReviewContextSchema,
  postStartReview: startReviewContextSchema,
  preCreatePullRequest: createPullRequestContextSchema,
  postCreatePullRequest: createPullRequestContextSchema,
  preGrillMe: grillMeContextSchema,
  postGrillMe: grillMeContextSchema,
  preWritePrd: writePrdContextSchema,
  postWritePrd: writePrdContextSchema,
  prePrdToIssues: prdToIssuesContextSchema,
  postPrdToIssues: prdToIssuesContextSchema,
  preCreateGitHubIssue: createGitHubIssueContextSchema,
  postCreateGitHubIssue: createGitHubIssueContextSchema,
  preCreateEpicBranch: createEpicBranchContextSchema,
  postCreateEpicBranch: createEpicBranchContextSchema,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Serialize a context for deep-equality comparison. Functions are replaced with
 *  a stable placeholder so they don't cause false positives on every comparison. */
function serializeCtx(obj: unknown): string {
  return JSON.stringify(obj, (_key, val) => (typeof val === 'function' ? '[function]' : val))
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Instantiate the typed hookable instance. Call once at daemon startup and
 * pass the result through to every `callStep` invocation.
 */
function createDaemonHooks(): HookableWithReturns<AgenTicaHookMap> {
  return createHooks() as any
}

/**
 * Validated hook invocation wrapper.
 *
 * 1. Validates `ctx` against the matching Zod schema (pre-hook).
 * 2. Calls `hooks.callHook(name, ctx)` — hooks may mutate `ctx` in place.
 * 3. Validates `ctx` again (post-hook) to catch invalid mutations.
 * 4. Logs a structured line when any non-function field was mutated.
 * 5. On Zod error: logs step name + phase, then re-throws.
 * 6. On hook error: re-throws with step name context attached.
 */
async function callStep<N extends keyof AgenTicaHookMap>(
  hooks: HookableWithReturns<AgenTicaHookMap>,
  name: N,
  ctx: Parameters<AgenTicaHookMap[N]>[0],
): Promise<void> {
  const schema = hookSchemas[name]

  // Pre-hook validation
  const preParse = schema.safeParse(ctx)
  if (!preParse.success) {
    console.error(JSON.stringify({ step: name, phase: 'pre', issues: preParse.error.issues }))
    throw new Error(
      `[callStep] Invalid context for step "${name}" (pre): ${preParse.error.message}`,
    )
  }

  const before = serializeCtx(ctx)

  // Hook invocation
  try {
    // Collect and merge partial returns from each hook. This allows hooks to be
    // pure (returning overrides) while still supporting legacy in-place mutation.
    const partialSchema = (schema as z.ZodObject<any>).partial()
 
    await (hooks as any).callHookWith(async (handlers: any[], args: any[]) => {
      const context = args[0]
      for (const handler of handlers) {
        const result = await (handler as any)(context)
        if (result && typeof result === 'object') {
          // Validate partial return against the schema
          const parse = partialSchema.safeParse(result)
          if (!parse.success) {
            console.error(
              JSON.stringify({ step: name, phase: 'partial-return', issues: parse.error.issues }),
            )
            throw new Error(
              `[callStep] Invalid context for step "${name}" (post) — invalid partial return: ${parse.error.message}`,
            )
          }
          Object.assign(context, parse.data)
        }
      }
    }, name, [ctx] as any)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`[callStep] Hook error in step "${name}": ${msg}`, { cause: err })
  }

  // Post-hook validation
  const postParse = schema.safeParse(ctx)
  if (!postParse.success) {
    console.error(JSON.stringify({ step: name, phase: 'post', issues: postParse.error.issues }))
    throw new Error(
      `[callStep] Invalid context for step "${name}" (post): ${postParse.error.message}`,
    )
  }

  // Mutation log
  const after = serializeCtx(ctx)
  if (before !== after) {
    console.log(JSON.stringify({ step: name, mutated: true }))
  }
}

export { createDaemonHooks, callStep }
