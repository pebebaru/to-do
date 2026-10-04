"use client";
import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock3,
} from "lucide-react";
import { timelineColumns } from "@/lib/timeline";
import { day, overlaps, type Task } from "@/lib/engine";
export function ScheduleView({
  tasks,
  onEdit,
  onNew,
  row,
}: {
  tasks: Task[];
  onEdit: (id: string) => void;
  onNew: (start: string) => void;
  row: (t: Task) => ReactNode;
}) {
  const [date, setDate] = useState(day()),
    [range, setRange] = useState(1);
  const dates = Array.from({ length: range }, (_, i) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + i);
    return day(d);
  });
  const blocks = tasks
    .filter((t) => t.start && dates.includes(day(new Date(t.start))))
    .sort((a, b) => a.start.localeCompare(b.start));
  const columns = timelineColumns(blocks);
  const move = (direction: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + direction * range);
    setDate(day(d));
  };
  const hours = Array.from({ length: 13 }, (_, i) => i + 8);
  return (
    <div className="schedule-page">
      <header className="schedule-toolbar">
        <strong className="schedule-friendly-date">
          {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
          {range > 1 && ` · ${range} days`}
        </strong>
        <div className="schedule-date">
          <button
            className="icon-button"
            aria-label="Previous day"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={16} />
          </button>
          <label>
            <CalendarDays size={16} />
            <input
              type="date"
              aria-label="Schedule date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
          <button
            className="icon-button"
            aria-label="Next day"
            onClick={() => move(1)}
          >
            <ChevronRight size={16} />
          </button>
          <button className="text-button" onClick={() => setDate(day())}>
            Today
          </button>
        </div>
        <div className="schedule-range">
          {[1, 3, 7].map((n) => (
            <button
              key={n}
              aria-pressed={range === n}
              onClick={() => setRange(n)}
            >
              {n === 1 ? "Day" : n === 3 ? "3-Day" : "Week"}
            </button>
          ))}
          <button className="primary" onClick={() => onNew(`${date}T09:00`)}>
            <Plus size={16} />
            Time Block
          </button>
        </div>
      </header>
      <div className="schedule-layout">
        <section>
          <div className="schedule-summary">
            <span>
              <strong>{blocks.reduce((s, t) => s + t.duration, 0)}m</strong>{" "}
              scheduled in this view
            </span>
            <span className="mono">
              <Clock3 size={14} />
              Personal + Work
            </span>
          </div>
          <div className="timeline-scroll">
            <div
              className="timeline-grid"
              style={{
                gridTemplateColumns: `58px repeat(${range},minmax(${range > 1 ? "170" : "220"}px,1fr))`,
              }}
            >
              <div className="timeline-time">
                <div className="timeline-day-label">TIME</div>
                {hours.map((h) => (
                  <time key={h}>{String(h).padStart(2, "0")}:00</time>
                ))}
              </div>
              {dates.map((d) => (
                <div className="timeline-day" key={d}>
                  <div className="timeline-day-label">
                    {new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div className="timeline-track">
                    {hours.map((h) => (
                      <button
                        className="timeline-hour"
                        key={h}
                        aria-label={`Add time block ${d} ${h}:00`}
                        onClick={() =>
                          onNew(`${d}T${String(h).padStart(2, "0")}:00`)
                        }
                      />
                    ))}
                    {blocks
                      .filter(
                        (t) =>
                          day(new Date(t.start)) === d &&
                          new Date(t.start).getHours() >= 8 &&
                          new Date(t.start).getHours() < 21,
                      )
                      .map((t) => {
                        const starts = new Date(t.start),
                          top =
                            (starts.getHours() - 8 + starts.getMinutes() / 60) *
                            64;
                        const conflict = blocks.some((b) => overlaps(t, b));
                        return (
                          <button
                            key={t.id}
                            className={`timeline-event ${t.context.toLowerCase()} ${t.state === "DONE" ? "completed-block" : ""} ${conflict ? "overlapping" : ""}`}
                            style={{
                              top,
                              left: `calc(${(columns.get(t.id)!.column / columns.get(t.id)!.columns) * 100}% + 4px)`,
                              width: `calc(${100 / columns.get(t.id)!.columns}% - 8px)`,
                              height: Math.max(
                                64,
                                Math.min(
                                  832 - top,
                                  ((t.duration || 30) / 60) * 64,
                                ),
                              ),
                            }}
                            aria-label={`${t.title}, ${starts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}, ${t.duration || 30} minutes${conflict ? ", overlaps another task" : ""}`}
                            onClick={() => onEdit(t.id)}
                          >
                            <span>
                              {starts.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              · {t.duration || 30}m <b>P{t.priority}</b>
                            </span>
                            <strong>{t.title}</strong>
                            <small>
                              {t.state === "DONE"
                                ? "✓ Done"
                                : conflict
                                  ? "Time overlap"
                                  : t.context}
                            </small>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {blocks.some(
            (t) =>
              new Date(t.start).getHours() < 8 ||
              new Date(t.start).getHours() >= 21,
          ) && (
            <section className="task-section">
              <h2>Outside visible hours</h2>
              {blocks
                .filter(
                  (t) =>
                    new Date(t.start).getHours() < 8 ||
                    new Date(t.start).getHours() >= 21,
                )
                .map(row)}
            </section>
          )}
        </section>
        <aside className="schedule-pool">
          <header>
            <h2>Unscheduled</h2>
            <span className="mono">
              {tasks.filter((t) => !t.start && t.state !== "DONE").length}
            </span>
          </header>
          <p>Select a task to schedule it.</p>
          {tasks
            .filter((t) => !t.start && t.state !== "DONE")
            .map((t) => (
              <button
                key={t.id}
                className="pool-task"
                onClick={() => onEdit(t.id)}
              >
                <div>
                  <span className={`context ${t.context.toLowerCase()}`}>
                    {t.context}
                  </span>
                  <span className={`priority-pill p${t.priority}`}>
                    P{t.priority}
                  </span>
                </div>
                <strong>{t.title}</strong>
                <small>
                  {t.duration
                    ? `${t.duration}m estimated`
                    : "Optional estimate"}
                  <Plus size={14} />
                </small>
              </button>
            ))}
          {tasks.some((t) => !t.start && t.state === "DONE") && (
            <section className="task-section">
              <h2>Done</h2>
              {tasks.filter((t) => !t.start && t.state === "DONE").map(row)}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
