#!/usr/bin/env node
/**
 * GitHub Auto-Implement Daemon
 *
 * Polls GitHub every POLL_INTERVAL_MS for "autobot:ready" labelled issues and
 * fires `claude --dangerously-skip-permissions` to implement them autonomously.
 *
 * Distributed lock: the `autobot:in-progress` label IS the lock. Multiple
 * daemons on different PCs are safe — if ANY issue has it, all daemons skip.
 *
 * Required:
 *   - The `gh` CLI installed and authenticated (`gh auth login`).
 *
 * Optional env vars (via .env):
 *   POLL_INTERVAL_MS    Poll interval in ms     (default: 300000 = 5 min)
 *   CLAUDE_MODEL        Model to use            (default: "sonnet")
 */

import { spawn, execSync } from 'child_process'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
} from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createDaemonHooks } from './lifecycle.ts'

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

async function loadConfig() {
  const globalDefaults = {
    pollIntervalMs: 300_000,
    logFile: resolve(ROOT, 'tmp/github-daemon.log'),
    disableReview: false,
  }

  const agentDefaults = {
    command: 'claude',
    model: 'sonnet',
    skillFile: resolve(dirname(fileURLToPath(import.meta.url)), '../../SKILL.md'),
    labels: {
      ready: 'autobot:ready',
      inProgress: 'autobot:in-progress',
      inReview: 'autobot:in-review',
      question: 'autobot:question',
      fixme: 'autobot:fixme',
      reviewSkipped: 'autobot:reviewSkipped',
    },
    buildQuery: (labels) =>
      `is:issue is:open label:"${labels.ready}" -label:"${labels.question}" -label:"${labels.inProgress}"`,
    pickIssue: (issues) => issues[0],
    isBlocked: (issue, gh) => {
      const body = issue.body ?? ''
      const blockerRegex = /Blocked by\s+(?:#|https:\/\/github\.com\/\S+\/issues\/)(\d+)/gi
      let match
      while ((match = blockerRegex.exec(body)) !== null) {
        const blockerNum = match[1]
        const blockerInfo = gh(`issue view ${blockerNum} --json state`, true)
        if (blockerInfo && blockerInfo.state === 'OPEN') {
          // Allow if the blocker has an open PR
          const prs = gh(`pr list --search "[#${blockerNum}]" --state open --json number`, true)
          if (!prs || prs.length === 0) return true
        }
      }
      return false
    },
    getBaseBranch: (issue, gh, defaultBranch) => {
      const body = issue.body ?? ''

      // Determine if there is a Parent PRD to fall back to instead of defaultBranch
      let fallbackBranch = defaultBranch
      const epicRegex = /Parent PRD:\s+(?:#|https:\/\/github\.com\/\S+\/issues\/)(\d+)/gi
      const epicMatch = epicRegex.exec(body)
      if (epicMatch) {
        const epicNum = epicMatch[1]
        const epicInfo = gh(`issue view ${epicNum} --json title,state`, true)
        if (epicInfo && epicInfo.title) {
          fallbackBranch = `epic/${epicNum}-${slugify(epicInfo.title)}`
        }
      }

      const blockerRegex = /Blocked by\s+(?:#|https:\/\/github\.com\/\S+\/issues\/)(\d+)/gi
      let match
      while ((match = blockerRegex.exec(body)) !== null) {
        const blockerNum = match[1]
        const prs = gh(
          `pr list --search "[#${blockerNum}]" --state open --json headRefName,title,body`,
          true,
        )
        if (prs && prs.length > 0) {
          const exactFound = prs.find((pr) => pr.title.includes(`[#${blockerNum}]`))
          if (exactFound) return exactFound.headRefName

          const regex = new RegExp(`(?:fixes|closes|resolves)?\\s*#${blockerNum}\\b`, 'i')
          const found = prs.find((pr) => regex.test(pr.body) || regex.test(pr.title))
          if (found) return found.headRefName

          // If GitHub search returned a PR but it didn't strictly match the regex above,
          // trust the search result to prevent falling back to the default branch (main).
          return prs[0].headRefName
        }
      }
      return fallbackBranch
    },
    branchPrefix: 'autobot/',
    getSkill: (agent, _issue) => {
      if (agent.promptFile && existsSync(agent.promptFile)) {
        return readFileSync(agent.promptFile, 'utf8')
      }
      if (agent.skillFile && existsSync(agent.skillFile)) {
        return readFileSync(agent.skillFile, 'utf8')
      }
      return ''
    },
    args: (agent, model) => ['--print', '--dangerously-skip-permissions', '--model', model],
    getModel: (agent, _issue) => {
      const models = agent.models || [agent.model]
      return models[Math.floor(Math.random() * models.length)]
    },
    getCodePrompt: (_issue, _prd, _agent) => '',
    getReviewSkill: (issue, _prd, _agent) => `You are a Senior Engineer acting as a code reviewer.
Your job is to review the code changes implemented in this branch for the issue #${issue.number}.
Ensure the changes satisfy the primary requirements, are bug-free, and follow best practices.
If you find any issues, use your tools to fix them and verify they work.
Do not ask for permission. Fix problems directly.`,
  }

  // Resolve config path — .agenTica.ts takes precedence over .agenTica.js
  const pwdTsConfigPath = resolve(process.cwd(), '.agenTica.ts')
  const rootTsConfigPath = resolve(ROOT, '.agenTica.ts')
  const pwdJsConfigPath = resolve(process.cwd(), '.agenTica.js')
  const rootJsConfigPath = resolve(ROOT, '.agenTica.js')

  const tsConfigPath = existsSync(pwdTsConfigPath)
    ? pwdTsConfigPath
    : existsSync(rootTsConfigPath)
      ? rootTsConfigPath
      : null
  const jsConfigPath = existsSync(pwdJsConfigPath)
    ? pwdJsConfigPath
    : existsSync(rootJsConfigPath)
      ? rootJsConfigPath
      : null
  const configPath = tsConfigPath || jsConfigPath
  const isTs = !!tsConfigPath

  let userConfig = {}
  if (configPath) {
    try {
      let imported
      if (isTs) {
        // Try tsx/esm/api first (tsImport handles transpilation without a pre-loaded loader)
        let loaded = false
        try {
          const { tsImport } = await import('tsx/esm/api')
          imported = await tsImport(`file://${configPath}`, import.meta.url)
          loaded = true
        } catch {}

        if (!loaded) {
          // Fallback to @swc-node/register
          try {
            await import('@swc-node/register/esm')
            imported = await import(`file://${configPath}`)
            loaded = true
          } catch {}
        }

        if (!loaded) {
          console.warn(
            `Warning: .agenTica.ts found at ${configPath} but neither 'tsx' nor '@swc-node/register' ` +
              `is available. Install one of them (npm install -D tsx) to use TypeScript config. Falling back to defaults.`,
          )
        }
      } else {
        imported = await import(`file://${configPath}`)
      }
      if (imported) {
        userConfig = imported.default ?? imported
      }
    } catch (err) {
      console.warn(`Warning: Failed to load config from ${configPath}: ${err.message}`)
    }
  }

  const pollIntervalMs = Number(
    process.env.POLL_INTERVAL_MS ?? userConfig.pollIntervalMs ?? globalDefaults.pollIntervalMs,
  )
  const logFile = process.env.LOG_FILE ?? userConfig.logFile ?? globalDefaults.logFile
  const disableReview =
    process.env.DISABLE_REVIEW === 'true' ||
    userConfig.disableReview === true ||
    globalDefaults.disableReview

  // Resolve agents mapping
  const agents = userConfig.agents || {
    default: { ...agentDefaults, ...userConfig },
  }
  const resolvedAgents = {}
  for (const [id, a] of Object.entries(agents)) {
    resolvedAgents[id] = {
      ...agentDefaults,
      ...userConfig,
      ...a,
      labels: {
        ...agentDefaults.labels,
        ...(userConfig.labels || {}),
        ...(a.labels || {}),
      },
    }
  }

  // Bootstrap hookable
  const hooks = createDaemonHooks()
  hooks.addHooks(userConfig.hooks ?? {})

  return {
    pollIntervalMs,
    logFile,
    disableReview,
    labels: {
      ...agentDefaults.labels,
      ...(userConfig.labels || {}),
    },
    agents: resolvedAgents,
    getAgent:
      userConfig.getAgent ||
      ((_issue, agents, _context) => {
        const firstId = Object.keys(agents)[0]
        return agents[firstId]
      }),
    getCodePrompt:
      userConfig.getCodePrompt !== undefined ? userConfig.getCodePrompt : agentDefaults.getCodePrompt,
    getReviewSkill:
      userConfig.getReviewSkill !== undefined
        ? userConfig.getReviewSkill
        : agentDefaults.getReviewSkill,
    pickIssue: userConfig.pickIssue || agentDefaults.pickIssue,
    buildQuery: userConfig.buildQuery || agentDefaults.buildQuery,
    isBlocked: userConfig.isBlocked || agentDefaults.isBlocked,
    hooks,
    userConfig,
  }
}

let CONFIG = null // To be initialized in main()

mkdirSync(resolve(ROOT, 'tmp'), { recursive: true })

// ── Logger ────────────────────────────────────────────────────────────────────

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try {
    const prev = existsSync(CONFIG.logFile) ? readFileSync(CONFIG.logFile, 'utf8') : ''
    const lines = prev.split('\n').slice(-999)
    lines.push(line)
    writeFileSync(CONFIG.logFile, lines.join('\n') + '\n')
  } catch {}
}

// ── GitHub CLI ────────────────────────────────────────────────────────────────

function gh(cmd, asJson = true) {
  try {
    const output = execSync(`gh ${cmd}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return asJson ? (output.trim() ? JSON.parse(output) : null) : output.trim()
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : ''
    log(`gh error: command "gh ${cmd}" failed with: ${err.message}${stderr ? `\nStderr: ${stderr}` : ''}`)
    return null
  }
}

function shouldSkip(issue) {
  if (
    issue.labels?.some((l) => {
      const name = l.name.toLowerCase()
      return name.includes('human') || name.includes('clarification')
    })
  )
    return true

  const bodyLower = (issue.body ?? '').toLowerCase()
  if (
    bodyLower.includes('human only') ||
    bodyLower.includes('humans only') ||
    bodyLower.includes('for humans') ||
    bodyLower.includes('needs clarification') ||
    bodyLower.includes('requires clarification')
  )
    return true

  return false
}

function warnConflictingLabels() {
  const conflicts = gh(
    `issue list --search "is:issue is:open label:${CONFIG.labels.ready} label:${CONFIG.labels.question}" --json number,title`,
    true,
  )
  if (conflicts && conflicts.length > 0) {
    for (const c of conflicts) {
      log(
        `\u26a0 WARNING: Issue #${c.number} (${c.title}) has both '${CONFIG.labels.ready}' and '${CONFIG.labels.question}' \u2014 ignored until '${CONFIG.labels.question}' is removed.`,
      )
    }
  }
}

async function getReadyIssues() {
  const query = CONFIG.buildQuery(CONFIG.labels)
  const issues = gh(
    `issue list --search "${query}" --limit 50 --json number,title,labels,body,url`,
    true,
  )

  if (!issues) {
    log('Failed to fetch issues.')
    return []
  }

  const valid = []
  for (const issue of issues) {
    if (shouldSkip(issue)) continue

    // --- Blocker Detection (Configurable) ---
    if (CONFIG.isBlocked(issue, gh)) {
      log(`Skipping #${issue.number} \u2014 it is blocked.`)
      continue
    }

    const details = gh(`issue view ${issue.number} --json comments`, true)
    let commentSkip = false
    if (details && details.comments) {
      for (const c of details.comments) {
        const cbody = (c.body ?? '').toLowerCase()
        if (
          cbody.includes('human only') ||
          cbody.includes('humans only') ||
          cbody.includes('for humans') ||
          cbody.includes('needs clarification') ||
          cbody.includes('requires clarification')
        ) {
          commentSkip = true
          break
        }
      }
    }

    if (!commentSkip) valid.push(issue)
  }

  return valid
}

async function hasInProgressIssue() {
  const query = `is:issue is:open label:${CONFIG.labels.inProgress}`
  const issues = gh(`issue list --search "${query}" --json number,title`, true)
  if (issues && issues.length > 0) {
    log(
      `In-progress issue exists: #${issues[0].number} (${issues[0].title}) \u2014 skipping.`,
    )
    return true
  }
  return false
}

async function swapLabels(issueNum, removeLs, addLs) {
  const removes = (Array.isArray(removeLs) ? removeLs : [removeLs]).filter(Boolean)
  const adds = (Array.isArray(addLs) ? addLs : [addLs]).filter(Boolean)

  if (removes.length === 0 && adds.length === 0) return

  log(`Swapping labels for #${issueNum}: +[${adds.join(', ')}] -[${removes.join(', ')}]`)

  for (const l of adds) {
    gh(`issue edit ${issueNum} --add-label "${l}"`, false)
  }
  for (const l of removes) {
    gh(`issue edit ${issueNum} --remove-label "${l}"`, false)
  }
}

function getRepoNameWithOwner() {
  const repoObj = gh('repo view --json nameWithOwner', true)
  return repoObj?.nameWithOwner
}

async function addComment(issueNum, body) {
  const repo = getRepoNameWithOwner()
  if (!repo) return null

  const tmpFile = resolve(ROOT, `tmp/gh-comment-${Date.now()}.txt`)
  writeFileSync(tmpFile, body)

  try {
    const res = execSync(
      `gh api /repos/${repo}/issues/${issueNum}/comments -F body=@"${tmpFile}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    const parsed = JSON.parse(res)
    unlinkSync(tmpFile)
    return parsed.id
  } catch (e) {
    if (existsSync(tmpFile)) unlinkSync(tmpFile)
    log(`Failed to add comment: ${e.message}`)
    return null
  }
}

// ── Git preparation ──────────────────────────────────────────────────────────

function getPrdInfo(issue, gh) {
  const body = issue.body ?? ''
  const epicRegex = /Parent PRD:\s+(?:#|https:\/\/github\.com\/\S+\/issues\/)(\d+)/gi
  const epicMatch = epicRegex.exec(body)
  if (epicMatch) {
    const epicNum = epicMatch[1]
    const epicInfo = gh(`issue view ${epicNum} --json title,body,state`, true)
    return epicInfo
  }
  return null
}

function getDefaultBranch() {
  try {
    const ref = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim()
    return ref.replace('refs/remotes/origin/', '')
  } catch {
    try {
      execSync('git rev-parse --verify origin/main', {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      return 'main'
    } catch {
      return 'master'
    }
  }
}

function ensureCleanMain() {
  const branch = getDefaultBranch()
  try {
    const status = execSync('git status --porcelain', {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim()
    if (status) {
      log(
        'WARNING: Uncommitted changes detected. Stashing before switching branches.',
      )
      execSync('git stash --include-untracked', {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    }

    execSync(`git checkout ${branch}`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    execSync(`git pull origin ${branch}`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    log(`Git: on ${branch}, up to date with remote.`)
    return true
  } catch (err) {
    log(`ERROR: Failed to prepare git state: ${err.message}`)
    return false
  }
}

function ensureBranchExistsRemotely(branch, defaultBranch) {
  if (branch === defaultBranch) return true
  try {
    execSync(`git ls-remote --exit-code --heads origin ${branch}`, {
      cwd: ROOT,
      stdio: 'ignore',
    })
    // Also fetch it
    execSync(`git fetch origin ${branch}`, { cwd: ROOT, stdio: 'ignore' })
    return true
  } catch {
    log(`Base branch ${branch} not found on remote. Creating it from ${defaultBranch}...`)
    try {
      execSync(`git checkout ${defaultBranch}`, { cwd: ROOT, stdio: 'ignore' })
      try { execSync(`git branch -D ${branch}`, { cwd: ROOT, stdio: 'ignore' }) } catch {}
      execSync(`git checkout -b ${branch}`, { cwd: ROOT, stdio: 'ignore' })
      execSync(`git push -u origin ${branch}`, { cwd: ROOT, stdio: 'ignore' })
      log(`Created base branch: ${branch}`)
      return true
    } catch (err) {
      log(`Failed to create base branch ${branch}: ${err.message}`)
      return false
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

function branchName(agent, issue) {
  const prefix = agent.branchPrefix || 'claude-'
  return `${prefix}${issue.number}-${slugify(issue.title)}`
}

function findExistingPR(issueNumber) {
  const repo = getRepoNameWithOwner()
  if (!repo) return null

  const events = gh(
    `api /repos/${repo}/issues/${issueNumber}/timeline --paginate`,
    true,
  )
  if (events && Array.isArray(events)) {
    for (const event of events) {
      if (
        event.event === 'cross-referenced' &&
        event.source?.issue?.pull_request
      ) {
        const prNum = event.source.issue.number
        const pr = gh(
          `pr view ${prNum} --json number,headRefName,url,title,state`,
          true,
        )
        if (pr && pr.state === 'OPEN') return pr
      }
      if (event.event === 'connected' && event.source?.issue?.pull_request) {
        const prNum = event.source.issue.number
        const pr = gh(
          `pr view ${prNum} --json number,headRefName,url,title,state`,
          true,
        )
        if (pr && pr.state === 'OPEN') return pr
      }
    }
  }

  const prs = gh(
    `pr list --search "[#${issueNumber}]" --state open --json number,headRefName,url,title,body`,
    true,
  )
  if (prs && Array.isArray(prs)) {
    const regex = new RegExp(`(?:fixes|closes|resolves)?\\s*#${issueNumber}\\b`, 'i')
    const found = prs.find((pr) => regex.test(pr.body) || regex.test(pr.title))
    if (found) return found
  }

  return null
}

function getPRContext(prNumber) {
  const reviews = gh(`pr view ${prNumber} --json reviews`, true)
  const repo = getRepoNameWithOwner()
  const reviewComments = repo
    ? gh(`api /repos/${repo}/pulls/${prNumber}/comments --paginate`, true)
    : null
  const diff = gh(`pr diff ${prNumber}`, false) ?? ''
  const prDetails = gh(`pr view ${prNumber} --json comments,body,files`, true)

  let context = ''

  if (prDetails?.body) {
    context += `### PR Description\n${prDetails.body}\n\n`
  }

  if (prDetails?.files && prDetails.files.length > 0) {
    context += `### Changed Files\n${prDetails.files.map((f) => `- \`${f.path}\` (+${f.additions} -${f.deletions})`).join('\n')}\n\n`
  }

  if (prDetails?.comments && prDetails.comments.length > 0) {
    context += `### PR Conversation Comments\n`
    for (const c of prDetails.comments) {
      context += `**${c.author?.login ?? 'unknown'}:**\n${c.body}\n\n---\n\n`
    }
  }

  if (reviewComments && reviewComments.length > 0) {
    context += `### Code Review Comments (inline)\n`
    for (const rc of reviewComments) {
      const file = rc.path ?? '(unknown file)'
      const line = rc.line ?? rc.original_line ?? '?'
      context += `**${rc.user?.login ?? 'unknown'}** on \`${file}:${line}\`:\n${rc.body}\n\n---\n\n`
    }
  }

  if (reviews?.reviews && reviews.reviews.length > 0) {
    context += `### Reviews\n`
    for (const r of reviews.reviews) {
      context += `**${r.author?.login ?? 'unknown'}** \u2014 ${r.state}${r.body ? `:\n${r.body}` : ''}\n\n`
    }
  }

  if (diff) {
    const trimmedDiff =
      diff.length > 8000 ? diff.slice(0, 8000) + '\n... (diff truncated)' : diff
    context += `### Current Diff\n\`\`\`diff\n${trimmedDiff}\n\`\`\`\n\n`
  }

  return context
}

