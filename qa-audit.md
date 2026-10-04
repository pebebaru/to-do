# to:DO audit — 2026-10-04

## Baseline and flow map

Reviewed the single Next.js route and every component/hook, both Edge Functions, schema, live RLS/grants and the current production UI before implementation. The app is a client-rendered, authenticated workspace: sign in → Today/capture → task editor → schedule/timer → complete/undo/archive/restore. Other flows: steps → Projects; Team → members/groups/sharing → assignment/comments/handoff/date approval; Account → profile/theme/password/walkthrough/sign out. Private tasks use an outbox; shared tasks use server-authorized versioned writes. Public signup remains disabled.

## Findings before fixes

| ID | Severity | Location / reproduction | Expected → actual | Root cause and fix |
| --- | --- | --- | --- | --- |
| Q1 | P1 | Finish repeating task, wait for save, Undo, refresh | Generated copy removed → copy reappears | Outbox only upserts. Persist explicit removed IDs; never delete by absence from a capped snapshot. |
| Q2 | P1 | Switch accounts or refresh a token during unsaved edits | Keep edits scoped and intact → hooks depend on whole User object and can reload | Key loads by user ID; guard stale requests; preserve outbox. |
| Q3 | P1 | Disabled account with old managed JWT reads profiles | No directory access → enabled profiles remain readable | Directory checks claim only. Use live-account helper for all protected reads. |
| Q4 | P1 | Share an active task; add note in shared timer | Preserve elapsed time and resume → active seconds lost or shared timer stays paused | Bank time on share; resume through the canonical shared action. |
| Q5 | P1 | Role creation and management | Three backend-enforced roles → only user/superadmin, no role selection | Add explicit role policy, service-only role mutation, self/last-superadmin safeguards. |
| Q6 | P2 | Edit shared form while another participant saves | Keep draft and show conflict → version key remounts form | Retain draft/base version until intentional reload; reject stale saves. |
| Q7 | P2 | Mobile Account / History / Time | Named controls and all screens reachable → unnamed icon and hidden destinations | Label Account and add compact Account links. |
| Q8 | P2 | Navigate, refresh, Back | Restore selected screen → state resets to Today | Sync existing navigation with an allowlisted URL hash. |
| Q9 | P2 | Narrow schedule, overlapping short events, long text | Readable blocks and forms → fixed event heights and overlapping placement | Add overlap columns, text clipping within blocks, responsive form sizing. |
| Q10 | P2 | Theme selection | Complete palette with accessible visual selector → five accent-only text buttons; many hardcoded colors | Ten full token palettes; preserve blue default; visual swatches and accessible labels. |
| Q11 | P2 | Private task editor / capture dates | Valid title/date/state and stable timer → invalid shortcut date poisons save; ACTIVE can lack timer | Validate dates and bounded inputs; normalize state transitions. |
| Q12 | P2 | Summary after shared work | Consistent totals → shared work omitted from some summaries | Use one canonical personal task collection. |
| Q13 | P3 | Modals, touch controls, spacing, motion | Consistent focus, sizing and calm feedback → duplicate dialog mechanics and variable values | Reuse dialog, normalize spacing/control tokens, subtle optional ambient motion. |

No P0 issue confirmed in the baseline. No new persistent QA accounts will be created, per the user's earlier choice. Authorization tests use isolated mocks and rolled-back database fixtures; report live-account coverage separately.

## Design research

Apple's current [accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility), [layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout), [design tips](https://developer.apple.com/design/tips/) and [reduced-motion criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria) inform readable contrast, adaptable text, generous targets and disabling ambient transforms for reduced motion. This preserves to:DO's dark surfaces and blue identity; it does not copy native iOS components.

## Verification

Results will be appended after implementation and the independent re-test pass. A successful build alone is not acceptance.

## Implementation and re-test — 4 October 2026

