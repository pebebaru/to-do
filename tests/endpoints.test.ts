import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import ts from "typescript";
import * as permissions from "../supabase/functions/_shared/permissions.ts";
// Exercise the actual deployed handler source with a fake Supabase transport.
// No credentials, users, sessions or production mutations are created.
function endpoint(
  role = "super_admin",
  enabled = true,
  targetRole = "user",
  signed = true,
) {
  const calls: string[] = [];
  const db = {
    auth: {
      getUser: async () => ({
        data: {
          user: signed
            ? { id: "actor", app_metadata: { managed_account: true } }
            : null,
        },
        error: null,
      }),
      admin: {
        createUser: async () => {
          calls.push("create");
          return { data: { user: { id: "new-user" } }, error: null };
        },
        updateUserById: async () => {
          calls.push("auth-update");
          return { error: null };
        },
        deleteUser: async () => ({ error: null }),
      },
    },
    rpc: async () => {
      calls.push("rpc");
      return { error: null };
    },
    from: (table: string) => {
      let id = "",
        operation = "select";
      const q: any = {
        select: () => q,
        eq: (_k: string, v: string) => {
          id = v;
          return q;
        },
        order: () => q,
        range: () => q,
        update: () => {
          operation = "update";
          return q;
        },
        insert: () => {
          operation = "insert";
          return q;
        },
        single: async () => ({
          data:
            id === "actor" ? { id, role, enabled } : { id, role: targetRole },
          error: null,
        }),
        then: (resolve: any) => {
          calls.push(`${table}:${operation}`);
          return Promise.resolve({ data: [], error: null, count: 0 }).then(
            resolve,
          );
        },
      };
      return q;
    },
  };
  let handler: (req: Request) => Promise<Response> = async () => new Response();
  const source = fs.readFileSync(
    new URL("../supabase/functions/account-admin/index.ts", import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports: {},
    require: (name: string) =>
      name.includes("permissions") ? permissions : { createClient: () => db },
    Deno: {
      env: { get: () => "mock" },
      serve: (h: typeof handler) => {
        handler = h;
      },
    },
    Response,
    Request,
  });
  return {
    calls,
    request: (body: unknown, origin = "http://localhost:3000") =>
      handler(
        new Request("https://example.test/account-admin", {
          method: "POST",
          headers: {
            authorization: "Bearer fake",
            origin,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        }),
      ),
  };
}
test("endpoint rejects missing sessions, disabled actors and ordinary users", async () => {
  for (const e of [
    endpoint("user"),
    endpoint("super_admin", false),
    endpoint("super_admin", true, "user", false),
  ]) {
    const r = await e.request({ action: "list" });
    assert.ok([401, 403].includes(r.status));
    assert.deepEqual(e.calls, []);
  }
});
test("admin cannot create administrators or access system records", async () => {
  for (const body of [
    { action: "system" },
    {
      action: "create",
      role: "super_admin",
      username: "sample",
      name: "Sample",
      password: "mock-password-long",
    },
    {
      action: "create",
      role: "admin",
      username: "sample",
      name: "Sample",
      password: "mock-password-long",
    },
  ]) {
    const e = endpoint("admin");
    assert.equal((await e.request(body)).status, 403);
    assert.deepEqual(e.calls, []);
  }
});
test("admin can create a normal user and superadmin can assign all roles", async () => {
  for (const [actor, role] of [
    ["admin", "user"],
    ["super_admin", "user"],
    ["super_admin", "admin"],
    ["super_admin", "super_admin"],
  ]) {
    const e = endpoint(actor);
    assert.equal(
      (
        await e.request({
          action: "create",
          role,
          username: "sample",
          name: "Sample",
          password: "mock-password-long",
        })
      ).status,
      201,
    );
    assert.ok(e.calls.includes("create"));
  }
});
test("admin cannot edit, reset or disable higher roles or assign roles", async () => {
  for (const target of ["admin", "super_admin"])
    for (const action of ["edit", "reset-password", "access", "role"]) {
      const e = endpoint("admin", true, target);
      assert.equal(
        (
          await e.request({
            action,
            id: "target",
            role: "user",
            name: "Name",
            password: "mock-password-long",
            enabled: false,
          })
        ).status,
        403,
      );
      assert.deepEqual(e.calls, []);
    }
});
test("malformed role and untrusted origins do not reach writes", async () => {
  const e = endpoint();
  assert.equal(
    (
      await e.request({
        action: "create",
        role: "root",
        username: "sample",
        name: "Sample",
        password: "mock-password-long",
      })
    ).status,
    403,
  );
  assert.equal(
    (await e.request({ action: "list" }, "https://evil.example")).status,
    403,
  );
  assert.deepEqual(e.calls, []);
});
