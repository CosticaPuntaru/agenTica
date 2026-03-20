---
name: github-auto-implement
description: >
  Automatically picks the next GitHub issue, triages it, implements it using TDD, and opens a PR. 
  Integrates mattpocock-skills for robust automated development.
metadata:
  author: CosticaPuntaru
  version: '2.0'
---

## Purpose

Pick the next unassigned issue from GitHub, investigate it formally, implement it using TDD, and open a PR—all in one shot. 

### How to Run (Daemon Mode)
This skill is designed to be run repeatedly by a daemon. To start the auto-implement loop:

```bash
node resources/scripts/github-daemon.mjs
```

The daemon will poll for `autobot:ready` issues and execute this workflow autonomously.

### Optional Configuration
Create a `.agenTica.js` in your current working directory to customize the experience. Use it to switch between GitHub/GitLab styles or override default constants.

## Step 1: Find the Next Issue

Use `gh issue list` to find ready, unassigned tickets.

```bash
gh issue list --search 'is:open is:issue label:autobot:ready -label:autobot:question -label:autobot:in-progress' --json number,title,url,labels,comments,body
```

- **Skip**: Humans-only tickets or those requiring clarification.
- **Action**: Pick the first ready issue.

## Step 2: Branch Initialization

1. Create a branch: `claude/<issue-number>-<slug>`.
2. Checkout the default branch and branch off.

## Step 3: Triage & Investigation (Investigation Phase)

Instead of jumping into code, investigate the issue formally.
- **Skill**: `triage-issue`
- **Action**: Run `triage-issue` on the picked ticket. Identify the root cause, establish a reproduction case, and draft a TDD-based fix plan. 
- **Checkpoint**: Save the triage result to `.agents/triage/<issue-number>.md`.

## Step 4: Implementation (TDD Phase)

Execute the fix plan using a strict Red-Green-Refactor loop.
- **Skill**: `tdd`
- **Action**: Run the `tdd` skill using the plan generated in the Triage phase. Ensure each requirement has a corresponding test and that all tests pass.

## Step 5: Post-Task Validation (Quality Phase)

Ensure the implementation meets project standards.
- **Skill**: `post-task-validation` (and `react-doctor` if applicable).
- **Action**: Run full validation (linting, type-checking, and all smoke tests). Fix any regressions autonomously.

## Step 6: Documentation & PR Submission

1. **Commit**: `git commit -m "Fixes #<issue-number>: <title>"`
2. **Push**: `git push -u origin <branch>`
3. **PR**: Create a PR using `gh pr create`.
   - **Body**: Reference the triage notes and the TDD results. Provide a summary of changes and a test plan.

## Step 7: Final Status

Print the PR URL as the final output.

## Guardrails

- **🤖 Prefix**: Every comment posted to GitHub MUST start with the 🤖 emoji.
- **Clarification Requested**: If the issue description is ambiguous during Triage:
  1. Comment: `gh issue comment <number> --body "🤖 Need clarification on..."`.
  2. Edit Labels: `gh issue edit <number> --add-label "autobot:question" --remove-label "autobot:in-progress"`.
  3. Output: Print the exact string `CLARIFICATION_REQUESTED` as the final output.
  4. **Stop**: Reset the branch and stop immediately.
- **No `as` Casting**: Follow `typescript-no-as-casting` (Zod validation preferred).
- **Tracer Bullets**: If the task is large, ensures it can be implemented in a single vertical slice.
- **Recursive Grill**: If requirements are unclear during drafting, re-trigger a mini-grill.
