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
import type { Profile } from "@/lib/accounts";
export function ExecutionDeck({
  tasks,
  status,
  cloud,
  onEdit,
  onPeople,
  team,
}: {
  tasks: Task[];
  status: string;
  cloud: boolean;
  onEdit: (id: string) => void;
  onPeople: () => void;
  team: Profile[];
}) {
  const live = tasks.filter((t) => !t.archived);
  const waiting = live.filter(
    (t) => t.state === "WAITING" && team.some((p) => p.id === t.person),
  );
  const rituals = live.filter((t) => t.recurrence !== "none");
  const done = live.filter((t) => t.state === "DONE");
  const seconds = live.reduce((sum, t) => sum + elapsed(t), 0);
  return (
    <aside className="execution-deck secondary-panel">
      <section className="deck-card">
        <header>
          <h2>
            <Repeat2 size={18} />
            Repeating tasks
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
          <p className="deck-empty">No repeating tasks.</p>
        )}
      </section>
      <section className="deck-card">
        <header>
          <h2>
            <Users size={18} />
            Waiting for
          </h2>
          <button
            className="icon-button"
            aria-label="Open Team"
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
              <span className="waiting-avatar">
                {(team.find((p) => p.id === t.person)?.display_name || "?")[0]}
              </span>
              <span>
                <strong>
                  {team.find((p) => p.id === t.person)?.display_name}
                </strong>
                <small>{t.title}</small>
              </span>
              <span className="waiting-label">WAITING</span>
            </button>
          ))
        ) : (
          <p className="deck-empty">Nothing waiting.</p>
        )}
      </section>
      <section className="deck-card">
        <header>
          <h2>
            <Activity size={18} />
            Summary
          </h2>
          <span className="status-dot" />
        </header>
        <div className="metrics-grid">
          <div>
            <span>TIME SPENT</span>
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
            <small>Total tasks</small>
          </div>
          <div>
            <span>TODAY</span>
            <strong>
              {live.filter((t) => t.committed && t.state !== "DONE").length}
            </strong>
            <small>Today’s tasks</small>
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
          <span></span>
        </div>
      </section>
    </aside>
  );
}
