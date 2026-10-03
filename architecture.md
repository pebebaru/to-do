# Architecture

Next.js App Router serves a client task interface. Supabase Auth handles username/password sessions through internal email aliases. Public signup is disabled. Managed account metadata and database row policies restrict tasks to their owner. Profiles expose enabled Team names and job titles; users can update only their own display name, job title, theme and walkthrough preference.

The account-admin Edge Function verifies the session and live superadmin role, creates member-only accounts, and compensates failed profile creation by removing the newly created auth record. Its service key stays server-side. The one-time initial setup route has been removed. Gateway JWT checking is enabled.

Tasks persist in Supabase with a per-user browser outbox for reconnect retries. No example tasks are seeded. Local dates and the timer use device time. Completing a task preserves its schedule and stores a completion timestamp. Concurrent-device edits use last-write-wins; up to 1000 tasks load per account.
