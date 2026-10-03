# to:DO product specification

Primary loop: capture → choose Next → start → focus → finish. One task pool, Personal and Work contexts. Manual order wins; recommendations never move tasks. Today separates explicit commitments, later tasks, and waiting. Scheduling is optional. Focus records real elapsed time and offers a checkpoint when estimates are exceeded.

Implemented scope: local preview and authenticated Supabase task CRUD, child actions, manual ordering, contexts, list/schedule/split, commitments and overlap warnings, focus/pause/done, due recovery, snooze counts, recurrence, people follow-ups, links, settings, and export. Notification permission is requested only through a user action. Preview mode is explicitly device-local and uses example data. Cloud mode requires sign-in and configured environment variables.

Release gates: apply migration to an inspected Supabase development project, verify cross-user RLS and authentication, test browser permission/reminders, Vercel preview QA, then production approval. Hosted push delivery and collaboration UI are deferred; no claim of production readiness until external gates pass.

Natural-language date parsing is deferred; capture preserves exact input and optional dates are edited explicitly. Dependency metadata and assignments are represented in the model but do not have authoring/collaboration screens yet. Assistant styles currently affect reminder budget and explanation visibility; advanced proactive scheduling proposals and estimate-learning are future work. The manifest provides PWA metadata; an offline app-shell service worker and raster install icons remain release work.
