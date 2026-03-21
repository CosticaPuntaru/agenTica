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
import { Hookable as BaseHookable } from 'hookable'
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
export interface LabelConfig {
  /** Issue is ready for implementation (default: 'autobot:ready') */
  ready: string
  /** Issue is currently being implemented (default: 'autobot:in-progress') */
  inProgress: string
  /** PR is open and needs review (default: 'autobot:in-review') */
  inReview: string
  /** Clarification is needed from a human (default: 'autobot:question') */
  question: string
  /** Implementation has failed or needs manual fix (default: 'autobot:fixme') */
  fixme: string
  /** PR review was skipped for some reason (default: 'autobot:reviewSkipped') */
  reviewSkipped: string
}

/** A GitHub issue as returned by `gh issue view --json` */
export interface GitHubIssue {
  /** The issue number */
  number: number
  /** The summary/title of the issue */
  title: string
  /** Full description of the issue in markdown */
  body: string
  /** Web URL for browsing */
  url: string
  /** List of labels attached to the issue */
  labels: Array<{ name: string }>
  /** List of conversation comments */
  comments?: Array<{
    body: string
    author?: { login: string }
  }>
}

/** A GitHub pull request as returned by `gh pr view --json` */
export interface GitHubPR {
  /** The pull request number */
  number: number
  /** The summary/title of the PR */
  title: string
  /** Full description/body of the PR */
  body: string
  /** Current state of the PR (OPEN, CLOSED, MERGED) */
  state: string
  /** Name of the head branch (the one containing changes) */
  headRefName: string
  /** Name of the target branch (usually main or master) */
  baseRefName: string
  /** Web URL for browsing */
  url: string
}

/** A planned issue produced by PRD decomposition */
export interface PlannedIssue {
  /** Recommended issue title */
  title: string
  /** Detailed issue description/requirements */
  body: string
  /** Labels to apply when creating the issue */
  labels?: string[]
}

/** Signature of the internal `gh()` helper passed to config callbacks */
export type GhFunction = (cmd: string, asJson?: boolean) => any

/**
 * Per-agent runtime configuration (camelCase keys).
 * This defines how a specific agent (like Claude or a local CLI) is executed.
 */
export interface AgentConfig {
  /** Unique identifier for the agent (e.g. 'claude') */
  id: string
  /** Friendly display name */
  name: string
  /** Raw persona prompt segment */
  prompt: string
  /** Path to a markdown skill file relative to PROJECT_ROOT */
  promptFile?: string
  /** Legacy: fallback path to SKILL.md */
  skillFile?: string
  /** The base shell command to execute (default: 'claude') */
  command: string
  /** List of model names this agent can use */
  models?: string[]
  /** Default model name */
  model: string
  /** Resolved label configurations for the agent */
  labels: LabelConfig
  /** Branch name prefix (default: 'autobot/') */
  branchPrefix: string
  
  /** CLI arguments builder for the spawn command */
  args: string[] | ((agent: AgentConfig, model: string) => string[])
  /** Builder for searching ready issues */
  buildQuery: (labels: LabelConfig) => string
  /** Picker for selecting one issue from a list */
  pickIssue: (issues: GitHubIssue[]) => GitHubIssue | null
  /** Returns true if an issue has unmet dependencies */
  isBlocked: (issue: GitHubIssue, gh: GhFunction) => boolean
  /** Resolves the base branch for a task branch */
  getBaseBranch: (issue: GitHubIssue, gh: GhFunction, defaultBranch: string) => string | Promise<string>
  /** Resolves the full skill text for the agent prompt */
  getSkill?: (agent: AgentConfig, issue: GitHubIssue) => string
  /** Selects the specific model name for an issue */
  getModel: (agent: AgentConfig, issue: GitHubIssue) => string
  /** Returns the extra instructions for the coding phase */
  getCodePrompt?: (issue: GitHubIssue, prd: GitHubIssue | null, agent: AgentConfig) => string
  /** Returns the system prompt for the review phase */
  getReviewSkill?: (issue: GitHubIssue, prd: GitHubIssue | null, agent: AgentConfig) => string
}

/** Context passed to `getAgent` to indicate which step is running */
export interface AgentSelectionContext {
  /** Current phase of the workflow */
  step: 'coding' | 'review'
  /** Epic context if available */
  prdInfo?: GitHubIssue | null
}

// ── Process context types (inferred from Zod schemas) ────────────────────────

// ── Process context types ───────────────────────────────────────────────────

/** Context for `onStart` — called once when the daemon process starts */
export interface StartContext {
  /** Timestamp when the daemon process was launched */
  timestamp: Date
  /** The configured poll interval */
  pollIntervalMs: number
  /** Path to the log file being used */
  logFile: string
  /** List of loaded agent IDs */
  agents: string[]
}