Q1–Q13 have code fixes in this release. The backend changes are applied to the existing Supabase project; both functions retain gateway JWT verification. A second migration removes three per-row authorization performance warnings without broadening access.

### Evidence

- **Automated tests:** 25 pass. Includes the actual task hook with a deterministic React/transport harness: saved recurrence deletion, pending deletion after remount, other-owner isolation, and token-refresh/account-switch behavior. Actual account-admin handler is exercised with a mocked transport across role and origin boundaries. These are not browser E2E tests.
- **Lint:** passes with no warnings. TypeScript and JSX accessibility rules run through `npm run lint`; dialog key-event exceptions document focus-trap behavior.
- **Type checking:** passes (`tsc --noEmit`).
- **Build:** Next production webpack build passes. Repeated successfully after the final source edits.
- **Dependencies:** npm audit reports zero known vulnerabilities after updating the lint tooling.
- **Live authorization:** existing superadmin password sign-in, directory and System endpoints return 200; anonymous System request returns 401. One real account, zero private/shared task records at verification. Test session signed out locally; no account records changed.
- **Database:** rolled-back fixtures verify role assignment, Admin promotion denial, self-demotion denial, column privilege denial for direct role changes, disabled stale-token isolation, owner/participant boundaries, invalid-recipient rollback, atomic sharing and elapsed-time banking. `supabase/tests/roles-security.sql` passed again after the final RLS migration. No persistent QA accounts were created.
- **Responsive browser pass:** Today, Schedule, Projects, Team and Account at 320, 375, 390, 414, 430, 768, 834, 1024, 1280, 1440 and 1920 pixels (55 empty-state combinations): no document horizontal overflow. Multi-day schedules intentionally scroll within their own container.
- **Theme browser pass:** all ten palettes were selected; each changed background tokens and selected state, with no visible selector names. The original violet preference was restored. A subsequent Account inspection showed it selected.
- **Contrast:** all ten palettes pass automated 4.5:1 checks for main text, muted text, primary and status colors against the three surface tokens, plus primary-button text. This does not claim every blended pixel or every UI state was visually sampled.
- **Design:** shared spacing/radius/control tokens, full semantic palettes, 44px controls, larger mobile field text, responsive forms, labeled Account button, reachable History/Time, retained shared drafts, and overlap columns. Wordless completion feedback remains; subtle ambient gradients stop moving under reduced motion.

### Remaining limits and follow-up checks

- Browser automation stopped after reconnecting: the tool rejected the localhost page under its URL security policy. No workaround was attempted. The remaining populated-screen, keyboard-cycle, Back/Forward, member-preview and final production browser pass are **not completed**. Earlier browser observations above are retained as scoped evidence, not full E2E acceptance.
- No live second account was created, per user preference. Actual cross-account browser collaboration, real password reset and enable/disable journeys were not exercised; mocked handlers and rolled-back database checks cover their authorization boundaries.
- Reduced-motion CSS was inspected; the operating-system preference was not emulated.
- Supabase [leaked-password protection remains disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The audit did not change the authentication plan/settings or the user's password. The empty bootstrap table intentionally has deny-all RLS. Unused-index notices are informational on the empty shared-task table; retain the access indexes for future data.
- Existing limits remain: private tasks use last-write-wins and load at most 1000 records; push notifications and email recovery are not configured. System record inspection is read-only; it does not impersonate other accounts.

### Role boundary

Normal users manage their own tasks and participate in explicitly shared tasks. Admins additionally manage normal-user accounts and team groups. Superadmins additionally manage roles and all member accounts and read the paginated System view. All roles retain normal task capabilities. Member preview hides management controls while keeping the caller's own data; it is not a change of authorization.

### Deployment packaging correction

The first cloud build caught an upload-only failure: `.vercelignore` excluded the shared permission module imported by the frontend. The upload rules now include `supabase/functions/_shared/` while continuing to exclude migrations and endpoint source. This explains why the local build passed while the first Vercel build failed; the cloud build must pass before this release is considered deployed.
