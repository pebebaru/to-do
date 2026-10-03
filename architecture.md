# to:DO architecture

Next.js App Router / React / TypeScript. Modular execution engine, store, task editor, focus surface, and application shell. A single task entity contains optional child actions and recurrence metadata; schedule commitments are distinct fields from deadlines. Deterministic recommendations honor manual order, exclude waiting/dependencies, and respect availability.

Supabase Auth and Postgres with mandatory owner RLS. Browser uses only public anonymous credentials. No service-role key is needed. Per-user offline outbox retries idempotent task upserts; local preview is isolated from authenticated caches. Remote conflicts use last successful write and are a release limitation for concurrent devices. No realtime is necessary for this initial slice. Database supports workspace membership and assignment metadata, but MVP access stays owner-only.

No external accounts were accessible during discovery. Vercel and Supabase plugins were suggested. Do not apply migrations or deploy to production until external inspection and hosted QA are complete.

Cloud snapshots include archived records (bounded to 1000 total) so archive recovery survives reload. Successfully fetched snapshots are cached. Storage failures show a clear export warning instead of falsely claiming durable persistence. Reminder delivery is modular, permission-gated, deduplicated per decision, and limited by a daily session budget.
