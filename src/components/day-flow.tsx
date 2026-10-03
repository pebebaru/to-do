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
    .filter(
      (t) =>
        !!t.start &&
        day(new Date(t.start)) === day() &&
        !t.archived &&
        t.state !== "DONE",
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  const commitments = tasks
    .filter((t) => t.committed && !t.archived && t.state !== "DONE")
    .sort((a, b) => a.rank - b.rank);
  return (
    <aside className="day-flow">
      <header>
        <h2>
          <CalendarDays size={17} /> Day flow
        </h2>
        <button
          className="icon-button"
          aria-label="Open schedule"
          onClick={onSchedule}
        >
          <ArrowUpRight size={17} />
        </button>
      </header>
      <p className="flow-subtitle">Personal + Work. One day.</p>
      {scheduled.length ? (
        <div className="flow-timeline">
          {scheduled.slice(0, 5).map((t) => (
            <button
              key={t.id}
              className={`flow-block ${t.context.toLowerCase()}`}
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
                {t.context} ·{" "}
                {t.duration ? `${t.duration} min` : "Optional estimate"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flow-empty">
          <Clock3 size={25} />
          <strong>Your time is open.</strong>
          <p>
            You can add a time block when it helps. Starting doesn’t need a
            schedule.
          </p>
          <button className="text-button" onClick={onSchedule}>
            Plan a time block <ArrowUpRight size={14} />
          </button>
        </div>
      )}
      <div className="flow-footer">
        <span className="eyebrow">YOUR COMMITMENTS</span>
        {commitments.length ? (
          <p>
            {commitments.length} intentional{" "}
            {commitments.length === 1 ? "commitment" : "commitments"}.<br />
            Leave room for real life.
          </p>
        ) : (
          <p>
            A small plan is enough.
            <br />
            Commit when you’re ready.
          </p>
        )}
      </div>
    </aside>
  );
}
