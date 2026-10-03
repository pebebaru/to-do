"use client";
import { useEffect, useState } from "react";
import {
  Clock3,
  Info,
  Play,
  Check,
  ChevronDown,
  AlarmClock,
} from "lucide-react";
import { reasons, elapsed, type Task } from "@/lib/engine";
export function NextPanel({
  next,
  today,
  available,
  setAvailable,
  why,
  setWhy,
  start,
  assistant,
  finish,
  snooze,
}: {
  next: Task | null;
  today: string;
  available: number;
  setAvailable: (n: number) => void;
  why: boolean;
  setWhy: (b: boolean) => void;
  start: (t: Task) => void;
  assistant: string;
  finish: (t: Task) => void;
  snooze: (t: Task) => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const seconds = next ? elapsed(next, now) : 0;
  const display = seconds || (next?.duration || 0) * 60;
  const timer = `${String(Math.floor(display / 60)).padStart(2, "0")}:${String(display % 60).padStart(2, "0")}`;
  return (
    <section
      className={`next-panel ${next?.priority === 1 ? "critical-dispatch" : ""}`}
    >
      {next ? (
        <>
          <div className="dispatch-top">
            <div>
              <span className={`priority-pill p${next.priority}`}>
                <i />P{next.priority}{" "}
                {next.priority === 1
                  ? "Urgent"
                  : next.priority === 2
                    ? "Normal"
                    : "Low"}
              </span>
              <span
                className={`dispatch-context ${next.context.toLowerCase()}`}
              >
                {next.context}
              </span>
            </div>
            <label className="available">
              <Clock3 size={14} />
              <select
                aria-label="Available minutes"
                value={available}
                onChange={(e) => setAvailable(Number(e.target.value))}
              >
                {[15, 30, 45, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>
                    {n}m window
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mobile-dispatch-label">NEXT TASK</div>
          <h2>{next.title}</h2>
          <p className="dispatch-description">
            {next.notes || next.actions.find((a) => !a.done)?.title || ""}
          </p>
          <div className="dispatch-reason">
            <button
              aria-expanded={why}
              className="why-button"
              onClick={() => setWhy(!why)}
            >
              <Info size={16} />
              <span>
                <strong>
                  {assistant === "Gentle" ? "Next in your order" : "Context"}
                </strong>
                <span>{reasons(next, available)[0]}</span>
              </span>
              <ChevronDown size={16} />
            </button>
            {why && (
              <ul className="why-list">
                {reasons(next, available)
                  .slice(1)
                  .map((r) => (
                    <li key={r}>{r}</li>
                  ))}
              </ul>
            )}
          </div>
          <div className="dispatch-footer">
            <div className="dispatch-clock">
              <strong>{timer}</strong>
              <span>{seconds ? "ELAPSED" : "PLANNED"}</span>
            </div>
            <div className="dispatch-actions">
              <button className="primary" onClick={() => start(next)}>
                <Play size={18} />
                {next.state === "ACTIVE" ? "Continue" : "Start"}
              </button>
              <button className="secondary" onClick={() => finish(next)}>
                <Check size={18} />
                <span>Done</span>
              </button>
              <button
                className="icon-button mobile-snooze"
                aria-label="Snooze next task"
                onClick={() => snooze(next)}
              >
                <AlarmClock size={18} />
              </button>
            </div>
          </div>
          {next.due && (
            <span className="dispatch-due">
              {next.due === today ? "Due today" : `Due ${next.due}`}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="eyebrow">NEXT TASK</span>
          <h2>No task ready.</h2>
          <p className="dispatch-description">Add a task.</p>
          <label className="available">
            <select
              aria-label="Available minutes"
              value={available}
              onChange={(e) => setAvailable(Number(e.target.value))}
            >
              {[15, 30, 45, 60, 90, 120].map((n) => (
                <option key={n} value={n}>
                  {n}m window
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </section>
  );
}
