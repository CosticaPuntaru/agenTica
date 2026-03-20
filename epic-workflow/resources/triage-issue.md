---
name: Triage Bug Report
about: Create a root cause analysis and TDD fix plan for a bug
title: 'Fix: '
labels: 'bug, triage'
assignees: ''
---

## Problem

A clear description of the bug or issue, including:

- What happens (actual behavior)
- What should happen (expected behavior)
- How to reproduce (if applicable)

## Root Cause Analysis

Describe what you found during investigation:

- The code path involved
- Why the current code fails
- Any contributing factors

## TDD Fix Plan

A numbered list of RED-GREEN cycles:

1. **RED**: Write a test that [describes expected behavior]
   **GREEN**: [Minimal change to make it pass]

**REFACTOR**: [Any cleanup needed after all tests pass]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] All new tests pass
- [ ] Existing tests still pass
