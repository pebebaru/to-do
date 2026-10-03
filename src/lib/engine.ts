export type Context = "Personal" | "Work";
export type State =
  | "TODO"
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "WAITING"
  | "RESCHEDULED"
  | "DONE";
export type Action = { id: string; title: string; done: boolean };
export type Task = {
  id: string;
  title: string;
  context: Context;
  state: State;
  priority: 1 | 2 | 3;
  rank: number;
  committed: boolean;
  due: string;
  start: string;
  duration: number;
  person: string;
  notes: string;
  links: string[];
  actions: Action[];
  recurrence: "none" | "calendar" | "completion";
  interval: number;
  snoozes: number;
  seconds: number;
  runningSince: number | null;
  dependencies: string[];
  assignedBy: string;
  source: string;
  archived: boolean;
};
export function day(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function newTask(title: string, rank: number): Task {
  return {
    id: crypto.randomUUID(),
    title,
    rank,
    context: "Work",
    state: "TODO",
    priority: 2,
    committed: false,
    due: "",
    start: "",
    duration: 0,
    person: "",
    notes: "",
    links: [],
    actions: [],
    recurrence: "none",
    interval: 7,
    snoozes: 0,
    seconds: 0,
    runningSince: null,
    dependencies: [],
    assignedBy: "",
    source: "capture",
    archived: false,
  };
}
export function elapsed(t: Task, now = Date.now()) {
  return (
    t.seconds +
    (t.runningSince
      ? Math.max(0, Math.floor((now - t.runningSince) / 1000))
      : 0)
  );
}
export function parseCapture(
  text: string,
  rank: number,
  now = new Date(),
): Task {
  const t = newTask(text.trim(), rank);
  t.context = /@personal\b/i.test(text) ? "Personal" : "Work";
  const priority = text.match(/#p([123])\b/i);
  if (priority) t.priority = Number(priority[1]) as 1 | 2 | 3;
  const duration = text.match(/~(\d{1,4})m?\b/i);
  if (duration) t.duration = Math.min(1440, Number(duration[1]));
  const date = text.match(/!(today|tomorrow|\d{4}-\d{2}-\d{2})\b/i);
  if (date) {
    const value = date[1].toLowerCase();
    const d = new Date(now);
    if (value === "tomorrow") d.setDate(d.getDate() + 1);
    t.due = value === "today" || value === "tomorrow" ? day(d) : value;
    t.committed = value === "today";
  }
  t.title = text
    .replace(
      /@(work|personal)\b|#p[123]\b|~\d{1,4}m?\b|!(today|tomorrow|\d{4}-\d{2}-\d{2})\b/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
  return t;
}
export function recommend(tasks: Task[], available: number) {
  const candidates = tasks.filter(
    (t) =>
      !t.archived &&
      t.state !== "DONE" &&
      t.state !== "WAITING" &&
      !(t.state === "RESCHEDULED" && t.due > day()) &&
      t.dependencies.every(
        (id) => tasks.find((x) => x.id === id)?.state === "DONE",
      ),
  );
  const active = candidates.find((t) => t.state === "ACTIVE");
  if (active) return active;
  return (
    candidates
      .filter((t) => !t.start || new Date(t.start).getTime() <= Date.now())
      .sort((a, b) => a.rank - b.rank)
      .find((t) => !t.duration || t.duration <= available) ?? null
  );
}
export function reasons(t: Task, available: number) {
  return [
    t.state === "ACTIVE"
      ? "You already started this."
      : "First in your eligible manual order.",
    t.due
      ? t.due <= day()
        ? "Its deadline deserves attention."
        : `Due ${t.due}.`
      : "No deadline pressure.",
    t.duration
      ? `${t.duration} minutes estimated; ${available} minutes available.`
      : "You can start with a small step.",
    "No unfinished dependencies.",
  ];
}
export function overlaps(a: Task, b: Task) {
  if (
    a.id === b.id ||
    !a.start ||
    !b.start ||
    !a.duration ||
    !b.duration ||
    a.archived ||
    b.archived ||
    a.state === "DONE" ||
    b.state === "DONE"
  )
    return false;
  const x = new Date(a.start).getTime(),
    y = new Date(b.start).getTime();
  return x < y + b.duration * 60000 && y < x + a.duration * 60000;
}
export function complete(t: Task, now = new Date()): Task[] {
  const done = {
    ...t,
    state: "DONE" as State,
    seconds: elapsed(t, now.getTime()),
    runningSince: null,
  };
  if (t.recurrence === "none") return [done];
  const base =
    t.recurrence === "completion"
      ? new Date(now)
      : new Date(`${t.due || day(now)}T12:00:00`);
  const interval = Math.max(1, Math.min(365, Number(t.interval) || 7));
  base.setDate(base.getDate() + interval);
  while (day(base) <= day(now)) base.setDate(base.getDate() + interval);
  return [
    done,
    {
      ...t,
      id: crypto.randomUUID(),
      state: "TODO",
      due: day(base),
      start: "",
      committed: false,
      seconds: 0,
      runningSince: null,
      snoozes: 0,
      rank: t.rank + 0.5,
      actions: t.actions.map((a) => ({ ...a, done: false })),
    },
  ];
}
export function examples(): Task[] {
  const titles = [
    "Review the new campaign",
    "Send the proposal to Maya",
    "Pay the electricity bill",
    "Launch the new website",
    "Quotation from Andre",
    "Make time for a walk",
  ];
  return titles.map((title, i) => {
    const t = newTask(title, i);
    return {
      ...t,
      context: (i === 2 || i === 5 ? "Personal" : "Work") as Context,
      priority: (i === 0 ? 1 : i === 5 ? 3 : 2) as 1 | 2 | 3,
      duration: [45, 20, 10, 30, 0, 25][i],
      committed: i < 3,
      due: i < 4 ? day() : "",
      person: i === 4 ? "Andre" : i === 1 ? "Maya" : "",
      state: i === 4 ? "WAITING" : "TODO",
      actions:
        i === 3
          ? [
              { id: "copy", title: "Write the copy", done: true },
              { id: "design", title: "Review the design", done: true },
              { id: "qa", title: "Check the mobile experience", done: false },
              { id: "ship", title: "Publish the website", done: false },
            ]
          : [],
    };
  });
}
