/**
 * agenTica Lifecycle Hooks — Type Definitions
 *
 * Full `AgenTicaConfig` interface, `AgenTicaHookMap`, and all step context types.
 * For use with `createHooks<AgenTicaHookMap>()` from `hookable`.
 *
 * JSDoc usage in .agenTica.js:
 *   /** @type {import('./github-auto-implement/resources/scripts/types').AgenTicaConfig} *\/
 *
 * TypeScript usage in .agenTica.ts:
 *   import type { AgenTicaConfig } from './github-auto-implement/resources/scripts/types'
 *   export default { ... } satisfies AgenTicaConfig
 */

// ── Shared entity types ───────────────────────────────────────────────────────

/** A GitHub issue as returned by `gh issue view --json` */
export interface GitHubIssue {
  number: number
  title: string
  body: string | null
  url: string
  labels: Array<{ name: string }>
  state?: string
  comments?: Array<{
    author?: { login: string }
    body: string
  }>
}

/** A GitHub pull request as returned by `gh pr view --json` */
export interface GitHubPR {
  number: number
  title: string
  body: string
  url: string
  headRefName: string
  state: string
}

/** A planned issue produced by PRD decomposition */
export interface PlannedIssue {
  title: string
  body: string
  labels?: string[]
}

/** Label names used throughout the workflow */
export interface LabelConfig {
  ready: string
  inProgress: string
  inReview: string
  question: string
  fixme: string
  reviewSkipped: string
}

/** Signature of the internal `gh()` helper passed to config callbacks */
export type GhFunction = (cmd: string, asJson?: boolean) => unknown

/** Per-agent runtime configuration */
export interface AgentConfig {
  COMMAND: string
  MODEL: string
  MODELS?: string[]
  SKILL_FILE: string
  LABELS: LabelConfig
  QUERY: (labels: LabelConfig) => string
  PICKER: (issues: GitHubIssue[]) => GitHubIssue | null
  IS_BLOCKED: (issue: GitHubIssue, gh: GhFunction) => boolean
  GET_BASE_BRANCH: (
    issue: GitHubIssue,
    gh: GhFunction,
    defaultBranch: string,
  ) => string | Promise<string>
  BRANCH_PREFIX: string
  GET_SKILL: (agent: AgentConfig, issue: GitHubIssue) => string
  ARGS: string[] | ((agent: AgentConfig, model: string) => string[])
  GET_MODEL: (agent: AgentConfig, issue: GitHubIssue) => string
  GET_CODE_PROMPT?: (
    issue: GitHubIssue,
    prd: GitHubIssue | null,
    agent: AgentConfig,
  ) => string
  GET_REVIEW_PROMPT?:
    | string
    | ((issue: GitHubIssue, prd: GitHubIssue | null, agent: AgentConfig) => string)
  promptFile?: string
  prompt?: string
  name?: string
}

/** Context passed to `getAgent` to indicate which step is running */
export interface AgentSelectionContext {
  step: 'coding' | 'review'
  prdInfo?: GitHubIssue | null
}

// ── Process context types ─────────────────────────────────────────────────────

/** Context for `onStart` — called once when the daemon process starts */
export interface StartContext {
  pollIntervalMs: number
  logFile: string
  agents: string[]
}

/** Context for `onStop` — called once when the daemon process stops */
export interface StopContext {
  signal: string
}

// ── Tick context types ────────────────────────────────────────────────────────

/** Context for `preLoop` / `postLoop` — fires on every poll tick */
export interface LoopContext {
  tick: number
  startedAt: Date
}

// ── Issue management context types ───────────────────────────────────────────

/** Context for `preListIssues` / `postListIssues` */
export interface ListIssuesContext {
  query: string
  issues?: GitHubIssue[]
}

/** Context for `prePickIssue` / `postPickIssue` */
export interface PickIssueContext {
  issues: GitHubIssue[]
  picked?: GitHubIssue | null
}

/** Context for `preGetIssue` / `postGetIssue` */
export interface GetIssueContext {
  issueNumber: number
  issue?: GitHubIssue
}

/** Context for `preSetLabel` / `postSetLabel` */
export interface SetLabelContext {
  issueNumber: number
  add: string[]
  remove: string[]
}

/** Context for `preAddComment` / `postAddComment` */
export interface AddCommentContext {
  issueNumber: number
  body: string
  commentId?: number | null
}

// ── Task execution context types ──────────────────────────────────────────────

/** Context for `preGetBaseBranch` / `postGetBaseBranch` */
export interface GetBaseBranchContext {
  issue: GitHubIssue
  defaultBranch: string
  baseBranch?: string
}

/** Context for `preBuildPrompt` / `postBuildPrompt` */
export interface BuildPromptContext {
  issue: GitHubIssue
  agent: AgentConfig
  branch: string
  baseBranch: string
  step: 'coding' | 'review'
  prompt?: string
}

/** Context for `preBuildRevisionPrompt` / `postBuildRevisionPrompt` */
export interface BuildRevisionPromptContext {
  issue: GitHubIssue
  pr: GitHubPR
  prompt?: string
}

/** Context for `preSpawnAgent` / `postSpawnAgent` */
export interface SpawnAgentContext {
  agent: AgentConfig
  issue: GitHubIssue
  prompt: string
  output?: string
}

/** Context for `preStartTask` / `postStartTask` */
export interface StartTaskContext {
  issue: GitHubIssue
  agent: AgentConfig
  branch: string
  baseBranch: string
  output?: string
}

/** Context for `preAutoCommit` / `postAutoCommit` */
export interface AutoCommitContext {
  issueNumber: number
  branch: string
  message: string
  committed?: boolean
}

// ── Review context types ──────────────────────────────────────────────────────

/** Context for `preGetReviewSkill` / `postGetReviewSkill` */
export interface GetReviewSkillContext {
  issue: GitHubIssue
  prd: GitHubIssue | null
  agent: AgentConfig
  skill?: string
}

/** Context for `preStartReview` / `postStartReview` */
export interface StartReviewContext {
  issue: GitHubIssue
  agent: AgentConfig
  branch: string
  baseBranch: string
  output?: string
}

// ── PR context types ──────────────────────────────────────────────────────────

/** Context for `preCreatePullRequest` / `postCreatePullRequest` */
export interface CreatePullRequestContext {
  issue: GitHubIssue
  branch: string
  baseBranch: string
  title: string
  body: string
  url?: string
}

// ── Planning workflow context types ───────────────────────────────────────────

/** Context for `preGrillMe` / `postGrillMe` */
export interface GrillMeContext {
  epicName: string
  requirements: string
  summary?: string
}

/** Context for `preWritePrd` / `postWritePrd` */
export interface WritePrdContext {
  epicName: string
  grillSummary: string
  prd?: string
}

/** Context for `prePrdToIssues` / `postPrdToIssues` */
export interface PrdToIssuesContext {
  prd: string
  issues?: PlannedIssue[]
}

/** Context for `preCreateGitHubIssue` / `postCreateGitHubIssue` */
export interface CreateGitHubIssueContext {
  issue: PlannedIssue
  issueNumber?: number
}

/** Context for `preCreateEpicBranch` / `postCreateEpicBranch` */
export interface CreateEpicBranchContext {
  epicName: string
  prdIssueNumber: number
  branch?: string
}

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
