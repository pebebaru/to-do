"use client";
import { ArrowDown, ArrowUp, ArrowRight, GripVertical } from "lucide-react";
import { day, type Task } from "@/lib/engine";
export function TaskRow({
  t,
  personName,
  today,
  visible,
  drag,
  setDrag,
  move,
  finish,
  setEdit,
  snooze,
  start,
  schedule,
}: {
  t: Task;
  personName?: string;
  today: string;
  visible: Task[];
  drag: string | null;
  setDrag: (id: string | null) => void;
  move: (id: string, target: string) => void;
  finish: (t: Task) => void;
  setEdit: (id: string) => void;
  snooze: (t: Task) => void;
  start: (t: Task) => void;
  schedule: (start: string) => void;
}) {
  const progress = t.actions.filter((a) => a.done).length;
  return (
    <article
      key={t.id}
      className="task-row"
      draggable
      onDragStart={() => setDrag(t.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (drag) move(drag, t.id);
        setDrag(null);
      }}
    >
      <GripVertical className="grip" size={16} />
      <button
        className="check-circle"
        aria-label={`${t.state === "DONE" ? "Done" : "Complete"} ${t.title}`}
        disabled={t.state === "DONE"}
        onClick={() => finish(t)}
      >
        {t.state === "DONE" ? "✓" : ""}
      </button>
      <button className="task-title" onClick={() => setEdit(t.id)}>
        <strong>{t.title}</strong>
        <span>
          {t.actions.length > 0 && `${progress}/${t.actions.length} steps · `}
          {t.due && t.due < today ? "Ready to revisit · " : ""}
          {t.snoozes >= 3 ? `Postponed ${t.snoozes} times · ` : ""}
          {t.duration
            ? `${t.duration} min`
            : t.state === "WAITING"
              ? `Waiting for ${personName || "a response"}`
              : "No time estimate"}
          {t.start &&
            ` · ${new Date(t.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
        </span>
      </button>
      <span
        className={`priority-pill p${t.priority}`}
        title={`Priority ${t.priority}`}
      >
        P{t.priority}
      </span>
      <span className={`context ${t.context.toLowerCase()}`}>{t.context}</span>
      <details className="row-menu">
        <summary aria-label={`More actions for ${t.title}`}>•••</summary>
        <div>
          {t.state !== "DONE" && (
            <>
              <button onClick={() => start(t)}>Start</button>
              <button
                onClick={() => {
                  const i = visible.findIndex((x) => x.id === t.id);
                  if (i > 0) move(t.id, visible[i - 1].id);
                }}
              >
                Move up
              </button>
              <button
                onClick={() => {
                  const i = visible.findIndex((x) => x.id === t.id);
                  if (i < visible.length - 1) move(t.id, visible[i + 1].id);
                }}
              >
                Move down
              </button>
            </>
          )}
          <button onClick={() => schedule(`${day()}T09:00`)}>
            Today · 09:00
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              schedule(`${day(d)}T09:00`);
            }}
          >
            Tomorrow · 09:00
          </button>
          <label>
            Schedule
            <input
              aria-label={`Schedule ${t.title}`}
              type="datetime-local"
              value={t.start}
              onChange={(e) => {
                if (e.target.value) schedule(e.target.value);
              }}
            />
          </label>
          <button onClick={() => setEdit(t.id)}>Task details</button>
        </div>
      </details>
      <div className="row-controls" hidden={t.state === "DONE"}>
        <button
          className="icon-button"
          title="Move up"
          aria-label={`Move ${t.title} up`}
          onClick={() => {
            const i = visible.findIndex((x) => x.id === t.id);
            if (i > 0) move(t.id, visible[i - 1].id);
          }}
        >
          <ArrowUp size={14} />
        </button>
        <button
          className="icon-button"
          title="Move down"
          aria-label={`Move ${t.title} down`}
          onClick={() => {
            const i = visible.findIndex((x) => x.id === t.id);
            if (i < visible.length - 1) move(t.id, visible[i + 1].id);
          }}
        >
          <ArrowDown size={14} />
        </button>
        <button className="text-button snooze" onClick={() => snooze(t)}>
          Tomorrow
        </button>
        {t.state !== "WAITING" && (
          <button
            className="icon-button start-row"
            aria-label={`Start ${t.title}`}
            onClick={() => start(t)}
          >
            <ArrowRight size={18} />
          </button>
        )}
      </div>
    </article>
  );
}
