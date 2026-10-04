import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import ts from "typescript";

// Run the actual hook with deterministic React scheduling and an in-memory transport.
// This verifies the outbox across saves and remounts without production writes.
function harness(
  rows = new Map<string, any>(),
  storage = new Map<string, string>(),
) {
  const slots: any[] = [];
  let cursor = 0,
    pending = false,
    effects: (() => void)[] = [],
    value: any,
    authChange: any;
  const timers = new Set<() => Promise<void>>();
  let loads = 0;
  const react = {
    useState: (initial: any) => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [
        slots[i],
        (next: any) => {
          const v = typeof next === "function" ? next(slots[i]) : next;
          if (!Object.is(v, slots[i])) {
            slots[i] = v;
            pending = true;
          }
        },
      ];
    },
    useRef: (initial: any) => {
      const i = cursor++;
      return slots[i] ?? (slots[i] = { current: initial });
    },
    useEffect: (fn: any, deps: any[]) => {
      const i = cursor++,
        old = slots[i];
      if (!old || deps.some((d, j) => !Object.is(d, old.deps[j]))) {
        effects.push(() => {
          old?.cleanup?.();
          slots[i] = { deps, cleanup: fn() };
        });
      }
    },
  };
  const db = {
    auth: {
      onAuthStateChange: (fn: any) => {
        authChange = fn;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getUser: async () => ({ data: { user: { id: "owner" } } }),
    },
    from: () => {
      let operation = "select",
        owner = "",
        ids: string[] = [],
        records: any[] = [];
      const q: any = {
        select: () => q,
        eq: (_k: string, v: string) => {
          owner = v;
          return q;
        },
        order: () => q,
        limit: () => q,
        delete: () => {
          operation = "delete";
          return q;
        },
        in: (_k: string, v: string[]) => {
          ids = v;
          return q;
        },
        upsert: (v: any[]) => {
          operation = "upsert";
          records = v;
          return q;
        },
        then: (resolve: any) => {
          if (operation === "select") loads++;
          if (operation === "delete")
            for (const id of ids)
              if (rows.get(id)?.owner_id === owner) rows.delete(id);
          if (operation === "upsert")
            for (const r of records) rows.set(r.id, structuredClone(r));
          return Promise.resolve({
            data: [...rows.values()].filter((r) => r.owner_id === owner),
            error: null,
          }).then(resolve);
        },
      };
      return q;
    },
  };
  const exports: any = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(
        new URL("../src/lib/use-tasks.ts", import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      require: (n: string) => (n === "react" ? react : { supabase: db }),
      localStorage: {
        getItem: (k: string) => storage.get(k) || null,
        setItem: (k: string, v: string) => storage.set(k, v),
        removeItem: (k: string) => storage.delete(k),
      },
      window: { addEventListener() {}, removeEventListener() {} },
      navigator: { onLine: true },
      setInterval: (fn: any) => {
        timers.add(fn);
        return fn;
      },
      clearInterval: (fn: any) => timers.delete(fn),
    },
  );
  async function flush() {
    for (let n = 0; n < 20; n++) {
      if (n === 0 || pending) {
        pending = false;
        cursor = 0;
        value = exports.useTasks();
        const run = effects;
        effects = [];
        run.forEach((f) => f());
      }
      await new Promise((r) => setImmediate(r));
      if (!pending && n > 2) break;
    }
  }
  return {
    rows,
    storage,
    flush,
    get value() {
      return value;
    },
    get loads() {
      return loads;
    },
    async sync() {
      for (const t of [...timers]) await t();
      await flush();
    },
    auth: (id: string) => authChange("TOKEN_REFRESHED", { user: { id } }),
    stop: () => slots.forEach((s) => s?.cleanup?.()),
  };
}
const task = (id: string) => ({
  id,
  title: id,
  context: "Work",
  state: "READY",
  rank: 0,
  due: "",
  archived: false,
  seconds: 0,
  recurrence: "none",
});
test("undo removes a saved recurrence copy from the server and survives remount", async () => {
  const h = harness();
  await h.flush();
  h.value.update([task("original"), task("repeat")]);
  await h.flush();
  await h.sync();
  assert.equal(h.rows.size, 2);
  h.value.update([task("original")]);
  await h.flush();
  await h.sync();
  assert.equal(h.rows.has("repeat"), false);
  assert.equal(h.value.status, "Saved");
  h.stop();
  const reopened = harness(h.rows, h.storage);
  await reopened.flush();
  assert.equal(reopened.value.tasks.length, 1);
  assert.equal(reopened.value.tasks[0].id, "original");
  reopened.stop();
});
test("pending deletion survives closing before sync and cannot delete another owner’s row", async () => {
  const h = harness();
  await h.flush();
  h.value.update([task("original"), task("repeat")]);
  await h.flush();
  await h.sync();
  h.rows.set("other", {
    id: "other",
    owner_id: "someone-else",
    payload: task("other"),
  });
  h.value.update([task("original")]);
  await h.flush();
  h.stop();
  const reopened = harness(h.rows, h.storage);
  await reopened.flush();
  await reopened.sync();
  assert.equal(reopened.rows.has("repeat"), false);
  assert.equal(reopened.rows.has("other"), true);
  reopened.stop();
});
test("token refresh keeps unsaved edits and switching accounts clears them", async () => {
  const h = harness();
  await h.flush();
  h.value.update([task("pending")]);
  await h.flush();
  const loads = h.loads;
  h.auth("owner");
  await h.flush();
  assert.equal(h.loads, loads);
  assert.equal(h.value.tasks[0].id, "pending");
  h.auth("another");
  await h.flush();
  assert.equal(h.value.tasks.length, 0);
  h.stop();
});
