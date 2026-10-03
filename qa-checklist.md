# Release verification

- 12 engine tests pass, including completion retaining its scheduled time and recording its completion date.
- TypeScript check and optimized production build pass.
- Supabase username/password sign-in succeeds for the configured superadmin.
- Public signup is disabled and the temporary bootstrap route is removed.
- Permanent admin endpoint accepts an authenticated superadmin and rejects malformed creation input without leaving records.
- Transactional database checks deny another user's task reads/writes and direct role escalation. Checks roll back entirely.
- Interactive walkthrough, persisted color changes, real Team profile/job title and mobile Team layout verified in the browser. No horizontal overflow at 390px; no browser errors observed.
- A task was created, finished, visibly retained in Schedule and verified as DONE in Supabase. The test task was then removed under the requested account reset. The account starts with zero tasks and first-launch walkthrough enabled.

Limits: no permanent secondary test user was created. Full added-member sign-in testing remains a follow-up. Concurrent-device merging, large-account pagination and email recovery are not implemented.