function buildRevisionPrompt(issue, pr) {
  const branch = pr.headRefName

  const full = gh(
    `issue view ${issue.number} --json body,labels,comments`,
    true,
  )
  const body = full?.body ?? issue.body ?? '(no description provided)'

  const labelNames = (full?.labels ?? issue.labels ?? []).map((l) => l.name)
  const labelSection =
    labelNames.length > 0
      ? `### Labels\n${labelNames.map((n) => `- ${n}`).join('\n')}`
      : ''

  const issueComments = full?.comments ?? []
  const issueCommentSection =
    issueComments.length > 0
      ? `### Issue Comments\n${issueComments.map((c, i) => `**Comment ${i + 1}** (by ${c.author?.login ?? 'unknown'}):\n${c.body}`).join('\n\n---\n\n')}`
      : ''

  const prContext = getPRContext(pr.number)

  return `# Revision Mode \u2014 Resolve PR Feedback

You have been given a GitHub issue that already has an open PR (#${pr.number}).
Your job is to **resolve all open review feedback** \u2014 fix requested changes, address comments, and push updates.

Work **fully autonomously** \u2014 do not pause to ask for permission.

**Important:** Every comment you post to GitHub (issues or PRs) MUST start with the 🤖 emoji as a prefix.

## Workflow

### 1. Checkout the existing PR branch

\\\`\\\`\\\`bash
git fetch origin ${branch}
git checkout ${branch}
git pull origin ${branch}
\\\`\\\`\\\`

### 2. Study the feedback

Read ALL the PR review comments, inline code review comments, and issue comments below carefully.
Identify what needs to be fixed or changed.

### 3. Ask for clarification if needed

If at **any point** you encounter something ambiguous, unclear, or missing:
1. Post a comment (always prefix with 🤖):
   \\\`\\\`\\\`bash
   gh pr comment ${pr.number} --body "🤖 I need clarification: ..."
   \\\`\\\`\\\`
2. Swap labels:
   \\\`\\\`\\\`bash
   gh issue edit ${issue.number} --add-label "autobot:question" --remove-label "autobot:in-progress"
   \\\`\\\`\\\`
3. Print \\\`CLARIFICATION_REQUESTED\\\` as your final output.
4. **Stop all work immediately.**

### 4. Make the fixes

Apply all requested changes. Project conventions:
- **No eslint-disable comments** \u2014 fix the underlying lint error instead
- Use src/lib/api-client.ts for all frontend data fetching
- Dev server is assumed running on port 3000
- Put temporary files in ./tmp/
- Assume any CLI command can hang \u2014 set a max timeout when waiting for output

### 5. Verify

\\\`\\\`\\\`bash
pnpm work
\\\`\\\`\\\`

If it hangs after 120s, fall back to: pnpm typecheck && pnpm lint

### 6. Commit and push

\\\`\\\`\\\`bash
git add <specific files>
git commit -m "Fixes #${issue.number}: address review feedback"
git push origin ${branch}
\\\`\\\`\\\`

### 7. Output

Print \`DONE\` as the very last line.

---

## Original Issue: #${issue.number} \u2014 ${issue.title}

${body}

${labelSection}

${issueCommentSection}

---

## PR #${pr.number} \u2014 ${pr.title}

${prContext}
`.trim()
}

