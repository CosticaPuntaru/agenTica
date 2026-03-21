/**
 * agenTica Lifecycle Hooks — Zod Schemas
 *
 * Single source of truth for all shapes. TypeScript types in types.ts
 * are fully inferred via z.infer<> — no manual interface duplication.
 *
 * @example
 * import { startTaskContextSchema } from './schemas'
 * const ctx = startTaskContextSchema.parse(rawCtx)
 */

import { z } from 'zod'

// ── Shared sub-schemas ────────────────────────────────────────────────────────

export const labelConfigSchema = z.object({
  ready: z.string(),
  inProgress: z.string(),
  inReview: z.string(),
  question: z.string(),
  fixme: z.string(),
  reviewSkipped: z.string(),
})

export const githubIssueSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  body: z.string().nullable(),
  url: z.string(),
  labels: z.array(z.object({ name: z.string() })),
  state: z.string().optional(),
  comments: z
    .array(
      z.object({
        author: z.object({ login: z.string() }).optional(),
        body: z.string(),
      }),
    )
    .optional(),
})

export const githubPRSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  body: z.string(),
  url: z.string(),
  headRefName: z.string(),
  state: z.string(),
})

export const plannedIssueSchema = z.object({
  title: z.string(),
  body: z.string(),
  labels: z.array(z.string()).optional(),
})

// ── AgentConfig schema ────────────────────────────────────────────────────────

// Local type used only to annotate agentConfigSchema and break the self-reference.
// The exported AgentConfig type is inferred from agentConfigSchema below.
type LabelConfig = z.infer<typeof labelConfigSchema>
type GitHubIssue = z.infer<typeof githubIssueSchema>
type GhFunction = (cmd: string, asJson?: boolean) => unknown

// Self-referential shape — defined locally so Zod can carry the precise types.
type AgentConfigShape = {
  command: string
  model: string
  models?: string[]
  skillFile: string
  labels: LabelConfig
  buildQuery: (labels: LabelConfig) => string
  pickIssue: (issues: GitHubIssue[]) => GitHubIssue | null
  isBlocked: (issue: GitHubIssue, gh: GhFunction) => boolean
  getBaseBranch: (
    issue: GitHubIssue,
    gh: GhFunction,
    defaultBranch: string,
  ) => string | Promise<string>
  branchPrefix: string
  getSkill: (agent: AgentConfigShape, issue: GitHubIssue) => string
  args: string[] | ((agent: AgentConfigShape, model: string) => string[])
  getModel: (agent: AgentConfigShape, issue: GitHubIssue) => string
  getCodePrompt?: (
    issue: GitHubIssue,
    prd: GitHubIssue | null,
    agent: AgentConfigShape,
  ) => string
  getReviewSkill?:
    | string
    | ((issue: GitHubIssue, prd: GitHubIssue | null, agent: AgentConfigShape) => string)
  promptFile?: string
  prompt?: string
  name?: string
}

// Helper: validates a value is callable, carries the precise TS function type.
const fn = <T extends (...args: never[]) => unknown>() =>
  z.custom<T>((val) => typeof val === 'function')

/**
 * Per-agent runtime config schema (camelCase keys).
 * Function fields are validated as callable at runtime and carry precise TS types.
 */
export const agentConfigSchema: z.ZodType<AgentConfigShape> = z.object({
  command: z.string(),
  model: z.string(),
  models: z.array(z.string()).optional(),
  skillFile: z.string(),
  labels: labelConfigSchema,
  buildQuery: fn<AgentConfigShape['buildQuery']>(),
  pickIssue: fn<AgentConfigShape['pickIssue']>(),
  isBlocked: fn<AgentConfigShape['isBlocked']>(),
  getBaseBranch: fn<AgentConfigShape['getBaseBranch']>(),
  branchPrefix: z.string(),
  getSkill: fn<AgentConfigShape['getSkill']>(),
  args: z.union([
    z.array(z.string()),
    fn<Exclude<AgentConfigShape['args'], string[]>>(),
  ]),
  getModel: fn<AgentConfigShape['getModel']>(),
  getCodePrompt: fn<NonNullable<AgentConfigShape['getCodePrompt']>>().optional(),
  getReviewSkill: z
    .union([z.string(), fn<Exclude<AgentConfigShape['getReviewSkill'], string | undefined>>()])
    .optional(),
  promptFile: z.string().optional(),
  prompt: z.string().optional(),
  name: z.string().optional(),
})

// ── Process context schemas ───────────────────────────────────────────────────

/** Schema for StartContext — `onStart` callback */
export const startContextSchema = z.object({
  pollIntervalMs: z.number(),
  logFile: z.string(),
  agents: z.array(z.string()),
})

/** Schema for StopContext — `onStop` callback */
export const stopContextSchema = z.object({
  signal: z.string(),
})

// ── Tick context schemas ──────────────────────────────────────────────────────

/** Schema for LoopContext — `preLoop` / `postLoop` */
export const loopContextSchema = z.object({
  tick: z.number().int().nonnegative(),
  startedAt: z.date(),
})

// ── Issue management context schemas ─────────────────────────────────────────

/** Schema for ListIssuesContext — `preListIssues` / `postListIssues` */
export const listIssuesContextSchema = z.object({
  query: z.string(),
  issues: z.array(githubIssueSchema).optional(),
})

/** Schema for PickIssueContext — `prePickIssue` / `postPickIssue` */
export const pickIssueContextSchema = z.object({
  issues: z.array(githubIssueSchema),
  picked: githubIssueSchema.nullable().optional(),
})

/** Schema for GetIssueContext — `preGetIssue` / `postGetIssue` */
export const getIssueContextSchema = z.object({
  issueNumber: z.number().int().positive(),
  issue: githubIssueSchema.optional(),
})

