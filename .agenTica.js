/**
 * agenTica Configuration File
 *
 * Customize labels, queries, and skill paths for the github-auto-implement daemon.
 */
export default {
  // Poll interval in ms
  POLL_INTERVAL_MS: 300_000,

  // Claude model to use for implementation
  CLAUDE_MODEL: 'sonnet',

  // Custom labels for the autobot lifecycle
  LABELS: {
    ready: 'autobot:ready',
    inProgress: 'autobot:in-progress',
    inReview: 'autobot:in-review',
    question: 'autobot:question',
    fixme: 'autobot:fixme',
  },

  /**
   * Custom query for picking issues.
   * @param {Object} labels - The current labels config
   * @returns {string} - A GitHub Search query
   */
  QUERY: (labels) => {
    return `is:issue is:open label:"${labels.ready}" -label:"${labels.question}" -label:"${labels.inProgress}"`
  },

  /**
   * Picking logic for the next issue.
   * @param {Array} issues - List of ready, unblocked issues.
   * @returns {Object|null} - The issue to implement.
   */
  PICKER: (issues) => {
    // Default: first issue (FIFO)
    return issues[0];
    
    // Example: Pick the most recent one (LIFO)
    // return issues[issues.length - 1];

    // Example: Prioritize by label (if you fetch them in query)
    // return issues.find(i => i.labels.some(l => l.name === 'high-priority')) || issues[0];
  },

  /**
   * Blocker detection logic.
   * Return true if the issue should be skipped due to blockers.
   * Allows PR chaining: a blocked issue can start if the blocker already has an open PR.
   * @param {Object} issue - The issue object from GitHub.
   * @param {Function} gh - The host's gh(cmd, asJson) helper.
   * @returns {boolean}
   */
  IS_BLOCKED: (issue, gh) => {
    const body = issue.body ?? ''
    const blockerRegex = /Blocked by\s+(?:#|https:\/\/github\.com\/\S+\/issues\/)(\d+)/gi
    let match
    while ((match = blockerRegex.exec(body)) !== null) {
      const blockerNum = match[1]
      const blockerInfo = gh(`issue view ${blockerNum} --json state`, true)
      if (blockerInfo && blockerInfo.state === 'OPEN') {
        // Allow if the blocker has an open PR — supports epic branch chaining
        const blockerPrs = gh(`pr list --search "[#${blockerNum}]" --state open --json number`, true)
        if (!blockerPrs || blockerPrs.length === 0) return true
      }
    }
    return false
  },

  /**
   * Determine the base branch for a new issue.
   * Priority: 1) blocker's PR branch (PR chaining), 2) epic feature branch (via Parent PRD), 3) default.
   * @param {Object} issue - The issue object from GitHub.
   * @param {Function} gh - The host's gh(cmd, asJson) helper.
   * @param {string} defaultBranch - The repository's default branch (e.g. 'main').
   * @returns {string} - The exact branch name to use as a base.
   */
  GET_BASE_BRANCH: async (issue, gh, defaultBranch) => {
    const body = issue.body ?? ''

    // 1. If blocked, base off the blocker's open PR branch (PR chaining for dependent tasks)
    const blockerRegex = /Blocked by\s+(?:#|https:\/\/github\.com\/\S+\/issues\/)(\d+)/gi
    let match = blockerRegex.exec(body)
    if (match) {
      const blockerNum = match[1]
      const blockerPrs = gh(
        `pr list --search "[#${blockerNum}]" --state open --json headRefName,title,body`,
        true,
      )
      if (blockerPrs && blockerPrs.length > 0) {
        const regex = new RegExp(`(?:fixes|closes|resolves)?\\s*#${blockerNum}\\b`, 'i')
        const found = blockerPrs.find((pr) => regex.test(pr.body) || regex.test(pr.title))
        if (found) return found.headRefName
        // Fallback: use first result if no regex match
        return blockerPrs[0].headRefName
      }
    }

    // 2. If it has a Parent PRD, base off the epic feature branch (constructed from PRD issue)
    const parentRegex = /Parent PRD:?\s*#(\d+)/i
    const parentMatch = parentRegex.exec(body)
    if (parentMatch) {
      const epicNum = parentMatch[1]
      const epicIssue = gh(`issue view ${epicNum} --json title,number`, true)
      if (epicIssue) {
        // Must match the branch created by epic-workflow: epic/<number>-<slug>
        const slug = epicIssue.title
          .toLowerCase()
          .replace(/^prd:\s*/i, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40)
        return `epic/${epicIssue.number}-${slug}`
      }
    }

    // 3. Fallback to default branch (one-off tickets)
    return defaultBranch
  },
}
