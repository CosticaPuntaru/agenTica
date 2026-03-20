#!/usr/bin/env node
/**
 * Skill Auditor
 * Checks SKILL.md files against write-a-skill conventions.
 * Usage: node audit.mjs <path-to-skill-or-directory>
 */

import { readFileSync, existsSync, statSync } from 'fs'
import { resolve, join, basename } from 'path'

const target = process.argv[2]

if (!target) {
  console.error('Usage: node audit.mjs <path-to-skill-or-directory>')
  process.exit(1)
}

const targetPath = resolve(process.cwd(), target)

if (!existsSync(targetPath)) {
  console.error(`Path not found: ${targetPath}`)
  process.exit(1)
}

// Resolve to SKILL.md
const skillPath = statSync(targetPath).isDirectory()
  ? join(targetPath, 'SKILL.md')
  : targetPath

if (!existsSync(skillPath)) {
  console.error(`No SKILL.md found at: ${skillPath}`)
  process.exit(1)
}

// ── Checks ────────────────────────────────────────────────────────────────────

const content = readFileSync(skillPath, 'utf8')
const lines = content.split('\n')

const results = []

function check(name, pass, detail = '') {
  results.push({ name, pass, detail })
}

// 1. Frontmatter present
const hasFrontmatter = content.startsWith('---')
check('Frontmatter present', hasFrontmatter, hasFrontmatter ? '' : 'File must start with --- frontmatter block')

// Parse frontmatter
let frontmatter = {}
if (hasFrontmatter) {
  const end = content.indexOf('\n---', 3)
  if (end !== -1) {
    const block = content.slice(3, end)
    for (const line of block.split('\n')) {
      const m = line.match(/^(\w+):\s*(.+)/)
      if (m) frontmatter[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
    }
  }
}

// 2. name field
check('`name` field present', !!frontmatter.name, frontmatter.name ? '' : 'Add name: <skill-name> to frontmatter')

// 3. description field
const desc = frontmatter.description ?? ''
check('`description` field present', !!desc, desc ? '' : 'Add description: ... to frontmatter')

// 4. Description length
const descLen = desc.length
check(
  `Description ≤ 1024 chars (${descLen})`,
  descLen <= 1024,
  descLen > 1024 ? `Trim by ${descLen - 1024} characters` : '',
)

// 5. "Use when" in description
const hasUseWhen = /use when/i.test(desc)
check(
  '"Use when" in description',
  hasUseWhen,
  hasUseWhen ? '' : 'Add "Use when [specific triggers]" to description',
)

// 6. Line count
const lineCount = lines.length
check(
  `Line count ≤ 100 (${lineCount})`,
  lineCount <= 100,
  lineCount > 100 ? `Over by ${lineCount - 100} lines — consider splitting into REFERENCE.md` : '',
)

// ── Output ────────────────────────────────────────────────────────────────────

const PASS = '\x1b[32m✔ PASS\x1b[0m'
const FAIL = '\x1b[31m✘ FAIL\x1b[0m'

console.log(`\nAudit: ${skillPath}\n`)

let failCount = 0
for (const r of results) {
  const status = r.pass ? PASS : FAIL
  if (!r.pass) failCount++
  console.log(`  ${status}  ${r.name}${r.detail ? `\n         → ${r.detail}` : ''}`)
}

console.log(`\n${failCount === 0 ? '\x1b[32mAll checks passed.\x1b[0m' : `\x1b[31m${failCount} check(s) failed.\x1b[0m`}\n`)

process.exit(failCount > 0 ? 1 : 0)