/** Context for `onStop` — called once when the daemon process stops */
export interface StopContext {
  /** The signal that triggered the shutdown (e.g. SIGINT) */
  signal: string
  /** Timestamp when the daemon process is shutting down */
  timestamp: Date
  /** Duration in milliseconds since the daemon started */
  uptimeMs: number
}

// ── Tick context types ────────────────────────────────────────────────────────

/** Context for `preLoop` / `postLoop` — fires on every poll tick */
export interface LoopContext {
  /** Sequential iteration number starting from 0 */
  tick: number
  /** Timestamp when this poll loop started */
  startedAt: Date
}

// ── Issue management context types ───────────────────────────────────────────

/** Context for `preListIssues` / `postListIssues` */
export interface ListIssuesContext {
  /** The GitHub search query being executed */
  query: string
  /** The list of issues retrieved (populated in postListIssues) */
  issues?: GitHubIssue[]
}

/** Context for `prePickIssue` / `postPickIssue` */
export interface PickIssueContext {
  /** All ready issues discovered in this tick */
  issues: GitHubIssue[]
  /** The issue selected for implementation (populated in postPickIssue) */
  picked?: GitHubIssue | null
}

/** Context for `preGetIssue` / `postGetIssue` */
export interface GetIssueContext {
  /** The number of the issue being fetched */
  issueNumber: number
  /** The issue details retrieved (populated in postGetIssue) */
  issue?: GitHubIssue
}

/** Context for `preSetLabel` / `postSetLabel` */
export interface SetLabelContext {
  /** The issue number to update */
  issueNumber: number
  /** List of label names to add (e.g. ["autobot:in-progress"]) */
  add: string[]
  /** List of label names to remove (e.g. ["autobot:ready"]) */
  remove: string[]
}

/** Context for `preAddComment` / `postAddComment` */
export interface AddCommentContext {
  /** The issue/PR number to comment on */
  issueNumber: number
  /** The body of the comment (markdown) */
  body: string
  /** The resulting comment ID (populated in postAddComment) */
  commentId?: number | null
}

// ── Task execution context types ──────────────────────────────────────────────

/** Context for `preGetBaseBranch` / `postGetBaseBranch` */
export interface GetBaseBranchContext {
  /** The issue being implemented */
  issue: GitHubIssue
  /** Default fallback branch (usually main/master) */
  defaultBranch: string
  /** The resolved base branch (populated in postGetBaseBranch) */
  baseBranch?: string
}

/** Context for `preBuildPrompt` / `postBuildPrompt` */
export interface BuildPromptContext {
  /** The original GitHub issue being implemented */
  issue: GitHubIssue
  /** The agent configuration being used */
  agent: AgentConfig
  /** The name of the branch for this task */
  branch: string
  /** The base branch (e.g. main or epic branch) */
  baseBranch: string
  /** The repository default branch (e.g. 'master' or 'main') */
  defaultBranch: string
  /** The current workflow step ('coding' or 'review') */
  step: 'coding' | 'review'
  /** The PRD issue if this task belongs to an Epic */
  prd?: GitHubIssue | null

  // Prompt components
  /** The persona/system prompt section from the agent config */
  persona?: string
  /** The skill/workflow section (usually read from markdown) */
  skill?: string
  /** The combined persona and skill block */
  combined?: string
  /** Step-specific instructions (e.g. git diff commands for the review phase) */
  stepInstructions?: string
  /** The combined instructions after {{ID}} etc. template variables are replaced */
  instructions?: string
  /** The raw body of the implementation issue */
  body?: string
  /** The formatted labels section included in the prompt */
  labelSection?: string
  /** The formatted comments section included in the prompt */
  commentSection?: string
  /** The final full prompt string passed to the agent's STDIN */
  prompt?: string
}

/** Context for `preBuildRevisionPrompt` / `postBuildRevisionPrompt` */
export interface BuildRevisionPromptContext {
  /** The original GitHub issue */
  issue: GitHubIssue
  /** The associated open pull request */
  pr: GitHubPR

  // Prompt components
  /** The implementation issue body */
  body?: string
  /** The formatted labels section */
  labelSection?: string
  /** The formatted issue comments section */
  issueCommentSection?: string
  /** The PR context (diffs, review comments, etc.) */
  prContext?: string
  /** The final full prompt string passed to the agent's STDIN */
  prompt?: string
}

/** Context for `preSpawnAgent` / `postSpawnAgent` */
export interface SpawnAgentContext {
  /** The agent config being executed */
  agent: AgentConfig
  /** The issue context */
  issue: GitHubIssue
  /** Resolved model name (e.g. claude-3-5-sonnet-latest) */
  model?: string
  /** Final CLI arguments list for the spawn command */
  args?: string[]
  /** Final full prompt being piped to STDIN */
  prompt: string
  /** The raw text output received from the agent (populated in postSpawnAgent) */
  output?: string
}

