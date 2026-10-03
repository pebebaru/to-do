"use client";
import {
  Activity,
  Clock3,
  Repeat2,
  Users,
  Database,
  ArrowUpRight,
} from "lucide-react";
import { elapsed, type Task } from "@/lib/engine";
export function ExecutionDeck({
  tasks,
  status,
  cloud,
  onEdit,
  onPeople,
}: {
  tasks: Task[];
  status: string;
  cloud: boolean;
  onEdit: (id: string) => void;
  onPeople: () => void;
}) {
  const live = tasks.filter((t) => !t.archived);
  const waiting = live.filter((t) => t.state === "WAITING");
  const rituals = live.filter((t) => t.recurrence !== "none");
  const done = live.filter((t) => t.state === "DONE");
  const seconds = live.reduce((sum, t) => sum + elapsed(t), 0);
  return (
    <aside className="execution-deck secondary-panel">
      <section className="deck-card">
        <header>
          <h2>
            <Repeat2 size={18} />
            Daily Rituals
          </h2>
          <span className="mono positive">
            {rituals.filter((t) => t.state === "DONE").length}/{rituals.length}{" "}
            DONE
          </span>
        </header>
        {rituals.length ? (
          rituals.map((t) => (
            <button
              className="deck-item"
              key={t.id}
              onClick={() => onEdit(t.id)}
            >
              <span>{t.title}</span>
              <span className="positive">{t.state === "DONE" ? "✓" : "→"}</span>
            </button>
          ))
        ) : (
          <p className="deck-empty">Add a repeating task to build a ritual.</p>
        )}
      </section>
      <section className="deck-card">
        <header>
          <h2>
            <Users size={18} />
            Waiting on
          </h2>
          <button
            className="icon-button"
            aria-label="Open People"
            onClick={onPeople}
          >
            <ArrowUpRight size={16} />
          </button>
        </header>
        {waiting.length ? (
          waiting.map((t) => (
            <button
              className="waiting-item"
              key={t.id}
              onClick={() => onEdit(t.id)}
            >
              <span className="waiting-avatar">{(t.person || "?")[0]}</span>
              <span>
                <strong>{t.person || "A response"}</strong>
                <small>{t.title}</small>
              </span>
              <span className="waiting-label">WAITING</span>
            </button>
          ))
        ) : (
          <p className="deck-empty">No external blockers.</p>
        )}
      </section>
      <section className="deck-card">
        <header>
          <h2>
            <Activity size={18} />
            Live Telemetry
          </h2>
          <span className="status-dot" />
        </header>
        <div className="metrics-grid">
          <div>
            <span>FOCUS TIME</span>
            <strong>
              {Math.floor(seconds / 3600)}h {Math.floor((seconds % 3600) / 60)}m
            </strong>
            <small>Actual time logged</small>
          </div>
          <div>
            <span>COMPLETED</span>
            <strong className="positive">
              {done.length}/{live.length}
            </strong>
            <small>Across your task pool</small>
          </div>
          <div>
            <span>COMMITTED</span>
            <strong>
              {live.filter((t) => t.committed && t.state !== "DONE").length}
            </strong>
            <small>Open commitments</small>
          </div>
          <div>
            <span>
              <Database size={12} /> STORAGE
            </span>
            <strong className="positive">{cloud ? "Cloud" : "Local"}</strong>
            <small>{status}</small>
          </div>
        </div>
        <div className="telemetry-status">
          <Clock3 size={14} />
          <span>Actual task data · your pace</span>
        </div>
      </section>
    </aside>
  );
}