function buildPrompt(agent, issue, branch, baseBranch, defaultBranch, step = 'coding', prd = null) {
  let workflow = ''
  if (agent.promptFile) {
    const fpath = resolve(ROOT, agent.promptFile)
    if (existsSync(fpath)) {
      workflow = readFileSync(fpath, 'utf8')
    } else {
      log(`WARNING: promptFile not found: ${fpath}`)
    }
  }

  if (!workflow && agent.getSkill) {
    workflow = agent.getSkill(agent, issue) ?? ''
  }

  const persona = agent.prompt ? `## Persona\n${agent.prompt}\n\n` : ''
  const skill = workflow.replace(/^---[\s\S]*?---\n/, '')
  const modelPrompt = `${persona}${skill}`

  let rootPrompt = ''
  if (step === 'review' && CONFIG.getReviewSkill) {
    rootPrompt = typeof CONFIG.getReviewSkill === 'function' ? CONFIG.getReviewSkill(issue, prd, agent) : CONFIG.getReviewSkill
  } else if (step === 'coding' && CONFIG.getCodePrompt) {
    rootPrompt = typeof CONFIG.getCodePrompt === 'function' ? CONFIG.getCodePrompt(issue, prd, agent) : CONFIG.getCodePrompt
  }

  const combined = rootPrompt ? `${rootPrompt}\n\n${modelPrompt}` : modelPrompt

  let stepInstructions = ''
  if (step === 'review') {
    stepInstructions = `
### Review Process Context
You are currently on branch \`${branch}\`.
To review the actual changes made so far, you can use:
\`\`\`bash
git fetch origin ${baseBranch}
git diff origin/${baseBranch}...${branch}
\`\`\`
Review these changes, check them against the requirements, and make fixes where necessary.
`
  }

  const instructions = (combined + '\n' + stepInstructions)
    .replaceAll('{{BRANCH_NAME}}', branch)
    .replaceAll('{{BASE_BRANCH}}', baseBranch)
    .replaceAll('{{ISSUE_ID}}', String(issue.number))
    .replaceAll('{{ISSUE_TITLE}}', issue.title)
    .replaceAll('{{ISSUE_URL}}', issue.url)
    .replaceAll('origin/master', `origin/${defaultBranch}`)

  const full = gh(`issue view ${issue.number} --json body,labels,comments`, true)
  const body = full?.body ?? issue.body ?? '(no description provided)'

  const labelNames = (full?.labels ?? issue.labels ?? []).map((l) => l.name)
  const labelSection =
    labelNames.length > 0 ? `### Labels\n${labelNames.map((n) => `- ${n}`).join('\n')}` : ''

  const comments = full?.comments ?? []
  const commentSection =
    comments.length > 0
      ? `### Comments\n${comments.map((c, i) => `**Comment ${i + 1}** (by ${c.author?.login ?? 'unknown'}):\n${c.body}`).join('\n\n---\n\n')}`
      : ''

  let prdSection = ''
  if (prd && prd.body) {
    prdSection = `## Parent PRD\n\n### ${prd.title}\n\n${prd.body}\n\n---\n\n`
  }

  return `${instructions}

---

${prdSection}## Issue to implement: #${issue.number} \u2014 ${issue.title}

${body}

${labelSection}

${commentSection}
`.trim()
}

