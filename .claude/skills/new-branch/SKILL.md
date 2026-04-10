---
name: new-branch
description: Create a feature branch from an up-to-date main. Use when starting work on a new feature, bug fix, or chore.
---

# New Branch

Creates a feature branch from an up-to-date `main`.

## Trigger

When user agrees to create a new branch, or invokes `/new-branch [branch-name]`.

## Instructions

1. Run `git branch --show-current` to check the current branch
2. If not on `main`, inform the user and ask whether to switch to `main` first or branch from the current branch
3. If on `main` (or after switching), run `git fetch origin main` then compare with `git rev-list HEAD..origin/main --count`:
   - If count > 0: warn that local `main` is behind remote by N commits and run `git pull origin main` before proceeding
   - If count = 0: confirm `main` is up to date
4. Determine the branch name:
   - If provided via arguments, use it directly
   - Otherwise ask the user: "What should the branch be called?"
   - Suggest kebab-case names based on the task description (e.g. `feat/remove-instagram-footer-icon`)
5. Run `git checkout -b <branch-name>` to create and switch to the branch
6. Confirm success: "Switched to new branch `<branch-name>`. You're ready to make changes."

## Branch naming conventions

| Type | Prefix | Example |
|------|--------|---------|
| New feature | `feat/` | `feat/booking-calendar` |
| Bug fix | `fix/` | `fix/auth-refresh-loop` |
| Chore / cleanup | `chore/` | `chore/remove-instagram-icon` |
| Docs | `docs/` | `docs/update-readme` |

## Example

User: "Yes, create a branch"
→ Checks current branch, verifies main is up to date, asks for name, runs `git checkout -b feat/...`

User: `/new-branch chore/remove-instagram-icon`
→ Skips name prompt, creates branch directly after verifying main is current
