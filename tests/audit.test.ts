import test from "node:test";
import assert from "node:assert/strict";
import { themes, resolveTheme } from "../src/lib/themes.ts";
import {
  validDate,
  parseCapture,
  complete,
  newTask,
} from "../src/lib/engine.ts";
import { timelineColumns } from "../src/lib/timeline.ts";
import {
  canAssignRole,
  canManageMember,
  isRole,
  bankSeconds,
} from "../supabase/functions/_shared/permissions.ts";
function luminance(h: string) {
  const n = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return n[0] * 0.2126 + n[1] * 0.7152 + n[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test("ten complete palettes meet text and button contrast requirements", () => {
  assert.equal(Object.keys(themes).length, 10);
  for (const [id, t] of Object.entries(themes)) {
    for (const key of [
      "primary",
      "secondary",
      "accent",
      "background",
      "surface",
      "elevated",
      "text",
      "muted",
      "border",
      "success",
      "warning",
      "error",
      "info",
      "hover",
      "active",
      "focus",
      "disabled",
      "gradient",
    ])
      assert.ok(t.tokens[key], id + key);
    for (const surface of ["background", "surface", "elevated"])
      for (const ink of [
        "text",
        "muted",
        "primary",
        "success",
        "warning",
        "error",
      ])
        assert.ok(
          contrast(t.tokens[ink], t.tokens[surface]) >= 4.5,
          `${id}: ${ink}/${surface}`,
        );
    assert.ok(contrast(t.tokens["on-accent"], t.tokens.accent) >= 4.5, id);
  }
  assert.equal(resolveTheme("__proto__"), "blue");
  assert.equal(resolveTheme("old-theme"), "blue");
});
test("roles enforce least privilege for all role pairs", () => {
  const roles = ["user", "admin", "super_admin"] as const;
  for (const actor of roles)
    for (const target of roles) {
      const expected =
        actor === "super_admin" || (actor === "admin" && target === "user");
      assert.equal(canAssignRole(actor, target), expected);
      assert.equal(canManageMember(actor, target), expected);
    }
  assert.equal(isRole("owner"), false);
});
test("invalid and leap-day dates cannot poison capture or recurrence", () => {
  assert.equal(validDate("2026-02-29"), false);
  assert.equal(validDate("2028-02-29"), true);
  assert.equal(validDate("2026-13-01"), false);
  assert.equal(parseCapture("Task !2026-02-31", 0).due, "");
  const t = {
    ...newTask("Repeat", 0),
    due: "2026-99-99",
    recurrence: "calendar" as const,
  };
  assert.equal(complete(t).length, 2);
});
test("timer banking preserves running seconds and clamps backwards clocks", () => {
  assert.equal(bankSeconds({ seconds: 15, runningSince: 1000 }, 61000), 75);
  assert.equal(bankSeconds({ seconds: 15, runningSince: 61000 }, 1000), 15);
  assert.equal(bankSeconds({ seconds: 15, runningSince: null }), 15);
});
test("overlapping schedule blocks get columns, separate groups reclaim width", () => {
  const task = (id: string, start: string, duration: number) => ({
    ...newTask(id, 0),
    id,
    start: `2026-10-04T${start}`,
    duration,
  });
  const layout = timelineColumns([
    task("a", "09:00", 30),
    task("b", "09:15", 30),
    task("c", "12:00", 30),
  ]);
  assert.notEqual(layout.get("a")!.column, layout.get("b")!.column);
  assert.equal(layout.get("a")!.columns, 2);
  assert.equal(layout.get("c")!.columns, 1);
});
