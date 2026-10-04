"use client";
import { Dialog } from "./dialog";
import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Task } from "@/lib/engine";
import { Profile } from "@/lib/accounts";
export function TaskEditor({
  task,
  onSave,
  onClose,
  onDelete,
  team,
}: {
  task: Task;
  onSave: (t: Task) => void;
  onClose: () => void;
  onDelete: () => void;
  team: Profile[];
}) {
  const [draft, setDraft] = useState(task),
    [action, setAction] = useState("");
  const set = (patch: Partial<Task>) =>
    setDraft((previous) => ({ ...previous, ...patch }));
  return (
    <Dialog title="Task details" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.title.trim()) return;
          const fields = new FormData(e.currentTarget);
          const start = String(fields.get("start") || "");
          const due = String(fields.get("due") || "");
          onSave({
            ...draft,
            title: draft.title.trim(),
            start,
            due,
            state:
              draft.state === "ACTIVE"
                ? "PAUSED"
                : start && draft.state === "TODO"
                  ? "SCHEDULED"
                  : draft.state,
          });
        }}
      >
        <label>
          Task
          <input
            required
            maxLength={300}
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Context
            <select
              value={draft.context}
              onChange={(e) =>
                set({ context: e.target.value as Task["context"] })
              }
            >
              <option>Work</option>
              <option>Personal</option>
            </select>
          </label>
          <label>
            State
            <select
              value={draft.state === "ACTIVE" ? "PAUSED" : draft.state}
              onChange={(e) =>
                set({
                  state: e.target.value as Task["state"],
                  runningSince: null,
                })
              }
            >
              {[
                "TODO",
                "SCHEDULED",
                "PAUSED",
                "WAITING",
                "RESCHEDULED",
                "DONE",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Estimate (minutes)
            <input
              type="number"
              min={0}
              max={1440}
              value={draft.duration || ""}
              onChange={(e) => set({ duration: Number(e.target.value) })}
            />
          </label>
          <label>
            Due date
            <input
              name="due"
              type="date"
              value={draft.due}
              onChange={(e) => set({ due: e.target.value })}
            />
          </label>
          <label>
            Optional time block
            <input
              name="start"
              type="datetime-local"
              value={draft.start}
              onChange={(e) =>
                set({
                  start: e.target.value,
                  state:
                    draft.state === "DONE"
                      ? "DONE"
                      : e.target.value
                        ? "SCHEDULED"
                        : "TODO",
                })
              }
            />
          </label>
        </div>
        <div className="priority-field">
          <span>Priority level</span>
          <div
            className="priority-choices"
            role="group"
            aria-label="Priority level"
          >
            {([1, 2, 3] as const).map((p) => (
              <button
                type="button"
                key={p}
                className={`priority-choice p${p} ${draft.priority === p ? "selected" : ""}`}
                aria-pressed={draft.priority === p}
                onClick={() => set({ priority: p })}
              >
                <strong>P{p}</strong>
                <span>{p === 1 ? "URGENT" : p === 2 ? "NORMAL" : "LOW"}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={draft.committed}
            onChange={(e) => set({ committed: e.target.checked })}
          />{" "}
          Today
        </label>
        <label>
          Waiting for
          <select
            value={draft.person}
            onChange={(e) => set({ person: e.target.value })}
          >
            <option value="">No one</option>
            {team.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name || p.username}
                {p.job_title ? ` · ${p.job_title}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notes & links
          <textarea
            rows={3}
            maxLength={4000}
            placeholder="Add notes or links."
            value={draft.notes}
            onChange={(e) =>
              set({
                notes: e.target.value,
                links: e.target.value.match(/https?:\/\/[^\s]+/g) || [],
              })
            }
          />
        </label>
        <div className="form-grid">
          <label>
            Repeat
            <select
              value={draft.recurrence}
              onChange={(e) =>
                set({ recurrence: e.target.value as Task["recurrence"] })
              }
            >
              <option value="none">Doesn’t repeat</option>
              <option value="calendar">On the calendar</option>
              <option value="completion">After completion</option>
            </select>
          </label>
          {draft.recurrence !== "none" && (
            <label>
              Every (days)
              <input
                type="number"
                min={1}
                max={365}
                value={draft.interval}
                onChange={(e) =>
                  set({ interval: Math.max(1, Number(e.target.value)) })
                }
              />
            </label>
          )}
        </div>
        {draft.links.length > 0 && (
          <div className="task-links">
            {draft.links
              .filter((link) => /^https?:\/\//.test(link))
              .map((link) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link}
                </a>
              ))}
          </div>
        )}
        <div className="action-list">
          <span className="eyebrow">Steps</span>
          {draft.actions.map((a) => (
            <label className="check-label" key={a.id}>
              <input
                type="checkbox"
                checked={a.done}
                onChange={() =>
                  set({
                    actions: draft.actions.map((x) =>
                      x.id === a.id ? { ...x, done: !x.done } : x,
                    ),
                  })
                }
              />
              <span>{a.title}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${a.title}`}
                onClick={() =>
                  set({ actions: draft.actions.filter((x) => x.id !== a.id) })
                }
              >
                <X size={14} />
              </button>
            </label>
          ))}
          <div className="inline">
            <input
              aria-label="New child action"
              placeholder="Add a next step…"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Add child action"
              disabled={!action.trim()}
              onClick={() => {
                set({
                  actions: [
                    ...draft.actions,
                    {
                      id: crypto.randomUUID(),
                      title: action.trim(),
                      done: false,
                    },
                  ],
                });
                setAction("");
              }}
            >
              <Plus size={19} />
            </button>
          </div>
        </div>
        <footer>
          <button
            type="button"
            className="text-button danger"
            onClick={onDelete}
          >
            <Trash2 size={16} /> Archive
          </button>
          <button className="primary">Save changes</button>
        </footer>
      </form>
    </Dialog>
  );
}