// Track the active child so we can kill it on exit
let activeChild = null

// ── Sleep prevention (Windows only) ──────────────────────────────────────────

let sleepPreventionProcess = null

function enableSleepPrevention() {
  if (process.platform !== 'win32') return
  const ps = `
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class SleepPreventer {
    [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);
}
"@
[SleepPreventer]::SetThreadExecutionState(0x80000001) | Out-Null
while ($true) { Start-Sleep 60; [SleepPreventer]::SetThreadExecutionState(0x80000001) | Out-Null }
`
  sleepPreventionProcess = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', ps],
    {
      stdio: 'ignore',
      detached: false,
    },
  )
  log('Sleep prevention enabled.')
}

function disableSleepPrevention() {
  if (!sleepPreventionProcess) return
  sleepPreventionProcess.kill()
  sleepPreventionProcess = null
  log('Sleep prevention disabled.')
}

function spawnAgent(agent, issue, prompt) {
  return new Promise((resolve, reject) => {
    const model = agent.getModel(agent, issue)
    const args = typeof agent.args === 'function' ? agent.args(agent, model) : agent.args
    log(`Spawning ${agent.command} ${args.join(' ')} (model: ${model}) ...`)

    const child = spawn(agent.command, args, {
      cwd: ROOT,
      env: { ...process.env, ANTHROPIC_API_KEY: undefined },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    child.stdin.write(prompt, 'utf8')
    child.stdin.end()

    activeChild = child
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      process.stdout.write(d)
      stdout += d
      try {
        writeFileSync(CONFIG.logFile, d, { flag: 'a' })
      } catch {}
    })
    child.stderr.on('data', (d) => {
      process.stderr.write(d)
      stderr += d
      try {
        writeFileSync(CONFIG.logFile, d, { flag: 'a' })
      } catch {}
    })
    child.on('close', (code) => {
      activeChild = null
      if (code === 0) {
        resolve(stdout)
      } else {
        const tail = stderr.trim().split('\n').slice(-10).join('\n')
        const err = new Error(`${agent.command} exited ${code}`)
        err.stderr = tail
        reject(err)
      }
    })
  })
}

