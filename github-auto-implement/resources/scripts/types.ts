/**
 * agenTica Lifecycle Hooks — Type Definitions
 *
 * All types are inferred from Zod schemas (schemas.ts) — no manual duplication.
 * Only AgenTicaConfig and AgenTicaHookMap are defined here as interfaces because
 * they require complex generics and function signatures that Zod cannot fully express.
 *
 * JSDoc usage in .agenTica.js:
 *   /** @type {import('./github-auto-implement/resources/scripts/types').AgenTicaConfig} *\/
 *
 * TypeScript usage in .agenTica.ts:
 *   import type { AgenTicaConfig } from './github-auto-implement/resources/scripts/types'
 *   export default { ... } satisfies AgenTicaConfig
 */

import { z } from 'zod'
import type {
  labelConfigSchema,
  githubIssueSchema,
  githubPRSchema,
  plannedIssueSchema,
  agentConfigSchema,
  startContextSchema,
  stopContextSchema,
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

// ── Shared entity types (inferred from Zod schemas) ──────────────────────────

/** Label names used throughout the workflow */
export type LabelConfig = z.infer<typeof labelConfigSchema>

/** A GitHub issue as returned by `gh issue view --json` */
export type GitHubIssue = z.infer<typeof githubIssueSchema>

/** A GitHub pull request as returned by `gh pr view --json` */
export type GitHubPR = z.infer<typeof githubPRSchema>

/** A planned issue produced by PRD decomposition */
export type PlannedIssue = z.infer<typeof plannedIssueSchema>

/** Signature of the internal `gh()` helper passed to config callbacks */
export type GhFunction = (cmd: string, asJson?: boolean) => unknown

/**
 * Per-agent runtime configuration (camelCase keys).
 * Inferred from agentConfigSchema — Zod is the single source of truth.
 * Function fields carry precise TypeScript signatures via z.custom<T>.
 */
export type AgentConfig = z.infer<typeof agentConfigSchema>

/** Context passed to `getAgent` to indicate which step is running */
export interface AgentSelectionContext {
  step: 'coding' | 'review'
  prdInfo?: GitHubIssue | null
}

// ── Process context types (inferred from Zod schemas) ────────────────────────

/** Context for `onStart` — called once when the daemon process starts */
export type StartContext = z.infer<typeof startContextSchema>

/** Context for `onStop` — called once when the daemon process stops */
export type StopContext = z.infer<typeof stopContextSchema>

// ── Tick context types ────────────────────────────────────────────────────────

/** Context for `preLoop` / `postLoop` — fires on every poll tick */
export type LoopContext = z.infer<typeof loopContextSchema>

// ── Issue management context types ───────────────────────────────────────────

/** Context for `preListIssues` / `postListIssues` */
export type ListIssuesContext = z.infer<typeof listIssuesContextSchema>

/** Context for `prePickIssue` / `postPickIssue` */
export type PickIssueContext = z.infer<typeof pickIssueContextSchema>

/** Context for `preGetIssue` / `postGetIssue` */
export type GetIssueContext = z.infer<typeof getIssueContextSchema>

/** Context for `preSetLabel` / `postSetLabel` */
export type SetLabelContext = z.infer<typeof setLabelContextSchema>

/** Context for `preAddComment` / `postAddComment` */
export type AddCommentContext = z.infer<typeof addCommentContextSchema>

// ── Task execution context types ──────────────────────────────────────────────

/** Context for `preGetBaseBranch` / `postGetBaseBranch` */
export type GetBaseBranchContext = z.infer<typeof getBaseBranchContextSchema>

/** Context for `preBuildPrompt` / `postBuildPrompt` */
export type BuildPromptContext = z.infer<typeof buildPromptContextSchema>

/** Context for `preBuildRevisionPrompt` / `postBuildRevisionPrompt` */
export type BuildRevisionPromptContext = z.infer<typeof buildRevisionPromptContextSchema>

/** Context for `preSpawnAgent` / `postSpawnAgent` */
export type SpawnAgentContext = z.infer<typeof spawnAgentContextSchema>

/** Context for `preStartTask` / `postStartTask` */
export type StartTaskContext = z.infer<typeof startTaskContextSchema>

/** Context for `preAutoCommit` / `postAutoCommit` */
export type AutoCommitContext = z.infer<typeof autoCommitContextSchema>

// ── Review context types ──────────────────────────────────────────────────────

/** Context for `preGetReviewSkill` / `postGetReviewSkill` */
export type GetReviewSkillContext = z.infer<typeof getReviewSkillContextSchema>

/** Context for `preStartReview` / `postStartReview` */
export type StartReviewContext = z.infer<typeof startReviewContextSchema>

// ── PR context types ──────────────────────────────────────────────────────────

/** Context for `preCreatePullRequest` / `postCreatePullRequest` */
export type CreatePullRequestContext = z.infer<typeof createPullRequestContextSchema>

// ── Planning workflow context types ───────────────────────────────────────────

/** Context for `preGrillMe` / `postGrillMe` */
export type GrillMeContext = z.infer<typeof grillMeContextSchema>

/** Context for `preWritePrd` / `postWritePrd` */
export type WritePrdContext = z.infer<typeof writePrdContextSchema>

/** Context for `prePrdToIssues` / `postPrdToIssues` */
export type PrdToIssuesContext = z.infer<typeof prdToIssuesContextSchema>

/** Context for `preCreateGitHubIssue` / `postCreateGitHubIssue` */
export type CreateGitHubIssueContext = z.infer<typeof createGitHubIssueContextSchema>

/** Context for `preCreateEpicBranch` / `postCreateEpicBranch` */
export type CreateEpicBranchContext = z.infer<typeof createEpicBranchContextSchema>

// ── Hook map ──────────────────────────────────────────────────────────────────

type HookFn<T> = (ctx: T) => void | Promise<void>

/**
 * Typed map of every hook name to its handler signature.
 * Pass to `createHooks<AgenTicaHookMap>()` from `hookable`.
 *
 * Covers 40 hook points across all lifecycle phases:
 *   - Per-tick (2): preLoop / postLoop
 *   - Issue management (10): preListIssues / postListIssues, prePickIssue / postPickIssue,
 *       preGetIssue / postGetIssue, preSetLabel / postSetLabel, preAddComment / postAddComment
 *   - Task execution (12): preGetBaseBranch / postGetBaseBranch, preBuildPrompt / postBuildPrompt,
 *       preBuildRevisionPrompt / postBuildRevisionPrompt, preSpawnAgent / postSpawnAgent,
 *       preStartTask / postStartTask, preAutoCommit / postAutoCommit
 *   - Review (4): preGetReviewSkill / postGetReviewSkill, preStartReview / postStartReview
 *   - PR (2): preCreatePullRequest / postCreatePullRequest
 *   - Planning (10): preGrillMe / postGrillMe, preWritePrd / postWritePrd,
 *       prePrdToIssues / postPrdToIssues, preCreateGitHubIssue / postCreateGitHubIssue,
 *       preCreateEpicBranch / postCreateEpicBranch
 */
export interface AgenTicaHookMap {
  // Tick
  preLoop: HookFn<LoopContext>
  postLoop: HookFn<LoopContext>

  // Issue management
  preListIssues: HookFn<ListIssuesContext>
  postListIssues: HookFn<ListIssuesContext>
  prePickIssue: HookFn<PickIssueContext>
  postPickIssue: HookFn<PickIssueContext>
  preGetIssue: HookFn<GetIssueContext>
  postGetIssue: HookFn<GetIssueContext>
  preSetLabel: HookFn<SetLabelContext>
  postSetLabel: HookFn<SetLabelContext>
  preAddComment: HookFn<AddCommentContext>
  postAddComment: HookFn<AddCommentContext>

  // Task execution
  preGetBaseBranch: HookFn<GetBaseBranchContext>
  postGetBaseBranch: HookFn<GetBaseBranchContext>
  preBuildPrompt: HookFn<BuildPromptContext>
  postBuildPrompt: HookFn<BuildPromptContext>
  preBuildRevisionPrompt: HookFn<BuildRevisionPromptContext>
  postBuildRevisionPrompt: HookFn<BuildRevisionPromptContext>
  preSpawnAgent: HookFn<SpawnAgentContext>
  postSpawnAgent: HookFn<SpawnAgentContext>
  preStartTask: HookFn<StartTaskContext>
  postStartTask: HookFn<StartTaskContext>
  preAutoCommit: HookFn<AutoCommitContext>
  postAutoCommit: HookFn<AutoCommitContext>

  // Review
  preGetReviewSkill: HookFn<GetReviewSkillContext>
  postGetReviewSkill: HookFn<GetReviewSkillContext>
  preStartReview: HookFn<StartReviewContext>
  postStartReview: HookFn<StartReviewContext>

  // PR
  preCreatePullRequest: HookFn<CreatePullRequestContext>
  postCreatePullRequest: HookFn<CreatePullRequestContext>

  // Planning
  preGrillMe: HookFn<GrillMeContext>
  postGrillMe: HookFn<GrillMeContext>
  preWritePrd: HookFn<WritePrdContext>
  postWritePrd: HookFn<WritePrdContext>
  prePrdToIssues: HookFn<PrdToIssuesContext>
  postPrdToIssues: HookFn<PrdToIssuesContext>
  preCreateGitHubIssue: HookFn<CreateGitHubIssueContext>
  postCreateGitHubIssue: HookFn<CreateGitHubIssueContext>
  preCreateEpicBranch: HookFn<CreateEpicBranchContext>
  postCreateEpicBranch: HookFn<CreateEpicBranchContext>
}

// ── Main config interface ─────────────────────────────────────────────────────

/**
 * Full typed configuration for agenTica daemon.
 * All keys are optional. Use `satisfies AgenTicaConfig` in .agenTica.ts
 * or a `@type` JSDoc comment in .agenTica.js.
 *
 * @example
 * // .agenTica.ts
 * import type { AgenTicaConfig } from './github-auto-implement/resources/scripts/types'
 * export default {} satisfies AgenTicaConfig
 */
export interface AgenTicaConfig {
  /** Poll interval in milliseconds (default: 300 000) */
  pollIntervalMs?: number
  /** Path to the log file (default: tmp/github-daemon.log) */
  logFile?: string
  /** Disable the code-review phase (default: false) */
  disableReview?: boolean
  /** Override label names used throughout the workflow */
  labels?: Partial<LabelConfig>
  /** Per-agent configurations, keyed by agent ID */
  agents?: Record<string, Partial<AgentConfig>>

  /** Select which agent(s) to use for a given issue and step */
  getAgent?: (
    issue: GitHubIssue,
    agents: Record<string, AgentConfig>,
    context: AgentSelectionContext,
  ) => AgentConfig | AgentConfig[] | Promise<AgentConfig | AgentConfig[]>

  /** Return true if the issue is blocked and should be skipped */
  isBlocked?: (issue: GitHubIssue, gh: GhFunction) => boolean

  /** Resolve the base branch for a new task branch */
  getBaseBranch?: (
    issue: GitHubIssue,
    gh: GhFunction,
    defaultBranch: string,
  ) => string | Promise<string>

  /** Pick one issue from the list of ready issues */
  pickIssue?: (issues: GitHubIssue[]) => GitHubIssue | null

  /** Build the GitHub search query string */
  buildQuery?: (labels: LabelConfig) => string

  /** Custom prompt or prompt-builder for the review agent */
  getReviewSkill?:
    | string
    | ((issue: GitHubIssue, prd: GitHubIssue | null, agent: AgentConfig) => string)

  /** Extra instructions appended to the coding prompt */
  getCodePrompt?:
    | string
    | ((issue: GitHubIssue, prd: GitHubIssue | null, agent: AgentConfig) => string)

  /** Return the full skill / prompt text for an agent */
  getSkill?: (agent: AgentConfig, issue: GitHubIssue) => string

  /** Select the model name for a given agent and issue */
  getModel?: (agent: AgentConfig, issue: GitHubIssue) => string

  /** Branch name prefix (default: "autobot/") */
  branchPrefix?: string

  /** CLI arguments passed to the agent command */
  args?: string[] | ((agent: AgentConfig, model: string) => string[])

  /** Called once when the daemon process starts */
  onStart?: (ctx: StartContext) => void | Promise<void>

  /** Called once when the daemon process stops */
  onStop?: (ctx: StopContext) => void | Promise<void>

  /** Lifecycle hooks, keyed by hook name */
  hooks?: Partial<AgenTicaHookMap>
}
