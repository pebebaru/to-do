import { createClient } from "@supabase/supabase-js";
const origins = new Set([
  "https://to-do-kappa-gules.vercel.app",
  "http://localhost:3000",
]);
const uuid = (s: unknown) =>
  typeof s === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
const date = (s: unknown) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  new Date(s).toISOString().slice(0, 10) === s;
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const headers = origins.has(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers":
          "authorization,apikey,content-type,x-client-info",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        Vary: "Origin",
      }
    : {};
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers });
  if (origin && !origins.has(origin))
    return reply({ error: "Origin denied." }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return reply({ error: "Method not allowed." }, 405);
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(token || "");
    if (authError || !user) return reply({ error: "Sign in required." }, 401);
    const { data: actor } = await db
      .from("profiles")
      .select("enabled,role")
      .eq("id", user.id)
      .single();
    if (!actor?.enabled || !user.app_metadata.managed_account)
      return reply({ error: "Account disabled." }, 403);
    const b = await req.json();
    async function people(ids: unknown) {
      if (!Array.isArray(ids) || ids.length > 100 || !ids.every(uuid))
        throw new Error("Choose registered members.");
      const unique = [...new Set(ids)] as string[];
      if (!unique.length) return unique;
      const { data, error } = await db
        .from("profiles")
        .select("id")
        .in("id", unique)
        .eq("enabled", true);
      if (error || data?.length !== unique.length)
        throw new Error("Choose enabled members.");
      return unique;
    }
    if (b.action === "group") {
      if (actor.role !== "super_admin")
        return reply({ error: "Admin only." }, 403);
      const name = String(b.name || "").trim();
      if (!name || name.length > 60)
        return reply({ error: "Use a group name under 60 characters." }, 400);
      const members = await people(b.members);
      const result = b.id
        ? await db
            .from("team_groups")
            .update({ name, members })
            .eq("id", b.id)
            .select()
            .single()
        : await db
            .from("team_groups")
            .insert({ name, members })
            .select()
            .single();
      if (result.error)
        return reply(
          { error: "Could not save group. Name must be unique." },
          400,
        );
      return reply({ group: result.data });
    }
    if (b.action === "share") {
      if (!uuid(b.id))
        return reply({ error: "Choose a saved Work task." }, 400);
      const { data: source } = await db
        .from("tasks")
        .select("*")
        .eq("id", b.id)
        .eq("owner_id", user.id)
        .single();
      if (!source || source.archived || source.context !== "Work")
        return reply(
          { error: "Only your open Work tasks can be shared." },
          400,
        );
      if (source.payload.recurrence !== "none")
        return reply(
          { error: "Turn off repeating before sharing this task." },
          400,
        );
      const viewers = (await people(b.viewers)).filter((id) => id !== user.id);
      const assignee = b.assignee || null;
      if (assignee && assignee !== user.id && !viewers.includes(assignee))
        return reply({ error: "Share with the assignee first." }, 400);
      const { data, error } = await db
        .from("shared_tasks")
        .insert({
          id: source.id,
          owner_id: user.id,
          viewers,
          assignee,
          assignment_status:
            assignee === user.id
              ? "accepted"
              : assignee
                ? "pending"
                : "unassigned",
          payload: {
            ...source.payload,
            runningSince: null,
            state: source.state === "ACTIVE" ? "PAUSED" : source.state,
          },
        })
        .select()
        .single();
      if (error)
        return reply(
          { error: "This task is already shared, or could not be shared." },
          409,
        );
      const moved = await db
        .from("tasks")
        .update({
          archived: true,
          payload: {
            ...source.payload,
            archived: true,
            source: "shared",
            runningSince: null,
          },
        })
        .eq("id", source.id)
        .eq("owner_id", user.id);
      if (moved.error) {
        await db
          .from("shared_tasks")
          .delete()
          .eq("id", source.id)
          .eq("owner_id", user.id);
        return reply({ error: "Could not move task to Team." }, 500);
      }
      return reply({ task: data });
    }
    if (!uuid(b.id)) return reply({ error: "Choose a shared task." }, 400);
    const { data: t } = await db
      .from("shared_tasks")
      .select("*")
      .eq("id", b.id)
      .single();
    if (!t || (t.owner_id !== user.id && !t.viewers.includes(user.id)))
      return reply({ error: "Task unavailable." }, 403);
    if (b.version !== t.version)
      return reply({ error: "Task changed. Refresh and try again." }, 409);
    const owner = t.owner_id === user.id,
      manager =
        owner || (t.assignee === user.id && t.assignment_status === "accepted");
    const patch: Record<string, unknown> = {};
    switch (b.action) {
      case "start":
      case "pause": {
        if (!manager)
          return reply({ error: "Owner or accepted assignee only." }, 403);
        if (t.payload.state === "DONE")
          return reply({ error: "Reopen the task first." }, 400);
        const seconds =
          Number(t.payload.seconds || 0) +
          (t.payload.runningSince
            ? Math.max(
                0,
                Math.floor((Date.now() - t.payload.runningSince) / 1000),
              )
            : 0);
        patch.payload = {
          ...t.payload,
          seconds,
          runningSince: b.action === "start" ? Date.now() : null,
          state: b.action === "start" ? "ACTIVE" : "PAUSED",
        };
        break;
      }
      case "sharing": {
        if (!owner) return reply({ error: "Owner only." }, 403);
        const viewers = (await people(b.viewers)).filter(
            (id) => id !== user.id,
          ),
          assignee = b.assignee || null;
        if (assignee && assignee !== user.id && !viewers.includes(assignee))
          return reply({ error: "Share with the assignee first." }, 400);
        patch.viewers = viewers;
        patch.assignee = assignee;
        patch.assignment_status =
          assignee === t.assignee
            ? t.assignment_status
            : assignee === user.id
              ? "accepted"
              : assignee
                ? "pending"
                : "unassigned";
        break;
      }
      case "take":
        if (t.assignee && t.assignment_status !== "declined")
          return reply({ error: "Task is already assigned." }, 409);
        patch.assignee = user.id;
        patch.assignment_status = "accepted";
        break;
      case "respond":
        if (t.assignee !== user.id || t.assignment_status !== "pending")
          return reply({ error: "No pending assignment." }, 403);
        if (!["accepted", "declined"].includes(b.response))
          return reply({ error: "Choose accept or decline." }, 400);
        patch.assignment_status = b.response;
        break;
      case "comment": {
        const text = String(b.text || "").trim();
        if (!text || text.length > 2000)
          return reply({ error: "Use a comment under 2000 characters." }, 400);
        if (t.comments.length >= 500)
          return reply({ error: "Comment limit reached." }, 400);
        patch.comments = [
          ...t.comments,
          {
            id: crypto.randomUUID(),
            author: user.id,
            text,
            at: new Date().toISOString(),
          },
        ];
        break;
      }
      case "handoff":
        if (!manager)
          return reply({ error: "Owner or accepted assignee only." }, 403);
        if (String(b.text || "").length > 4000)
          return reply({ error: "Use a note under 4000 characters." }, 400);
        patch.handoff = String(b.text || "").trim();
        break;
      case "request-date":
        if (
          !date(b.date) ||
          !String(b.reason || "").trim() ||
          String(b.reason).length > 1000
        )
          return reply({ error: "Choose a valid date and short reason." }, 400);
        patch.due_request = {
          author: user.id,
          date: b.date,
          reason: String(b.reason).trim(),
        };
        break;
      case "resolve-date":
        if (!owner) return reply({ error: "Owner only." }, 403);
        if (!t.due_request || typeof b.approve !== "boolean")
          return reply({ error: "No date request." }, 400);
        if (b.approve)
          patch.payload = { ...t.payload, due: t.due_request.date };
        patch.due_request = null;
        break;
      case "update": {
        if (!b.patch || typeof b.patch !== "object" || Array.isArray(b.patch))
          return reply({ error: "Invalid task fields." }, 400);
        for (const key of ["title", "due", "start", "notes", "state"])
          if (b.patch[key] !== undefined && typeof b.patch[key] !== "string")
            return reply({ error: "Invalid task fields." }, 400);
        if (!manager)
          return reply({ error: "Owner or accepted assignee only." }, 403);
        const p = b.patch || {},
          allowed = [
            "title",
            "due",
            "start",
            "duration",
            "notes",
            "state",
            "actions",
          ];
        if (
          p.actions !== undefined &&
          (!Array.isArray(p.actions) ||
            p.actions.length > 100 ||
            p.actions.some(
              (a: Record<string, unknown>) =>
                !a ||
                !uuid(a.id) ||
                typeof a.title !== "string" ||
                a.title.length > 300 ||
                typeof a.done !== "boolean",
            ))
        )
          return reply({ error: "Invalid task steps." }, 400);
        if (Object.keys(p).some((k) => !allowed.includes(k)))
          return reply({ error: "Invalid task fields." }, 400);
        if (
          p.title !== undefined &&
          (!String(p.title).trim() || String(p.title).length > 300)
        )
          return reply({ error: "Use a short task name." }, 400);
        if (p.due && !date(p.due))
          return reply({ error: "Invalid date." }, 400);
        if (
          p.start &&
          (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(p.start) ||
            !Number.isFinite(new Date(p.start).getTime()))
        )
          return reply({ error: "Invalid time." }, 400);
        if (
          p.duration !== undefined &&
          (!Number.isInteger(p.duration) || p.duration < 0 || p.duration > 1440)
        )
          return reply({ error: "Estimate must be 0–1440 minutes." }, 400);
        if (
          p.notes !== undefined &&
          (typeof p.notes !== "string" || p.notes.length > 4000)
        )
          return reply({ error: "Notes are too long." }, 400);
        if (
          p.state !== undefined &&
          ![
            "TODO",
            "SCHEDULED",
            "PAUSED",
            "WAITING",
            "RESCHEDULED",
            "DONE",
          ].includes(p.state)
        )
          return reply({ error: "Invalid state." }, 400);
        patch.payload = {
          ...t.payload,
          ...p,
          seconds:
            p.state !== undefined
              ? Number(t.payload.seconds || 0) +
                (t.payload.runningSince
                  ? Math.max(
                      0,
                      Math.floor((Date.now() - t.payload.runningSince) / 1000),
                    )
                  : 0)
              : t.payload.seconds,
          runningSince: p.state !== undefined ? null : t.payload.runningSince,
          completedAt:
            p.state === "DONE"
              ? new Date().toISOString()
              : p.state
                ? undefined
                : t.payload.completedAt,
        };
        break;
      }
      default:
        return reply({ error: "Unknown action." }, 400);
    }
    const { data, error } = await db
      .from("shared_tasks")
      .update({
        ...patch,
        version: t.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", t.id)
      .eq("version", t.version)
      .select()
      .maybeSingle();
    if (error) return reply({ error: "Could not save task." }, 500);
    if (!data)
      return reply({ error: "Task changed. Refresh and try again." }, 409);
    return reply({ task: data });
  } catch (e) {
    return reply(
      { error: e instanceof Error ? e.message : "Could not save." },
      400,
    );
  }
});