function readPrMeta() {
  const metaPath = resolve(ROOT, 'tmp/pr-meta.json')
  try {
    if (!existsSync(metaPath)) return null
    return JSON.parse(readFileSync(metaPath, 'utf8'))
  } catch {
    return null
  }
}

function cleanPrMeta() {
  const metaPath = resolve(ROOT, 'tmp/pr-meta.json')
  try {
    if (existsSync(metaPath)) unlinkSync(metaPath)
  } catch {}
}

// ── Label validation ──────────────────────────────────────────────────────────

async function validateLabels() {
  const repo = getRepoNameWithOwner()
  if (!repo) {
    log('WARNING: Could not determine repo. Skipping label validation.')
    return
  }
  const allLabels = new Set()
  for (const agent of Object.values(CONFIG.agents)) {
    for (const label of Object.values(agent.labels)) {
      allLabels.add(label)
    }
  }
  // Include global labels
  for (const label of Object.values(CONFIG.labels)) {
    allLabels.add(label)
  }

  for (const label of allLabels) {
    const existing = gh(`label list --search "${label}" --json name`, true)
    const found = existing?.some((l) => l.name === label)
    if (!found) {
      log(`Creating missing label: "${label}"`)
      gh(`label create "${label}" --force`, false)
    }
  }
  log('All required labels verified: ' + Array.from(allLabels).join(', '))
}

