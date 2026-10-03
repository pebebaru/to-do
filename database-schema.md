# to:DO database

Versioned migration: supabase/migrations/202610030001_foundation.sql. Profiles hold server-controlled role, workspaces and membership prepare future team use, tasks carry owner/context/state/manual rank and assignment source, child actions/recurrence/time history are validated JSON, notification jobs are platform-neutral. Each table has ownership RLS. Tasks have owner/rank and due-date indexes. Profiles cannot promote themselves; client task owner cannot be reassigned. Workspace support does not grant access to another owner's tasks in this MVP.

No existing remote database has been inspected or modified. Apply to a development project only after inspection. Storage is not used because the product currently needs links rather than uploads.
