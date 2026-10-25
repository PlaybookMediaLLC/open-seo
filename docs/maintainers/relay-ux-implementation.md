# Relay UX implementation

Implements the 20 findings from the 25 October 2026 audit. Existing project URLs, tenant authorization, billing checks, and explicit publishing approval remain in place. Private audit captures are not included in the branch.

| Finding | Delivered behavior                                                                                                                                    | Coverage                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| F01     | Native browser scale; no zoom or portal compensation; larger mobile controls                                                                          | Desktop and 390px screenshots                              |
| F02     | Pending reviews and readiness lead the weekly summary; no completed-detection claim before a run                                                      | Summary and cycle tests                                    |
| F03     | Home, Work, Research, Monitor, Library with contextual views and task search                                                                          | Route tests and browser project-scope checks               |
| F04     | Prepared change first, evidence and review beside it, details below; narrow-screen section links                                                      | Complete publishing browser flow, desktop/mobile captures  |
| F05     | Revoked GitHub App state blocks execution while retaining readable drafts                                                                             | Existing revocation service tests and permission checks    |
| F06     | Organization balance distinct from caps; keyword/domain estimates use metering prices; AI setup states variable research and recurring tracking costs | Cost tests, billing regression suite, browser cost preview |
| F07     | One primary AI visibility entry, shared setup and contextual Discover/Explore/Track views                                                             | Type checks and route review                               |
| F08     | Your site / Another site updates draft inputs; existing project history and markets retained                                                          | Form/caller review; browser draft does not launch research |
| F09     | Task search and project-scoped agent briefs with sources, output, approval and return instructions                                                    | Task dialog and navigation browser checks                  |
| F10     | Current rank-check uncertainty, no dated promise, Search Performance alternative                                                                      | Current service and call-site review                       |
| F11     | Optional setup collapsed; provider setup limited to relevant tasks                                                                                    | Route test and Home browser check                          |
| F12     | One Find opportunities disclosure with four methods; advanced filters collapsed                                                                       | Detection browser flow                                     |
| F13     | Saved collection has an actionable empty state without empty table controls                                                                           | Mobile browser check                                       |
| F14     | Search Performance labels periods, load time, missing metrics and sparse evidence                                                                     | Component and source-field review                          |
| F15     | Latest completed audit opens on issues; history/new audit remain available; issue briefs are copyable                                                 | Type checks and audit result/navigation review             |
| F16     | Business context language, labeled schedule/quality fields, split-test examples and affected-page preview                                             | Preview service tests, tenant checks                       |
| F17     | Shared native-scale radius and existing control variants                                                                                              | Visual review                                              |
| F18     | Skip link, accessible control names and directional table sort state                                                                                  | Keyboard browser check, responsive reflow check            |
| F19     | Errors retain panel identity; cached proposal/evidence remain readable and approval waits for freshness                                               | Error-path review and existing service regressions         |
| F20     | Saving settings preserves activation; enabling/pausing is explicit; first/next run is shown                                                           | Real SQLite and PostgreSQL persistence tests               |

## Verification

- `pnpm ci:check` passed: formatting, unused-code checks, all three TypeScript projects, type-aware lint and plugin-copy consistency.
- `pnpm build` passed for app, report widgets and audit worker.
- Final full Vitest run: all 3,099 tests across 402 files passed (45.6 seconds).
- A fresh, disposable PostgreSQL 16 database was migrated, passed 20 work/split-test cases, and was stopped. SQLite is exercised by the main suite.
- Both browser tests passed (19.5 seconds): the full publishing workflow, project scope, keyboard skip link, native-scale Home, 390px reflow, task search, cost preview without a query, and saved-keyword empty state.
- Browser captures use local provider fixtures. They do not demonstrate live Google/GitHub/provider behavior or a production deployment. Not every error/setup state has a screenshot, and this is not a participant usability study or a formal accessibility certification.
- Code graph and Gauntlet were unavailable in this environment; direct code/caller review and the repository checks were used.

No database migration, production configuration or deployed resource is changed by this PR. Temporary local auth settings and test databases are excluded from the commit.
