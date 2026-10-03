# Architecture

Next.js App Router serves a client task interface. Supabase Auth handles username/password sessions through internal email aliases. Public signup is disabled. Managed account metadata and database row policies restrict tasks to their owner. Profiles expose enabled Team names and job titles; users can update only their own display name, job title, theme and walkthrough preference.

The account-admin Edge Function verifies the session and live superadmin role, creates member-only accounts, and compensates failed profile creation by removing the newly created auth record. Its service key stays server-side. The one-time initial setup route has been removed. Gateway JWT checking is enabled.

Tasks persist in Supabase with a per-user browser outbox for reconnect retries. No example tasks are seeded. Local dates and the timer use device time. Completing a task preserves its schedule and stores a completion timestamp. Private edits use last-write-wins; up to 1000 tasks load per account.

Shared Work tasks have an explicit owner, recipient list, optional assignee and assignment state. Their canonical record holds the task payload, comments, handoff note and date request. The original private record is archived with source `shared` and omitted from private history. Timers read the shared record, bank elapsed seconds on server-side pause and preserve the schedule on completion. Repeating tasks cannot be shared.

Clients can read only shared records where they are the owner or a selected recipient and their managed profile is enabled. Client writes are revoked. The team-tasks function validates the current profile and participants, restricts editing to the owner or accepted assignee, and uses a version predicate for atomic updates. Groups are directory records maintained by superadmins; selecting a group copies its current members into the sharing selection.

The account-admin function also lists disabled members for superadmins, edits name/job title, resets member passwords and changes account access. It cannot promote roles or disable/reset the superadmin through member actions. Live enabled-profile checks protect private and shared reads after access is disabled.
