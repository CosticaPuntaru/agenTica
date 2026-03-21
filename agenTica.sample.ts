import type { AgenTicaConfig } from './github-auto-implement/resources/scripts/types'

/**
 * agenTica Sample Configuration
 * 
 * This file demonstrates all available configuration options and lifecycle hooks.
 * Copy this to `.agenTica.ts` (or `.agenTica.js`) in your project root to customize.
 */
export default {
  // ── Core Configuration ──────────────────────────────────────────────────────

  /** Poll interval in milliseconds (default: 300,000 / 5 min) */
  pollIntervalMs: 30_000,

  /** Path to the log file (default: tmp/github-daemon.log) */
  logFile: 'tmp/github-daemon.log',

  /** Disable the code-review phase entirely */
  disableReview: false,

  /** Branch name prefix for implemented tasks */
  branchPrefix: 'autobot/',

  // ── Labels ──────────────────────────────────────────────────────────────────

  labels: {
    ready: 'autobot:ready',
    inProgress: 'autobot:in-progress',
    inReview: 'autobot:in-review',
    question: 'autobot:question',
    fixme: 'autobot:fixme',
    reviewSkipped: 'autobot:reviewSkipped',
  },

  // ── Custom Pickers & Logic ──────────────────────────────────────────────────

  /** Custom GitHub search query builder */
  buildQuery: (labels) => 
    `is:issue is:open label:"${labels.ready}" -label:"${labels.question}" -label:"${labels.inProgress}"`,

  /** Custom issue picker (default: picks the first one) */
  pickIssue: (issues) => issues[0],

  /** Determine if an issue is blocked by other issues or PRs */
  isBlocked: (issue, _gh) => {
    return (issue.labels || []).some(l => l.name === 'blocked')
  },

  /** Resolve the base branch for a new implementation branch */
  getBaseBranch: (_issue, _gh, defaultBranch) => defaultBranch,

  // ── Agent Configuration ─────────────────────────────────────────────────────

  agents: {
    default: {
      model: 'sonnet',
      command: 'claude',
      // args: (agent, model) => ['--print', '--dangerously-skip-permissions', '--model', model],
    }
  },

  /** Custom logic to select which agent(s) run on a specific issue */
  getAgent: (_issue, agents, _context) => agents.default,

  // ── Lifecycle Hooks (No-ops) ───────────────────────────────────────────────
  // Use these to intercept data, trigger notifications, or modify context.

  hooks: {
    // Tick
    preLoop: async (ctx) => { /* ctx: { tick, startedAt } */ },
    postLoop: async (ctx) => { },

    // Issue Management
    preListIssues: async (ctx) => { /* ctx: { query, issues? } */ },
    postListIssues: async (ctx) => { },
    prePickIssue: async (ctx) => { /* ctx: { issues, picked? } */ },
    postPickIssue: async (ctx) => { },
    preGetIssue: async (ctx) => { /* ctx: { issueNumber, issue? } */ },
    postGetIssue: async (ctx) => { },
    preSetLabel: async (ctx) => { /* ctx: { issueNumber, add, remove } */ },
    postSetLabel: async (ctx) => { },
    preAddComment: async (ctx) => { /* ctx: { issueNumber, body, commentId? } */ },
    postAddComment: async (ctx) => { },

    // Task Execution
    preGetBaseBranch: async (ctx) => { /* ctx: { issue, defaultBranch, baseBranch? } */ },
    postGetBaseBranch: async (ctx) => { },
    preBuildPrompt: async (ctx) => { /* ctx: { issue, agent, branch, baseBranch, defaultBranch, step, prd?, persona?, skill?, combined?, stepInstructions?, instructions?, body?, labelSection?, commentSection?, prompt? } */ },
    postBuildPrompt: async (ctx) => { },
    preBuildRevisionPrompt: async (ctx) => { /* ctx: { issue, pr, body?, labelSection?, issueCommentSection?, prContext?, prompt? } */ },
    postBuildRevisionPrompt: async (ctx) => { },
    preSpawnAgent: async (ctx) => { /* ctx: { issue, agent, model?, args?, prompt, output? } */ },
    postSpawnAgent: async (ctx) => { },
    preStartTask: async (ctx) => { /* ctx: { issue, agent, branch, baseBranch } */ },
    postStartTask: async (ctx) => { },
    preAutoCommit: async (ctx) => { /* ctx: { issue, branch, message } */ },
    postAutoCommit: async (ctx) => { },

    // Review
    preGetReviewSkill: async (ctx) => { /* ctx: { issue, prd, agent, skill? } */ },
    postGetReviewSkill: async (ctx) => { },
    preStartReview: async (ctx) => { /* ctx: { issue, pr, agent, branch } */ },
    postStartReview: async (ctx) => { },

    // PR
    preCreatePullRequest: async (ctx) => { /* ctx: { issue, branch, baseBranch, title?, body? } */ },
    postCreatePullRequest: async (ctx) => { },

    // Planning (Epic Workflow)
    preGrillMe: async (ctx) => { /* ctx: { epicName, requirements, prompt?, summary? } */ },
    postGrillMe: async (ctx) => { },
    preWritePrd: async (ctx) => { /* ctx: { epicName, grillSummary, problemStatement?, solution?, userStories?, implementationDecisions?, testingDecisions?, outOfScope?, roadmap?, notes?, prompt?, prd? } */ },
    postWritePrd: async (ctx) => { },
    prePrdToIssues: async (ctx) => { },
    postPrdToIssues: async (ctx) => { },
    preCreateGitHubIssue: async (ctx) => { },
    postCreateGitHubIssue: async (ctx) => { },
    preCreateEpicBranch: async (ctx) => { },
    postCreateEpicBranch: async (ctx) => { },
  }
} satisfies AgenTicaConfig
