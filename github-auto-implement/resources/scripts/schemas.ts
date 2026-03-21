/**
 * agenTica Lifecycle Hooks — Zod Schemas
 *
 * One Zod schema per context type, named `<contextName>Schema`.
 * These are the source of truth for runtime validation of hook contexts.
 *
 * @example
 * import { startTaskContextSchema } from './schemas'
 * const ctx = startTaskContextSchema.parse(rawCtx)
 */

import { z } from 'zod'

// ── Shared sub-schemas ────────────────────────────────────────────────────────

const labelConfigSchema = z.object({
  ready: z.string(),
  inProgress: z.string(),
  inReview: z.string(),
  question: z.string(),
  fixme: z.string(),
  reviewSkipped: z.string(),
})

const githubIssueSchema = z.object({
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

const githubPRSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  body: z.string(),
  url: z.string(),
  headRefName: z.string(),
  state: z.string(),
})

const plannedIssueSchema = z.object({
  title: z.string(),
  body: z.string(),
  labels: z.array(z.string()).optional(),
})

/**
 * Partial agent config schema — validates string/array fields only.
 * Function fields use z.function() since they cannot be meaningfully
 * validated at runtime beyond being callable.
 */
const agentConfigSchema = z.object({
  COMMAND: z.string(),
  MODEL: z.string(),
  MODELS: z.array(z.string()).optional(),
  SKILL_FILE: z.string(),
  LABELS: labelConfigSchema,
  QUERY: z.function(),
  PICKER: z.function(),
  IS_BLOCKED: z.function(),
  GET_BASE_BRANCH: z.function(),
  BRANCH_PREFIX: z.string(),
  GET_SKILL: z.function(),
  ARGS: z.union([z.array(z.string()), z.function()]),
  GET_MODEL: z.function(),
  GET_CODE_PROMPT: z.function().optional(),
  GET_REVIEW_PROMPT: z.union([z.string(), z.function()]).optional(),
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
  prompt: z.string().optional(),
})

/** Schema for BuildRevisionPromptContext — `preBuildRevisionPrompt` / `postBuildRevisionPrompt` */
export const buildRevisionPromptContextSchema = z.object({
  issue: githubIssueSchema,
  pr: githubPRSchema,
  prompt: z.string().optional(),
})

/** Schema for SpawnAgentContext — `preSpawnAgent` / `postSpawnAgent` */
export const spawnAgentContextSchema = z.object({
  agent: agentConfigSchema,
  issue: githubIssueSchema,
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
  summary: z.string().optional(),
})

/** Schema for WritePrdContext — `preWritePrd` / `postWritePrd` */
export const writePrdContextSchema = z.object({
  epicName: z.string(),
  grillSummary: z.string(),
  prd: z.string().optional(),
})

/** Schema for PrdToIssuesContext — `prePrdToIssues` / `postPrdToIssues` */
export const prdToIssuesContextSchema = z.object({
  prd: z.string(),
  issues: z.array(plannedIssueSchema).optional(),
})

/** Schema for CreateGitHubIssueContext — `preCreateGitHubIssue` / `postCreateGitHubIssue` */
export const createGitHubIssueContextSchema = z.object({
  issue: plannedIssueSchema,
  issueNumber: z.number().int().positive().optional(),
})

/** Schema for CreateEpicBranchContext — `preCreateEpicBranch` / `postCreateEpicBranch` */
export const createEpicBranchContextSchema = z.object({
  epicName: z.string(),
  prdIssueNumber: z.number().int().positive(),
  branch: z.string().optional(),
})