// ── Main tick ─────────────────────────────────────────────────────────────────

async function tick() {
  log('Polling GitHub...')

  // 1. Warn about conflicting labels
  warnConflictingLabels()

  // 2. Guard: distributed lock via labels
  if (await hasInProgressIssue()) {
    return
  }

  // 3. Get ready issues
  const issues = await getReadyIssues()
  if (issues.length === 0) {
    log('No ready issues — nothing to do.')
    return
  }

  const issue = CONFIG.pickIssue(issues)
  if (!issue) {
    log('Picker returned no issue — nothing to do.')
    return
  }
  log(`Picked: #${issue.number} — ${issue.title}`)

  const prdInfo = getPrdInfo(issue, gh)

  // 4. Select Agent(s)
  const agentSelection = await CONFIG.getAgent(issue, CONFIG.agents, { step: 'coding', prdInfo })
  const agents = Array.isArray(agentSelection) ? agentSelection : [agentSelection]
  if (agents.length === 0 || !agents[0]) {
    log('getAgent returned no agent — skipping issue.')
    return
  }

  // 5. Try each agent in the list
  let success = false

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i]
    log(`Attempting agent ${i + 1}/${agents.length}: ${agent.name || 'unnamed'} via ${agent.command} ...`)

    // 5a. Claim/Prepare the issue for THIS agent
    const labels = agent.labels || CONFIG.labels
    await swapLabels(issue.number, labels.ready, labels.inProgress)

    // 5b. Ensure clean git state
    if (!ensureCleanMain()) {
      log('ERROR: Git is not in a clean state.')
      await swapLabels(issue.number, labels.inProgress, labels.fixme)
      await addComment(issue.number, '🤖 **Cannot start** \u2014 git working tree is not clean. Marked as fixme.')
      return
    }

    const existingPR = findExistingPR(issue.number)
    const isRevision = !!existingPR
    const branch = isRevision ? existingPR.headRefName : branchName(agent, issue)

    const defaultBranch = getDefaultBranch()
    let baseBranch = defaultBranch

    if (!isRevision) {
      try {
        baseBranch = await agent.getBaseBranch(issue, gh, defaultBranch)
        if (!baseBranch) baseBranch = defaultBranch
      } catch (err) {
        log(`WARNING: getBaseBranch failed: ${err.message}. Using default.`)
      }

      if (!ensureBranchExistsRemotely(baseBranch, defaultBranch)) {
        log(`ERROR: Base branch ${baseBranch} could not be ensured.`)
        await swapLabels(issue.number, agent.labels.inProgress, agent.labels.fixme)
        await addComment(issue.number, `🤖 **Cannot start** \u2014 failed to setup base branch \`${baseBranch}\`. Marked as fixme.`)
        return
      }
    }

    if (isRevision) {
      log(`Found existing PR #${existingPR.number} on branch ${branch} \u2014 entering revision mode`)
    }

    // 5c. Prepare Prompt
    const prompt = isRevision
      ? buildRevisionPrompt(issue, existingPR)
      : buildPrompt(agent, issue, branch, baseBranch, defaultBranch, 'coding', prdInfo)

    // 5d. Run Agent
    cleanPrMeta()
    try {
      const output = await spawnAgent(agent, issue, prompt)
      log(`${agent.command} finished successfully.`)

      if (output.includes('CLARIFICATION_REQUESTED')) {
        log('Clarification needed \u2014 swapping to question.')
        await swapLabels(issue.number, [labels.inProgress, labels.ready], labels.question)
      } else {
        let reviewSkipped = true;

        // Auto-commit any leftover files and push BEFORE handling PR
        try {
          const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim()
          if (status) {
            log('WARNING: Uncommitted changes detected. Auto-committing them.')
            execSync('git add -A', { cwd: ROOT })
            execSync(`git commit -m "Auto-commit remaining changes for #${issue.number}"`, { cwd: ROOT })
            await addComment(issue.number, `🤖 **Note:** Auto-committed some leftover uncommitted files to \`${branch}\` before pushing.`)
          }

          if (!isRevision && !CONFIG.disableReview && CONFIG.getReviewSkill) {
             log('Review step is configured and enabled. Starting review phase.')
             await addComment(issue.number, `🤖 **Starting code review.**`)

             const reviewAgentSelection = await CONFIG.getAgent(issue, CONFIG.agents, { step: 'review', prdInfo })
             const reviewAgents = Array.isArray(reviewAgentSelection) ? reviewAgentSelection : [reviewAgentSelection]
             
             let reviewSuccess = false
             reviewSkipped = false;
             for (let j = 0; j < reviewAgents.length; j++) {
               const revAgent = reviewAgents[j];
               if (!revAgent) continue;
               
               log(`Running review agent ${j + 1}/${reviewAgents.length}: ${revAgent.name || revAgent.command}...`)
               const reviewPrompt = buildPrompt(revAgent, issue, branch, baseBranch, defaultBranch, 'review', prdInfo)
               
               try {
                 const revOutput = await spawnAgent(revAgent, issue, reviewPrompt)
                 log(`${revAgent.command} review completed successfully.`)
                 if (revOutput.includes('CLARIFICATION_REQUESTED')) {
                    log('Review step requested clarification.');
                    await addComment(issue.number, `🤖 **Note:** Code review requested clarification. Continuing with push anyway.`);
                 }
                 reviewSuccess = true
                 break
               } catch (err) {
                 log(`ERROR during review run: ${err.message}`)
               }
             }

             if (reviewSuccess) {
               const reviewStatus = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim()
               if (reviewStatus) {
                 execSync('git add -A', { cwd: ROOT })
                 execSync(`git commit -m "Review fixes for #${issue.number}"`, { cwd: ROOT })
                 log('Committed review fixes.')
                 await addComment(issue.number, `🤖 **Note:** Review step made changes and created a new commit.`)
               } else {
                 log('Review resulted in no changes.')
               }
             } else {
               log('WARNING: All review agents failed.')
               await addComment(issue.number, `🤖 **Note:** Code review step failed. Pushing code anyway.`)
               reviewSkipped = true;
             }
          }

          log(`Ensuring push for branch ${branch}...`)
          execSync(`git push origin ${branch}`, { cwd: ROOT, stdio: 'ignore' })
        } catch (e) {
          log(`WARNING: auto-commit/push/review failed: ${e.message}`)
        }

        if (!isRevision) {
          // Create PR
          let meta = readPrMeta()
          let prCreated = false

          if (!meta) {
            log('WARNING: tmp/pr-meta.json not found. Falling back to default metadata.')
            await addComment(issue.number, '🤖 Implementation complete but PR metadata file not found. Generating default PR details.\nBranch: `' + branch + '`')
            meta = {
              title: `Fixes #${issue.number}: ${issue.title} [#${issue.number}]`,
              body: `Fixes #${issue.number}\n\nAutomated PR generated by \`${agent.command}\`.`
            }
          }

          const bodyPath = resolve(ROOT, 'tmp/pr-body.md')
          let body = meta.body ?? ''
          if (body && !body.includes(`#${issue.number}`)) {
            body += `\n\nFixes #${issue.number}`
          }
          writeFileSync(bodyPath, body, 'utf8')
          log(`Creating PR: ${meta.title}`)
          
          const safeTitle = (meta.title || '').replace(/"/g, '\\"')
          const prResult = gh(`pr create --base ${baseBranch} --head ${branch} --title "${safeTitle}" --body-file ${bodyPath}`, false)
          cleanPrMeta()
          try { unlinkSync(bodyPath) } catch {}
          const prUrl = typeof prResult === 'string' ? prResult.trim() : null
          if (prUrl) {
            log(`PR URL: ${prUrl}`)
            await addComment(issue.number, `🤖 **PR opened:** ${prUrl}`)
            prCreated = true
          } else {
            log('WARNING: Failed to create PR.')
            await addComment(issue.number, `🤖 **Failed to create PR.** Please check the logs. Branch: \`${branch}\``)
          }

          if (prCreated) {
            // We explicitly remove 'ready' again here just in case the start-time removal failed or race condition occurred.
            const labelsToAdd = [labels.inReview];
            if (reviewSkipped) labelsToAdd.push(labels.reviewSkipped);
            await swapLabels(issue.number, [labels.inProgress, labels.ready], labelsToAdd)
          } else {
            await swapLabels(issue.number, [labels.inProgress, labels.ready], labels.fixme)
          }
        } else {
          // Update PR
          const labelsToAdd = [labels.inReview];
          if (reviewSkipped) labelsToAdd.push(labels.reviewSkipped);
          
          await addComment(issue.number, `🤖 **PR updated with review fixes:** ${existingPR.url}`)
          await swapLabels(issue.number, [labels.inProgress, labels.ready], labelsToAdd)
        }
      }

      success = true
      break
    } catch (err) {
      log(`ERROR during ${agent.command} run: ${err.message}`)
      if (i < agents.length - 1) {
        log(`Attempt ${i + 1} failed. Powering through to next agent...`)
        try { execSync('git reset --hard && git clean -fd', { cwd: ROOT }) } catch {}
        continue
      }
      // Ultimate failure
      await swapLabels(issue.number, [labels.inProgress, labels.ready], labels.fixme)
      const details = err.stderr ? `\n\n\`\`\`\n${err.stderr}\n\`\`\`` : ''
      await addComment(issue.number, `🤖 **All agents failed** \u2014 marked as fixme.\n\nError from last attempt (${agent.command}): ${err.message}${details}`)
    }
  }

  if (success) {
    log(`Done: #${issue.number} \u2014 ${issue.title}`)
  }
}

