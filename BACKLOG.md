# GitTidy — Parking Lot / Future Work Backlog

Items that require GitHub PAT or GitHub App tokens, or are otherwise deferred.

## Requires Auth (PAT / GitHub App)

- [ ] **GraphQL project associations** — query `repository.projectsV2` and `issue.projectsV2` for richer project data (descriptions, status, custom fields) beyond what the sidebar DOM provides
- [ ] **Cross-repo project awareness** — show which other repos are in the same project(s) via API
- [ ] **Issue field enrichment** — display custom project fields (priority, effort, iteration) inline on issue list pages
- [ ] **Bulk field updates from browser** — update status/priority/assignee across multiple issues via GraphQL mutations
- [ ] **Issue creation helper** — pre-populate issue templates with project field defaults

## UI Enhancement Ideas (No Auth)

- [ ] **Quick-copy issue reference** — one-click copy of `org/repo#123` formatted link
- [ ] **Sticky issue/PR title** — keep title visible when scrolling long threads
- [ ] **Highlight OP comments** — visual indicator for original poster's follow-up comments
- [ ] **Collapse all / expand all** timeline events button
- [ ] **Keyboard shortcuts** — hotkeys for noise toggle (e.g., `Alt+N`)
- [ ] **Custom noise profiles** — save different toggle configurations by project/repo

## Separate Extension Ideas (GitTidy Agent)

- [ ] **Copilot CLI extension** — natural language commands for issue management
- [ ] **Bulk board operations** — "move all Backlog items to In Progress"
- [ ] **AI-assisted triage** — summarize unassigned/stale issues
- [ ] **Issue creation from natural language** — "create a bug for the auth timeout in cordillera"