/** Context for `preStartTask` / `postStartTask` */
export interface StartTaskContext {
  /** The issue to start */
  issue: GitHubIssue
  /** The selected agent */
  agent: AgentConfig
  /** Name of the new branch */
  branch: string
  /** Resolved base branch */
  baseBranch: string
}

/** Context for `preAutoCommit` / `postAutoCommit` */
export interface AutoCommitContext {
  /** The calculated commit message */
  message: string
}

// ── Review context types ──────────────────────────────────────────────────────

/** Context for `preGetReviewSkill` / `postGetReviewSkill` */
export interface GetReviewSkillContext {
  /** The implementation issue */
  issue: GitHubIssue
  /** Epic PRD context */
  prd: GitHubIssue | null
  /** Selected reviewer agent */
  agent: AgentConfig
  /** Final skill/system prompt for review (populated in postGetReviewSkill) */
  skill?: string
}

/** Context for `preStartReview` / `postStartReview` */
export interface StartReviewContext {
  /** The implementation issue */
  issue: GitHubIssue
  /** The open pull request to review */
  pr: GitHubPR
}

// ── PR context types ──────────────────────────────────────────────────────────

/** Context for `preCreatePullRequest` / `postCreatePullRequest` */
export interface CreatePullRequestContext {
  /** The implementation issue */
  issue: GitHubIssue
  /** Branch name to push */
  branch: string
  /** Target base branch */
  baseBranch: string
  /** Generated PR title */
  title: string
  /** Generated PR body (markdown) */
  body: string
  /** Resulting PR URL (populated in postCreatePullRequest) */
  url?: string
}

// ── Planning workflow context types ───────────────────────────────────────────

/** Context for `preGrillMe` / `postGrillMe` */
export interface GrillMeContext {
  /** Descriptive name of the epic/feature */
  epicName: string
  /** Raw requirements provided at the start of the session */
  requirements: string
  /** Prompt used for the grill interaction */
  prompt?: string
  /** Resulting conceptual summary (populated in postGrillMe) */
  summary?: string
}

/** Context for `preWritePrd` / `postWritePrd` */
export interface WritePrdContext {
  /** Name of the epic */
  epicName: string
  /** Context summary from the GRILL phase */
  grillSummary: string

  // PRD sections
  /** Problem context and background info */
  problemStatement?: string
  /** Proposed high-level solution */
  solution?: string
  /** Concrete user stories to implement */
  userStories?: string
  /** Technical design choices and architecture */
  implementationDecisions?: string
  /** Quality and testing strategy */
  testingDecisions?: string
  /** Intentional non-goals and exclusions */
  outOfScope?: string
  /** Planned delivery roadmap */
  roadmap?: string
  /** Miscellaneous context or reference material */
  notes?: string

  /** Prompt used to generate the document */
  prompt?: string
  /** Final resulting PRD markdown (populated in postWritePrd) */
  prd?: string
}

/** Context for `prePrdToIssues` / `postPrdToIssues` */
export interface PrdToIssuesContext {
  /** Source PRD markdown */
  prd: string
  /** Prompt used for the decomposition process */
  prompt?: string
  /** Generated list of planned tickets (populated in postPrdToIssues) */
  issues?: PlannedIssue[]
}

/** Context for `preCreateGitHubIssue` / `postCreateGitHubIssue` */
export interface CreateGitHubIssueContext {
  /** The planned ticket data */
  issue: PlannedIssue
  /** Prompt for formatting the ticket (if any) */
  prompt?: string
  /** Resulting GitHub issue number (populated in postCreateGitHubIssue) */
  issueNumber?: number
}

/** Context for `preCreateEpicBranch` / `postCreateEpicBranch` */
export interface CreateEpicBranchContext {
  /** Epic identifier */
  epicName: string
  /** Main PRD issue number */
  prdIssueNumber: number
  /** Prompt (if any) */
  prompt?: string
  /** Resulting branch name (populated in postCreateEpicBranch) */
  branch?: string
}

// ── Hook map ──────────────────────────────────────────────────────────────────

type HookFn<T> = (ctx: Readonly<T>) => void | Partial<T> | Promise<void | Partial<T>>

/**
 * A type-safe wrapper around hookable's Hookable class.
 * Ensures that hooks can return Partial<Context> for merging, which satisfies the
 * "pure hooks" requirement while maintaining full TypeScript safety for hook authors.
 */
export type HookableWithReturns<T extends Record<string, any>> = Omit<
  BaseHookable<any>,
  'hook' | 'addHooks'
> & {
  hook<N extends keyof T>(name: N, fn: T[N]): () => void
  addHooks(hooks: Partial<T>): () => void
}

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

/** Config + runtime state used by the daemon class */
export interface AgenTicaContext extends Omit<AgenTicaConfig, 'hooks'> {
  hooks: HookableWithReturns<AgenTicaHookMap>
  userConfig: AgenTicaConfig
  logFile: string
  pollIntervalMs: number
  labels: LabelConfig
  agents: Record<string, AgentConfig>
}