// ── Log tail display ──────────────────────────────────────────────────────────

const LOG_TAIL_LINES = 5
let logTailInterval = null
let logTailRenderedCount = 0 // how many lines are currently occupying the terminal

function getLastLogLines() {
  try {
    const content = existsSync(CONFIG.logFile) ? readFileSync(CONFIG.logFile, 'utf8') : ''
    const all = content.split('\n').filter(Boolean)
    const tail = all.slice(-LOG_TAIL_LINES)
    // Pad top with empty lines so the block is always exactly LOG_TAIL_LINES tall
    while (tail.length < LOG_TAIL_LINES) tail.unshift('')
    return tail
  } catch {
    return Array(LOG_TAIL_LINES).fill('')
  }
}

function clearLogTailBlock() {
  if (logTailRenderedCount === 0) return
  process.stdout.write(`\x1b[${logTailRenderedCount}A`)
  for (let i = 0; i < logTailRenderedCount; i++) {
    process.stdout.write('\x1b[2K\n')
  }
  process.stdout.write(`\x1b[${logTailRenderedCount}A`)
  logTailRenderedCount = 0
}

function renderLogTail() {
  const lines = getLastLogLines()
  clearLogTailBlock()
  const cols = process.stdout.columns || 80
  for (const line of lines) {
    const truncated = line.length > cols ? line.slice(0, cols - 1) : line
    process.stdout.write(`\x1b[2m${truncated}\x1b[0m\n`)
  }
  logTailRenderedCount = lines.length
}

