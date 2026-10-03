"use client";
import { CalendarDays, ArrowUpRight, Clock3 } from "lucide-react";
import type { Task } from "@/lib/engine";
import { day } from "@/lib/engine";
export function DayFlow({
  tasks,
  onEdit,
  onSchedule,
}: {
  tasks: Task[];
  onEdit: (id: string) => void;
  onSchedule: () => void;
}) {
  const scheduled = tasks
    .filter((t) => !!t.start && day(new Date(t.start)) === day() && !t.archived)
    .sort((a, b) => a.start.localeCompare(b.start));
  return (
    <aside className="day-flow">
      <header>
        <h2>
          <CalendarDays size={17} /> Schedule
        </h2>
        <button
          className="icon-button"
          aria-label="Open schedule"
          onClick={onSchedule}
        >
          <ArrowUpRight size={17} />
        </button>
      </header>
      {scheduled.length ? (
        <div className="flow-timeline">
          {scheduled.slice(0, 5).map((t) => (
            <button
              key={t.id}
              className={`flow-block ${t.context.toLowerCase()} ${t.state === "DONE" ? "completed-block" : ""}`}
              onClick={() => onEdit(t.id)}
            >
              <time>
                {new Date(t.start).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              <strong>{t.title}</strong>
              <span>
                {t.state === "DONE" ? "Done" : t.context} ·{" "}
                {t.duration ? `${t.duration} min` : "Optional estimate"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flow-empty">
          <Clock3 size={25} />
          <strong>No time blocks today.</strong>
          <button className="text-button" onClick={onSchedule}>
            Add time block <ArrowUpRight size={14} />
          </button>
        </div>
      )}
    </aside>
  );
}
