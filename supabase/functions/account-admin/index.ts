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
    if (!actor?.enabled || actor.role !== "super_admin")
      return reply({ error: "Admin only." }, 403);
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
    const role = "user";
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
