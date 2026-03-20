---
name: skill-auditor
description: Audits SKILL.md files against write-a-skill conventions — checks line count, description format, frontmatter completeness, and content quality. Use when asked to audit a skill, validate skill conventions, or review skill quality.
---

# Skill Auditor

## Quick start

```bash
node skill-auditor/scripts/audit.mjs <path-to-skill-or-directory>
```

Examples:
```bash
node skill-auditor/scripts/audit.mjs epic-workflow
node skill-auditor/scripts/audit.mjs epic-workflow/SKILL.md
node skill-auditor/scripts/audit.mjs .agents/skills/tdd
```

## Workflow

1. **Run the script** — outputs a pass/fail report for all mechanical checks
2. **Review flagged items** — fix each `FAIL` in the SKILL.md
3. **Content review** — for each skill, manually check:
   - [ ] First sentence describes what the skill *does* (capability, not intent)
   - [ ] "Use when" triggers are specific enough to distinguish from similar skills
   - [ ] No time-sensitive info (dates, version numbers, "currently", "now")
   - [ ] At least one concrete example (not just abstract description)
   - [ ] Any referenced files exist and are one level deep only

## Checks performed by script

| Check | Rule |
|-------|------|
| Frontmatter present | Must have `---` block at top |
| `name` field | Required in frontmatter |
| `description` field | Required in frontmatter |
| Description length | ≤ 1024 characters |
| "Use when" present | Description must contain "Use when" |
| Line count | SKILL.md must be ≤ 100 lines |
