# 🤖 GitHub Auto-Implement Skill

An autonomous agentic worker that picks up GitHub issues, triages them, implements the fix using TDD, and opens a Pull Request—completely unattended.

## ✨ Features

- **Autonomous Issue Picking**: Automatically finds issues labeled with `autobot:ready`.
- **Formal Triage**: Investigates the root cause and creates a reproduction case before touching code.
- **TDD Loop**: Uses Red-Green-Refactor cycles to ensure reliable implementations.
- **Epic Awareness**: Resolves base branches automatically for tasks belonging to an Epic.
- **PR Chaining**: Targets the correct branch for tasks that depend on other open Pull Requests.

## 📦 Installation

To install this skill into your local project, run:

```bash
npx skills add ./github-auto-implement -y
```

## 🛠️ How to Use

This skill is designed to be run via a daemon that polls for new work.

### 1. Start the Daemon

You can run the daemon directly using `npm`:

```bash
npm run autobot
```

Or manually via node:

```bash
node resources/scripts/github-daemon.mjs
```

### 2. Configure Issues

To make an issue visible to the daemon:
1. Label the issue with `autobot:ready` (or your custom label).
2. Ensure it is unassigned.
3. (Optional) For Epic integration, add `Parent PRD: #<issue-id>` to the issue body.

## ⚙️ Configuration

Create a `.agenTica.ts` (or `.js`) file in your project root to customize:
- `ready` labels.
- Skip labels.
- Lifecycle hooks (over 40 available hooks).
- Model and agent selection.

## ⚠️ Requirements

- GitHub CLI (`gh`) must be authenticated.
- Vitest or a compatible test runner for the TDD phase.
