"use client";
import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock3,
} from "lucide-react";
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
  const move = (direction: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + direction * range);
    setDate(day(d));
  };
  const hours = Array.from({ length: 13 }, (_, i) => i + 8);
  return (
    <div className="schedule-page">
      <header className="schedule-toolbar">
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
                            className={`timeline-event ${t.context.toLowerCase()} ${conflict ? "overlapping" : ""}`}
                            style={{
                              top,
                              height: Math.max(
                                48,
                                Math.min(
                                  832 - top,
                                  ((t.duration || 30) / 60) * 64,
                                ),
                              ),
                            }}
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
                              {conflict
                                ? "Overlaps another commitment"
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
            <h2>Unscheduled queue</h2>
            <span className="mono">{tasks.filter((t) => !t.start).length}</span>
          </header>
          <p>
            Choose a task to give it a time block. Your list stays in its own
            order.
          </p>
          {tasks
            .filter((t) => !t.start)
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
        </aside>
      </div>
    </div>
  );
}
