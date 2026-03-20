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
   * @param {Object} issue - The issue object from GitHub.
   * @param {Function} gh - The host's gh(cmd, asJson) helper.
   * @returns {boolean}
   */
  IS_BLOCKED: (issue, gh) => {
    const body = issue.body ?? ''
    // Default: Check "Blocked by #<number>"
    const blockerRegex = /Blocked by\s+(?:#|https:\/\/github\.com\/\S+\/issues\/)(\d+)/gi
    let match
    while ((match = blockerRegex.exec(body)) !== null) {
      const blockerNum = match[1]
      const blockerInfo = gh(`issue view ${blockerNum} --json state`, true)
      if (blockerInfo && blockerInfo.state === 'OPEN') return true
    }
    return false
  },

  // Path to the base SKILL.md for implementation
  // SKILL_FILE: './skills/github-auto-implement/SKILL.md',
}
