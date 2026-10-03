# to:DO

Task planning app using Next.js 16, React, TypeScript and Supabase. The interface follows the supplied Stitch design, with blue as the default and optional mint, violet, amber and rose accents.

## Run

Install dependencies with `npm install`. Copy `.env.example` to `.env.local`, set the Supabase URL and publishable key, then run `npm run dev`. Without cloud configuration the app shows a setup screen; it does not seed example tasks.

## Accounts and storage

Public signup is disabled. Sign in with an administrator-created username and password. Usernames map internally to `@accounts.todo.invalid`; email delivery and password recovery are not configured. Only an enabled superadmin can create accounts through Team → Add user. Account creation always assigns the member role.

Supabase stores profiles, themes, onboarding preferences and tasks. Database policies isolate each user's tasks. Managed users can view enabled Team names and job titles. The account-admin Edge Function validates the session and the caller's current database role on every request. Service credentials stay in the Edge Function environment. The temporary admin bootstrap route has been removed and gateway JWT validation is enabled.

The approved schema is in `supabase/migrations/20261003174858_account_management.sql`. Deploy the permanent function from `supabase/functions/account-admin`. Disable public signup in Supabase Auth. Never place service-role keys or passwords in browser environment variables.

## Behavior

Completed tasks retain their scheduled time and remain visible in Schedule and History. Completion shows a short wordless sparkle; reduced-motion settings suppress movement. The first launch includes an interactive walkthrough. Dates and clocks use the device's local time zone. The browser caches pending task changes for retry when connectivity returns; Supabase is the persistent store.

## Deployment and checks

Repository: https://github.com/pebebaru/to-do
Production: https://to-do-kappa-gules.vercel.app

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel before building. Deploy directly with `vercel --prod` to the linked Pebe project. Automatic GitHub deployments are not connected.

Run `npm test`, `npm run typecheck` and `npm run build`. Release checks cover sign-in, onboarding, saved theme changes, admin endpoint validation and rolled-back database checks for cross-user read/write isolation and role escalation. No persistent test users are retained.

## Limits

Concurrent-device edits use last-write-wins. Up to 1000 tasks are loaded; larger accounts need pagination. Background push and email recovery are not configured.
