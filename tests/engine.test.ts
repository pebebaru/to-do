import { test } from "node:test";
import assert from "node:assert/strict";
import {
  complete,
  day,
  elapsed,
  newTask,
  parseCapture,
  overlaps,
  recommend,
} from "../src/lib/engine.ts";
test("quick capture separates context, priority, estimate and relative date from title", () => {
  const t = parseCapture(
    "Call Andre @personal #p1 ~45m !tomorrow",
    7,
    new Date("2026-10-03T12:00:00"),
  );
  assert.equal(t.title, "Call Andre");
  assert.equal(t.context, "Personal");
  assert.equal(t.priority, 1);
  assert.equal(t.duration, 45);
  assert.equal(t.due, "2026-10-04");
  assert.equal(t.rank, 7);
  assert.equal(t.committed, false);
});
test("quick capture commits today without starting the timer or removing unknown words", () => {
  const t = parseCapture(
    "Review @vendor !today ~9999m",
    0,
    new Date("2026-10-03T12:00:00"),
  );
  assert.equal(t.title, "Review @vendor");
  assert.equal(t.committed, true);
  assert.equal(t.duration, 1440);
  assert.equal(t.state, "TODO");
  assert.equal(t.runningSince, null);
});
test("manual order wins over priority", () => {
  const a = newTask("Intentional first", 0),
    b = newTask("Urgent second", 1);
  a.priority = 3;
  b.priority = 1;
  assert.equal(recommend([b, a], 60)?.id, a.id);
});
test("waiting and unfinished dependencies are excluded", () => {
  const a = newTask("Blocked", 0),
    b = newTask("Waiting", 1),
    c = newTask("Ready", 2);
  a.dependencies = [b.id];
  b.state = "WAITING";
  assert.equal(recommend([a, b, c], 60)?.id, c.id);
});
test("availability does not modify task order", () => {
  const a = newTask("Long", 0),
    b = newTask("Short", 1);
  a.duration = 90;
  b.duration = 15;
  assert.equal(recommend([a, b], 30)?.id, b.id);
  assert.equal(a.rank, 0);
  assert.equal(recommend([a], 30), null);
});
test("active work wins even when exceeding estimate", () => {
  const a = newTask("Active", 2),
    b = newTask("Other", 0);
  a.state = "ACTIVE";
  a.duration = 90;
  assert.equal(recommend([a, b], 15)?.id, a.id);
});
test("personal and work commitments can overlap and are detected", () => {
  const a = newTask("Personal", 0),
    b = newTask("Work", 1);
  a.context = "Personal";
  a.start = "2026-10-03T14:00";
  b.start = "2026-10-03T14:30";
  a.duration = 60;
  b.duration = 45;
  assert.ok(overlaps(a, b));
  b.start = "2026-10-03T15:00";
  assert.equal(overlaps(a, b), false);
});
test("completion recurrence anchors to finish; calendar anchors to due", () => {
  const now = new Date("2026-10-03T12:00:00"),
    t = newTask("Repeat", 0);
  t.interval = 7;
  t.due = "2026-10-01";
  t.recurrence = "completion";
  assert.equal(complete(t, now)[1].due, "2026-10-10");
  t.recurrence = "calendar";
  assert.equal(complete(t, now)[1].due, "2026-10-08");
});
test("elapsed time keeps actual overtime and pauses stop clock", () => {
  const t = newTask("Focus", 0);
  t.seconds = 100;
  t.runningSince = 1000;
  assert.equal(elapsed(t, 61000), 160);
  t.runningSince = null;
  assert.equal(elapsed(t, 61000), 100);
});
test("future scheduled task is not next", () => {
  const t = newTask("Future", 0);
  t.start = `${day(new Date(Date.now() + 86400000))}T12:00`;
  assert.equal(recommend([t], 60), null);
});
test("a snoozed task stays out of Next until its recovery date", () => {
  const t = newTask("Tomorrow", 0);
  t.state = "RESCHEDULED";
  t.due = day(new Date(Date.now() + 86400000));
  assert.equal(recommend([t], 60), null);
});

test("finishing preserves the schedule and records completion without hiding the task", () => {
  const t = newTask("Scheduled", 0);
  t.start = "2026-10-04T09:00";
  t.duration = 30;
  const now = new Date("2026-10-04T10:00:00+07:00");
  const [done] = complete(t, now);
  assert.equal(done.start, t.start);
  assert.equal(done.state, "DONE");
  assert.equal(done.completedAt, now.toISOString());
  assert.equal(done.archived, false);
  assert.equal(recommend([done], 60), null);
});
