export default {
  // Global poll interval in ms
  POLL_INTERVAL_MS: 300_000,

  /**
   * Available Agent Profiles.
   * You can define as many as you want (command + model + optional prompt).
   */
  agents: {
    'expert-claude': {
      COMMAND: 'claude',
      MODEL: 'sonnet',
      ARGS: (agent, model) => ['--print', '--dangerously-skip-permissions', '--model', model],
      // Provide a file path for the system prompt
      promptFile: '.agents/prompts/expert-architect.md',
    },
    'speedy-claude': {
      COMMAND: 'claude',
      MODEL: 'haiku',
      ARGS: (agent, model) => ['--print', '--dangerously-skip-permissions', '--model', model],
      prompt: 'You are a pragmatic developer. Focus on speed and solving the issue directly with minimal overhead.',
    },
    'antigravity-agent': {
      COMMAND: 'antigravity',
      MODEL: 'sonnet',
      ARGS: (agent, model) => ['--model', model],
    },
  },

  /**
   * Intelligently route an issue to a specific agent (or fallback list).
   * @param {Object} issue - The GitHub issue metadata
   * @param {Object} agents - The mapping of available agents defined above
   */
  GET_AGENT: (issue, agents) => {
    const title = (issue.title || '').toLowerCase()
    const body = (issue.body || '').toLowerCase()

    // 1. Experimental items try expert first, then fallback to pragmatism
    if (title.includes('experimental') || body.includes('risky')) {
      return [agents['expert-claude'], agents['speedy-claude']]
    }

    // 2. Complex refactors go to the expert
    if (title.includes('refactor') || body.includes('complex')) {
      return agents['expert-claude']
    }
    
    // 3. Bugs or fixes use the speedy agent
    if (title.includes('bug') || title.includes('fix')) {
      return agents['speedy-claude']
    }

    // Default to antigravity
    return agents['antigravity-agent']
  },

  // Global labels (used for polling and state management)
  LABELS: {
    ready: 'autobot:ready',
    inProgress: 'autobot:in-progress',
    inReview: 'autobot:in-review',
    question: 'autobot:question',
    fixme: 'autobot:fixme',
  },

  /**
   * Custom query for picking issues — shared by default.
   */
  QUERY: (labels) => {
    return `is:issue is:open label:"${labels.ready}" -label:"${labels.question}" -label:"${labels.inProgress}"`
  },

  /**
   * Picking logic — select which ready issue to work on first.
   */
  PICKER: (issues) => {
    return issues[0]
  },

  /**
   * Blocker detection — shared by all agents.
   */
  IS_BLOCKED: (issue, gh) => {
    const body = issue.body ?? ''
    const blockerRegex = /Blocked by\s+(?:#|https:\/\/github\.com\/\S+\/issues\/)(\d+)/gi
    let match
    while ((match = blockerRegex.exec(body)) !== null) {
      const blockerNum = match[1]
      const blockerInfo = gh(`issue view ${blockerNum} --json state`, true)
      if (blockerInfo && blockerInfo.state === 'OPEN') {
        const blockerPrs = gh(`pr list --search "[#${blockerNum}]" --state open --json number`, true)
        if (!blockerPrs || blockerPrs.length === 0) return true
      }
    }
    return false
  },

  /**
   * Base branch determination — shared by all agents.
   */
  GET_BASE_BRANCH: async (issue, gh, defaultBranch) => {
    const body = issue.body ?? ''
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
        return blockerPrs[0].headRefName
      }
    }

    const parentRegex = /Parent PRD:?\s*#(\d+)/i
    const parentMatch = parentRegex.exec(body)
    if (parentMatch) {
      const epicNum = parentMatch[1]
      const epicIssue = gh(`issue view ${epicNum} --json title,number`, true)
      if (epicIssue) {
        const slug = epicIssue.title
          .toLowerCase()
          .replace(/^prd:\s*/i, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40)
        return `epic/${epicIssue.number}-${slug}`
      }
    }

    return defaultBranch
  },
}
