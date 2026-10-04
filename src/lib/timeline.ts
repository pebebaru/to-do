import type { Task } from "./engine";
/** Give overlapping visible blocks separate columns, including minimum touch height. */
export function timelineColumns(tasks: Task[]) {
  const result = new Map<string, { column: number; columns: number }>();
  const sorted = [...tasks].sort((a, b) => a.start.localeCompare(b.start));
  let group: { id: string; column: number }[] = [],
    ends: number[] = [];
  const flush = () => {
    for (const t of group)
      result.set(t.id, { column: t.column, columns: ends.length });
    group = [];
    ends = [];
  };
  for (const t of sorted) {
    const start = new Date(t.start).getTime();
    if (ends.length && ends.every((end) => end <= start)) flush();
    let column = ends.findIndex((end) => end <= start);
    if (column < 0) column = ends.length;
    ends[column] = start + Math.max(60, t.duration || 30) * 60000;
    group.push({ id: t.id, column });
  }
  flush();
  return result;
}
