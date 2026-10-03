# Release verification

- 12 engine tests pass, including completion retaining its scheduled time and recording its completion date.
- TypeScript check and optimized production build pass.
- Supabase username/password sign-in succeeds for the configured superadmin.
- Public signup is disabled and the temporary bootstrap route is removed.
- Permanent admin endpoint accepts an authenticated superadmin and rejects malformed creation input without leaving records.
- Transactional database checks deny another user's task reads/writes and direct role escalation. Checks roll back entirely.
- Interactive walkthrough, persisted color changes, real Team profile/job title and mobile Team layout verified in the browser. No horizontal overflow at 390px; no browser errors observed.
- A temporary task was created with the existing admin, scheduled, finished and undone. Its shared version retained its scheduled time after completion. Comments, handoff, date request/approval and shared timer start/pause persisted. The timer displayed the canonical shared record and saved elapsed time. The temporary task was removed; the account has zero private/shared tasks.
- Rolled-back SQL checks verified selected-member visibility, outsider isolation, rejected direct shared writes and role changes, and disabled-account denial despite a stale managed JWT. No new persistent accounts were created.
- Mobile capture, filters, schedule and Team controls fit a 390px viewport. Completion stays visible by default; Show done can hide it. Modal focus and row action menus were checked.

Limits: the user chose checks without new accounts. Full member HTTP flows for password reset, disable/enable and assignment acceptance were reviewed but not exercised against another live account. Shared editing rejects concurrent versions; private task merging, large-account pagination and email recovery are not implemented. Supabase's advisor reports leaked-password protection disabled: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
