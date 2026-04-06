# Open Implementation Plan

Opens an implementation plan in VS Code based on a brief description.

## Trigger

When user says: "I want to open <description>" or "/open-plan <description>"

## Instructions

1. Search for matching plan in `docs/implementation-plans/` (all subfolders: new, ready-for-dev, in-progress, done, canceled)
2. Match by filename or title in frontmatter
3. If found, open in VS Code with: `code <path>`
4. If multiple matches, list them and ask which one
5. If no match, list available plans

## Example

User: "I want to open the landing page plan"
→ Opens `docs/implementation-plans/new/landing-page-auth.md`

User: "I want to open observability"
→ Opens `docs/implementation-plans/done/observability-grafana.md`