/** Schema for SetLabelContext — `preSetLabel` / `postSetLabel` */
export const setLabelContextSchema = z.object({
  issueNumber: z.number().int().positive(),
  add: z.array(z.string()),
  remove: z.array(z.string()),
})

/** Schema for AddCommentContext — `preAddComment` / `postAddComment` */
export const addCommentContextSchema = z.object({
  issueNumber: z.number().int().positive(),
  body: z.string(),
  commentId: z.number().int().nullable().optional(),
})

// ── Task execution context schemas ───────────────────────────────────────────

/** Schema for GetBaseBranchContext — `preGetBaseBranch` / `postGetBaseBranch` */
export const getBaseBranchContextSchema = z.object({
  issue: githubIssueSchema,
  defaultBranch: z.string(),
  baseBranch: z.string().optional(),
})

/** Schema for BuildPromptContext — `preBuildPrompt` / `postBuildPrompt` */
export const buildPromptContextSchema = z.object({
  issue: githubIssueSchema,
  agent: agentConfigSchema,
  branch: z.string(),
  baseBranch: z.string(),
  step: z.enum(['coding', 'review']),
  defaultBranch: z.string().optional(),
  prd: githubIssueSchema.nullable().optional(),
  persona: z.string().optional(),
  skill: z.string().optional(),
  combined: z.string().optional(),
  stepInstructions: z.string().optional(),
  instructions: z.string().optional(),
  body: z.string().optional(),
  labelSection: z.string().optional(),
  commentSection: z.string().optional(),
  prompt: z.string().optional(),
})

/** Schema for BuildRevisionPromptContext — `preBuildRevisionPrompt` / `postBuildRevisionPrompt` */
export const buildRevisionPromptContextSchema = z.object({
  issue: githubIssueSchema,
  pr: githubPRSchema,
  body: z.string().optional(),
  labelSection: z.string().optional(),
  issueCommentSection: z.string().optional(),
  prContext: z.string().optional(),
  prompt: z.string().optional(),
})

/** Schema for SpawnAgentContext — `preSpawnAgent` / `postSpawnAgent` */
export const spawnAgentContextSchema = z.object({
  agent: agentConfigSchema,
  issue: githubIssueSchema,
  model: z.string().optional(),
  args: z.array(z.string()).optional(),
  prompt: z.string(),
  output: z.string().optional(),
})

/** Schema for StartTaskContext — `preStartTask` / `postStartTask` */
export const startTaskContextSchema = z.object({
  issue: githubIssueSchema,
  agent: agentConfigSchema,
  branch: z.string(),
  baseBranch: z.string(),
  output: z.string().optional(),
})

/** Schema for AutoCommitContext — `preAutoCommit` / `postAutoCommit` */
export const autoCommitContextSchema = z.object({
  issueNumber: z.number().int().positive(),
  branch: z.string(),
  message: z.string(),
  committed: z.boolean().optional(),
})

// ── Review context schemas ────────────────────────────────────────────────────

/** Schema for GetReviewSkillContext — `preGetReviewSkill` / `postGetReviewSkill` */
export const getReviewSkillContextSchema = z.object({
  issue: githubIssueSchema,
  prd: githubIssueSchema.nullable(),
  agent: agentConfigSchema,
  skill: z.string().optional(),
})

/** Schema for StartReviewContext — `preStartReview` / `postStartReview` */
export const startReviewContextSchema = z.object({
  issue: githubIssueSchema,
  agent: agentConfigSchema,
  branch: z.string(),
  baseBranch: z.string(),
  output: z.string().optional(),
})

// ── PR context schemas ────────────────────────────────────────────────────────

/** Schema for CreatePullRequestContext — `preCreatePullRequest` / `postCreatePullRequest` */
export const createPullRequestContextSchema = z.object({
  issue: githubIssueSchema,
  branch: z.string(),
  baseBranch: z.string(),
  title: z.string(),
  body: z.string(),
  url: z.string().optional(),
})

// ── Planning context schemas ──────────────────────────────────────────────────

/** Schema for GrillMeContext — `preGrillMe` / `postGrillMe` */
export const grillMeContextSchema = z.object({
  epicName: z.string(),
  requirements: z.string(),
  prompt: z.string().optional(),
  summary: z.string().optional(),
})

/** Schema for WritePrdContext — `preWritePrd` / `postWritePrd` */
export const writePrdContextSchema = z.object({
  epicName: z.string(),
  grillSummary: z.string(),
  problemStatement: z.string().optional(),
  solution: z.string().optional(),
  userStories: z.string().optional(),
  implementationDecisions: z.string().optional(),
  testingDecisions: z.string().optional(),
  outOfScope: z.string().optional(),
  roadmap: z.string().optional(),
  notes: z.string().optional(),
  prompt: z.string().optional(),
  prd: z.string().optional(),
})

/** Schema for PrdToIssuesContext — `prePrdToIssues` / `postPrdToIssues` */
export const prdToIssuesContextSchema = z.object({
  prd: z.string(),
  prompt: z.string().optional(),
  issues: z.array(plannedIssueSchema).optional(),
})

/** Schema for CreateGitHubIssueContext — `preCreateGitHubIssue` / `postCreateGitHubIssue` */
export const createGitHubIssueContextSchema = z.object({
  issue: plannedIssueSchema,
  prompt: z.string().optional(),
  issueNumber: z.number().int().positive().optional(),
})

/** Schema for CreateEpicBranchContext — `preCreateEpicBranch` / `postCreateEpicBranch` */
export const createEpicBranchContextSchema = z.object({
  epicName: z.string(),
  prdIssueNumber: z.number().int().positive(),
  prompt: z.string().optional(),
  branch: z.string().optional(),
})
