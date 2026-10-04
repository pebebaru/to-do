import { isAdmin, isRole, canAssignRole, canManageMember } from "../_shared/permissions.ts";
import { createClient } from "@supabase/supabase-js";
const origins = new Set([
  "https://to-do-kappa-gules.vercel.app",
  "http://localhost:3000",
]);
const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const reply = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: origin && origins.has(origin) ? cors(origin) : {},
    });
  if (origin && !origins.has(origin))
    return reply({ error: "Origin denied." }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST")
    return reply({ error: "Method not allowed." }, 405);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  try {
    const body = await req.json();
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Sign in required." }, 401);
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user)
      return reply({ error: "Sign in required." }, 401);
    const { data: actor } = await admin
      .from("profiles")
      .select("role,enabled")
      .eq("id", auth.user.id)
      .single();
    if (!actor?.enabled || !auth.user.app_metadata.managed_account || !isAdmin(actor.role))
      return reply({ error: "Admin only." }, 403);
    if (body.action === "list") {
      const { data, error } = await admin
        .from("profiles")
        .select(
          "id,username,display_name,job_title,role,theme,onboarded,enabled",
        )
        .order("display_name");
      return error
        ? reply({ error: "Could not load members." }, 500)
        : reply({ members: data });
    }
    if (body.action === "system") {
      if (actor.role !== "super_admin") return reply({ error: "Superadmin only." }, 403);
      const offset = Number.isInteger(body.offset) && body.offset >= 0 ? body.offset : 0;
      const [profiles, tasks, shared] = await Promise.all([
        admin.from("profiles").select("id", { count: "exact", head: true }),
        admin.from("tasks").select("id,owner_id,title,context,state,archived,payload", { count: "exact" }).order("created_at").order("id").range(offset, offset + 49),
        admin.from("shared_tasks").select("id,owner_id,payload,updated_at", { count: "exact" }).order("updated_at").order("id").range(offset, offset + 49),
      ]);
      if (profiles.error || tasks.error || shared.error) return reply({ error: "Could not load system records." }, 500);
      return reply({ accounts: profiles.count, privateCount: tasks.count, sharedCount: shared.count, tasks: tasks.data, shared: shared.data, offset });
    }
    if (["edit", "role", "access", "reset-password"].includes(body.action)) {
      const { data: target } = await admin
        .from("profiles")
        .select("id,role")
        .eq("id", String(body.id || ""))
        .single();
      if (!target) return reply({ error: "Member unavailable." }, 404);
      if (!canManageMember(actor.role, target.role)) return reply({ error: "You can manage normal users only." }, 403);
      if (body.action === "role") {
        if (actor.role !== "super_admin" || !isRole(body.role)) return reply({ error: "Superadmin and a valid role required." }, 403);
        const { error } = await admin.rpc("manage_member", { actor_id: auth.user.id, target_id: target.id, new_role: body.role });
        return error ? reply({ error: "Role unchanged. Keep your own access and an enabled superadmin." }, 400) : reply({ ok: true });
      }
      if (body.action === "edit") {
        const name = String(body.name || "").trim(),
          job = String(body.job_title || "").trim();
        if (!name || name.length > 80 || job.length > 100)
          return reply({ error: "Check name and job title." }, 400);
        const { error } = await admin
          .from("profiles")
          .update({ display_name: name, job_title: job })
          .eq("id", target.id);
        return error
          ? reply({ error: "Could not update member." }, 500)
          : reply({ ok: true });
      }
      if (target.id === auth.user.id)
        return reply(
          {
            error:
              "Use Account for your own password. Your own access cannot be disabled here.",
          },
          400,
        );
      if (body.action === "reset-password") {
        if (typeof body.password !== "string" || body.password.length < 10)
          return reply({ error: "Use at least 10 characters." }, 400);
        const { error } = await admin.auth.admin.updateUserById(target.id, {
          password: body.password,
        });
        return error
          ? reply({ error: "Could not reset password." }, 500)
          : reply({ ok: true });
      }
      if (typeof body.enabled !== "boolean")
        return reply({ error: "Choose enable or disable." }, 400);
      // Disable database access first. A failed Auth update remains fail-closed.
      if (!body.enabled) {
        const { error } = await admin.rpc("manage_member", { actor_id: auth.user.id, target_id: target.id, new_enabled: false });
        if (error) return reply({ error: "Access unchanged. Keep an enabled superadmin." }, 400);
      }
      const { error: authChange } = await admin.auth.admin.updateUserById(
        target.id,
        {
          ban_duration: body.enabled ? "none" : "876000h",
          app_metadata: { managed_account: body.enabled },
        },
      );
      if (authChange) return reply({ error: "Could not change access." }, 500);
      const { error } = body.enabled ? await admin.rpc("manage_member", { actor_id: auth.user.id, target_id: target.id, new_enabled: true }) : { error: null };
      return error
        ? reply({ error: "Could not save access. Retry." }, 500)
        : reply({ ok: true });
    }
    if (body.action !== "create")
      return reply({ error: "Unknown action." }, 400);
    const username = String(body.username || "")
        .trim()
        .toLowerCase(),
      password = String(body.password || ""),
      name = String(body.name || "").trim(),
      job = String(body.job_title || "").trim();
    if (
      !/^[a-z0-9_]{3,32}$/.test(username) ||
      password.length < 10 ||
      !name ||
      name.length > 80 ||
      job.length > 100
    )
      return reply(
        {
          error: "Check username, name, and password (10 characters minimum).",
        },
        400,
      );
    const role = body.role === undefined ? "user" : body.role;
    if (!isRole(role) || !canAssignRole(actor.role, role)) return reply({ error: "You cannot assign that role." }, 403);
    const { data, error } = await admin.auth.admin.createUser({
      email: `${username}@accounts.todo.invalid`,
      password,
      email_confirm: true,
      app_metadata: { managed_account: true },
      user_metadata: { display_name: name },
    });
    if (error || !data.user)
      return reply(
        { error: "Could not add user. The username may already exist." },
        400,
      );
    const { error: profileError } = await admin.from("profiles").insert({
      id: data.user.id,
      username,
      display_name: name,
      job_title: job,
      role,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return reply({ error: "Could not save account." }, 500);
    }
    return reply(
      {
        user: {
          id: data.user.id,
          username,
          display_name: name,
          job_title: job,
          role,
        },
      },
      201,
    );
  } catch {
    return reply({ error: "Could not process request." }, 400);
  }
});
