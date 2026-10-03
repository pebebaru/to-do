"use client";
import { useState } from "react";
import { Dialog } from "./dialog";
import {
  canManage,
  type SharedTask,
  type TeamGroup,
} from "@/lib/collaboration";
import type { Profile } from "@/lib/accounts";
export function SharedTaskDetails({
  task,
  profile,
  team,
  groups,
  act,
  onClose,
  onFinish,
  onStart,
}: {
  task: SharedTask;
  profile: Profile;
  team: Profile[];
  groups: TeamGroup[];
  act: (action: string, fields: Record<string, unknown>) => Promise<unknown>;
  onClose: () => void;
  onFinish: () => void;
  onStart: () => void;
}) {
  const [tab, setTab] = useState("Task"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [undo, setUndo] = useState(false);
  const owner = task.owner_id === profile.id,
    manage = canManage(task, profile.id);
  const name = (id: string | null) =>
    team.find((p) => p.id === id)?.display_name || "Unassigned";
  async function save(action: string, fields: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    try {
      await act(action, { id: task.id, version: task.version, ...fields });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={task.payload.title} onClose={onClose}>
      <p className="assignment-line">
        Assigned by <strong>{name(task.owner_id)}</strong> · To{" "}
        <strong>{name(task.assignee)}</strong>
        {task.assignee && ` · ${task.assignment_status}`}
      </p>
      <small>Updated {new Date(task.updated_at).toLocaleString()}</small>
      <div className="segments detail-tabs">
        {["Task", "Comments", "Sharing"].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <p role="status" className="form-message">
        {error}
      </p>
      <fieldset disabled={busy} className="plain-fieldset">
        {tab === "Task" && (
          <>
            {manage && task.payload.state !== "DONE" && (
              <button className="primary" onClick={onStart}>
                {task.payload.state === "ACTIVE" ? "Continue" : "Start"}
              </button>
            )}
            {task.assignee === profile.id &&
              task.assignment_status === "pending" && (
                <div className="button-row">
                  <button
                    className="primary"
                    onClick={() =>
                      void save("respond", { response: "accepted" })
                    }
                  >
                    Accept
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      void save("respond", { response: "declined" })
                    }
                  >
                    Decline
                  </button>
                </div>
              )}
            {(!task.assignee || task.assignment_status === "declined") && (
              <button className="secondary" onClick={() => void save("take")}>
                Assign to me
              </button>
            )}
            <form
              key={task.version}
              className="stack-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await save("update", {
                  patch: {
                    title: f.get("title"),
                    due: f.get("due"),
                    start: f.get("start"),
                    duration: Number(f.get("duration")),
                    notes: f.get("notes"),
                  },
                });
              }}
            >
              <fieldset
                disabled={!manage}
                className="plain-fieldset stack-form"
              >
                <label>
                  Name
                  <input
                    name="title"
                    required
                    maxLength={300}
                    defaultValue={task.payload.title}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Due date
                    <input
                      name="due"
                      type="date"
                      defaultValue={task.payload.due}
                    />
                  </label>
                  <label>
                    Schedule
                    <input
                      name="start"
                      type="datetime-local"
                      defaultValue={task.payload.start}
                    />
                  </label>
                  <label>
                    Minutes
                    <input
                      name="duration"
                      type="number"
                      min={0}
                      max={1440}
                      defaultValue={task.payload.duration}
                    />
                  </label>
                </div>
                <label>
                  Notes
                  <textarea
                    name="notes"
                    maxLength={4000}
                    defaultValue={task.payload.notes}
                  />
                </label>
                {manage && <button className="primary">Save</button>}
              </fieldset>
            </form>
            {manage && (
              <button
                className="secondary completion-action"
                onClick={async () => {
                  const done = task.payload.state !== "DONE";
                  if (
                    await save("update", {
                      patch: { state: done ? "DONE" : "TODO" },
                    })
                  ) {
                    setUndo(done);
                    if (done) onFinish();
                  }
                }}
              >
                {task.payload.state === "DONE" ? "Reopen" : "Done"}
              </button>
            )}
            {undo && task.payload.state === "DONE" && (
              <button
                className="text-button"
                onClick={async () => {
                  if (await save("update", { patch: { state: "TODO" } }))
                    setUndo(false);
                }}
              >
                Undo completion
              </button>
            )}
            <h3>Handoff</h3>
            {manage ? (
              <form
                key={`handoff-${task.version}`}
                className="stack-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await save("handoff", {
                    text: new FormData(e.currentTarget).get("handoff"),
                  });
                }}
              >
                <label>
                  What should the next person know?
                  <textarea
                    name="handoff"
                    maxLength={4000}
                    defaultValue={task.handoff}
                  />
                </label>
                <button className="secondary">Save note</button>
              </form>
            ) : (
              <p>{task.handoff || "No handoff note."}</p>
            )}
            <details>
              <summary>Request a different due date</summary>
              <form
                className="stack-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    f = new FormData(form);
                  if (
                    await save("request-date", {
                      date: f.get("date"),
                      reason: f.get("reason"),
                    })
                  )
                    form.reset();
                }}
              >
                <label>
                  New date
                  <input name="date" type="date" required />
                </label>
                <label>
                  Reason
                  <input name="reason" maxLength={1000} required />
                </label>
                <button className="secondary">Send request</button>
              </form>
            </details>
            {task.due_request && (
              <section className="request-card">
                <p>
                  {name(task.due_request.author)} requested{" "}
                  {task.due_request.date}
                </p>
                <p>{task.due_request.reason}</p>
                {owner && (
                  <div className="button-row">
                    <button
                      className="primary"
                      onClick={() =>
                        void save("resolve-date", { approve: true })
                      }
                    >
                      Approve date
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        void save("resolve-date", { approve: false })
                      }
                    >
                      Decline request
                    </button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
        {tab === "Comments" && (
          <>
            <div className="task-comments">
              {task.comments.length ? (
                task.comments.map((c) => (
                  <article key={c.id}>
                    <header>
                      <strong>{name(c.author)}</strong>
                      <time>{new Date(c.at).toLocaleString()}</time>
                    </header>
                    <p>{c.text}</p>
                  </article>
                ))
              ) : (
                <p>No comments.</p>
              )}
            </div>
            <form
              className="stack-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                if (
                  await save("comment", {
                    text: new FormData(form).get("comment"),
                  })
                )
                  form.reset();
              }}
            >
              <label>
                Comment
                <textarea name="comment" required maxLength={2000} />
              </label>
              <button className="primary">Add comment</button>
            </form>
          </>
        )}
        {tab === "Sharing" && (
          <>
            <p>Visible only to these members and the owner.</p>
            {owner ? (
              <SharingForm
                key={task.version}
                task={task}
                profile={profile}
                team={team}
                groups={groups}
                onSave={(fields) => save("sharing", fields)}
              />
            ) : (
              <ul>
                {[task.owner_id, ...task.viewers].map((id) => (
                  <li key={id}>{name(id)}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </fieldset>
    </Dialog>
  );
}
export function SharingForm({
  task,
  profile,
  team,
  groups,
  onSave,
}: {
  task?: SharedTask;
  profile: Profile;
  team: Profile[];
  groups: TeamGroup[];
  onSave: (fields: Record<string, unknown>) => Promise<unknown>;
}) {
  const [viewers, setViewers] = useState(task?.viewers || []),
    [assignee, setAssignee] = useState(task?.assignee || "");
  return (
    <form
      className="stack-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ viewers, assignee: assignee || null });
      }}
    >
      {groups.length > 0 && (
        <label>
          Add group members
          <select
            defaultValue=""
            onChange={(e) => {
              const g = groups.find((g) => g.id === e.target.value);
              if (g)
                setViewers([
                  ...new Set([
                    ...viewers,
                    ...g.members.filter(
                      (id) =>
                        id !== profile.id &&
                        team.some((p) => p.id === id && p.enabled),
                    ),
                  ]),
                ]);
            }}
          >
            <option value="">Choose a group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset className="member-picker">
        <legend>Share with</legend>
        {team
          .filter((p) => p.enabled && p.id !== profile.id)
          .map((p) => (
            <label key={p.id}>
              <input
                type="checkbox"
                checked={viewers.includes(p.id)}
                onChange={(e) => {
                  setViewers(
                    e.target.checked
                      ? [...viewers, p.id]
                      : viewers.filter((id) => id !== p.id),
                  );
                  if (!e.target.checked && assignee === p.id) setAssignee("");
                }}
              />
              {p.display_name}
            </label>
          ))}
        {team.filter((p) => p.enabled && p.id !== profile.id).length === 0 && (
          <p>Add another member to share with.</p>
        )}
      </fieldset>
      <label>
        Assign to
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Unassigned</option>
          {team
            .filter(
              (p) =>
                p.enabled && (p.id === profile.id || viewers.includes(p.id)),
            )
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
                {p.id === profile.id ? " (me)" : ""}
              </option>
            ))}
        </select>
      </label>
      <button className="primary">
        {task ? "Save sharing" : "Share task"}
      </button>
    </form>
  );
}
