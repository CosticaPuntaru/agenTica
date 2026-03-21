# 🚀 Epic Workflow Skill

An end-to-end autonomous planning system for large features (Epics). This skill guides you through requirement drilling, PRD generation, issue decomposition, and branch initialization.

## ✨ Features

- **Requirement Drilling**: Deep-dive into technical requirements with a recursive "Grill" phase.
- **PRD Generation**: Automatically drafts a Product Requirements Document based on codebase research.
- **Auto-Decomposition**: Breaks down large features into "tracer-bullet" vertical slices.
- **GitHub Integration**: Creates parent issues, task roadmaps, and feature branches automatically.
- **Dependency Tracking**: Handles issue-level dependencies (`Blocked by: #123`) for complex workflows.

## 📦 Installation

To install this skill into your local project, run:

```bash
npx skills add ./epic-workflow -y
```

## 🛠️ How to Use

Simply mention the workflow in your conversation with the agent. The skill is triggered by keywords such as:

- "Start a new epic"
- "Plan this feature"
- "Epic workflow"

### Workflow Phases

1. **Discovery**: The agent maps the codebase to understand the context.
2. **Grilling**: A back-and-forth session to resolve all design ambiguities.
3. **Drafting**: Creation of the PRD (`resources/prd.md`).
4. **Planning**: Decomposition into independent GitHub issues.
5. **Execution**: Creation of the Epic issue and task branch.

## ⚠️ Requirements

- GitHub CLI (`gh`) must be authenticated.
- A project structure compatible with `.agents/epics/`.