function startLogTail() {
  renderLogTail()
  logTailInterval = setInterval(renderLogTail, 3000)
}

function stopLogTail() {
  if (logTailInterval) {
    clearInterval(logTailInterval)
    logTailInterval = null
  }
  clearLogTailBlock()
}

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  CONFIG = await loadConfig()
  enableSleepPrevention()
  log('\u2501\u2501\u2501 GitHub daemon started \u2501\u2501\u2501')
  log(`Poll: every ${CONFIG.pollIntervalMs / 1000}s`)
  log(`Agents: ${Object.values(CONFIG.agents).map((a) => a.command).join(', ')}`)
  log(`Repo: ${ROOT}`)
  log(`Logs: ${CONFIG.logFile}`)
  log('Press Ctrl-C to stop.')

  if (CONFIG.userConfig.onStart) {
    try {
      await CONFIG.userConfig.onStart({
        pollIntervalMs: CONFIG.pollIntervalMs,
        logFile: CONFIG.logFile,
        agents: Object.keys(CONFIG.agents),
      })
    } catch (err) {
      log(`Warning: onStart failed: ${err.message}`)
    }
  }

  await validateLabels()

  const runTick = async () => {
    if (activeChild) return // Locally busy
    stopLogTail()
    await tick().catch((err) => log(`ERROR in tick: ${err.message}`))
    startLogTail()
  }

  await runTick()
  setInterval(runTick, CONFIG.pollIntervalMs)
}

async function shutdown(signal) {
  stopLogTail()
  log(`${signal} received \u2014 shutting down.`)
  if (activeChild) {
    log('Killing active claude subprocess...')
    activeChild.kill('SIGTERM')
  }
  if (CONFIG?.userConfig?.onStop) {
    try {
      await CONFIG.userConfig.onStop({ signal })
    } catch (err) {
      log(`Warning: onStop failed: ${err.message}`)
    }
  }
  disableSleepPrevention()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

main()
