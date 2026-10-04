"use client";
import { useState } from "react";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { Profile, isAdmin, canManageMember, roleLabel } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import type { Task } from "@/lib/engine";
import type { SharedTask, TeamGroup } from "@/lib/collaboration";
import { Dialog } from "./dialog";
import { SharingForm } from "./shared-task-details";
export function TeamPanel({
  profile,
  team,
  refresh,
  tasks,
  groups,
  privateTasks,
  act,
  onSelect,
  onShared,
}: {
  profile: Profile;
  team: Profile[];
  refresh: () => Promise<void>;
  tasks: SharedTask[];
  groups: TeamGroup[];
  privateTasks: Task[];
  act: (a: string, f: Record<string, unknown>) => Promise<unknown>;
  onSelect: (id: string) => void;
  onShared: (id: string) => void;
}) {
  const [add, setAdd] = useState(false),
    [member, setMember] = useState<Profile | null>(null),
    [groupEdit, setGroupEdit] = useState<TeamGroup | null | undefined>(
      undefined,
    ),
    [sharing, setSharing] = useState(false),
    [source, setSource] = useState(""),
    [query, setQuery] = useState(""),
    [group, setGroup] = useState(""),
    [disabled, setDisabled] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [showDone, setShowDone] = useState(true);
  const admin = isAdmin(profile.role);
  const available = privateTasks.filter(
    (t) =>
      t.context === "Work" &&
      !t.archived &&
      t.state !== "DONE" &&
      t.recurrence === "none",
  );
  async function run(work: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await work();
      await refresh();
      setMessage(success);
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function accountAction(
    action: string,
    fields: Record<string, unknown>,
  ) {
    const { data, error } = await supabase!.functions.invoke("account-admin", {
      body: { action, ...fields },
    });
    if (error) {
      let detail = "";
      try {
        detail = (await error.context?.json())?.error || "";
      } catch {}
      throw new Error(detail || "Could not save. Retry.");
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }
  const members = team.filter(
    (p) =>
      (disabled || p.enabled) &&
      (!group || groups.find((g) => g.id === group)?.members.includes(p.id)) &&
      `${p.display_name} ${p.username} ${p.job_title}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const name = (id: string | null) =>
    team.find((p) => p.id === id)?.display_name || "Unassigned";
  return (
    <section className="team-panel">
      <header className="team-actions">
        <p>Members and shared Work tasks</p>
        <div className="button-row">
          {admin && (
            <button
              className="primary"
              onClick={() => {
                setMessage("");
                setAdd(true);
              }}
            >
              <Plus size={16} />
              Add user
            </button>
          )}
          <button
            className="secondary"
            onClick={() => {
              setSource(available[0]?.id || "");
              setMessage("");
              setSharing(true);
            }}
          >
            Share task
          </button>
        </div>
      </header>
      <p role="status" className="form-message">
        {message}
      </p>
      <div className="team-filters">
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Search members"
            placeholder="Search members"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter group"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        >
          <option value="">All members</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        {admin && (
          <button
            className="text-button"
            onClick={() => {
              setMessage("");
              setGroupEdit(null);
            }}
          >
            Add group
          </button>
        )}
        {admin && group && (
          <button
            className="text-button"
            onClick={() => setGroupEdit(groups.find((g) => g.id === group))}
          >
            Edit group
          </button>
        )}
        {admin && (
          <label className="inline-check">
            <input
              type="checkbox"
              checked={disabled}
              onChange={(e) => setDisabled(e.target.checked)}
            />
            Show disabled
          </label>
        )}
      </div>
      <div className="team-grid">
        {members.map((p) => (
          <article
            className={`team-member ${p.enabled ? "" : "disabled-member"}`}
            key={p.id}
          >
            <span className="avatar">
              {(p.display_name || p.username)[0].toUpperCase()}
            </span>
            <div>
              <h3>{p.display_name}</h3>
              <p>
                {p.job_title.toLowerCase() === "superadmin" &&
                p.role === "super_admin"
                  ? "Job title not set"
                  : p.job_title || "Job title not set"}
              </p>
              <small>
                @{p.username}
                {p.id === profile.id ? " · You" : ""}
              </small>
              {(admin || !p.enabled) && (
                <span className="role-badge">
                  {p.enabled ? roleLabel(p.role) : "Disabled"}
                </span>
              )}
            </div>
            <button
              className="icon-button member-menu"
              aria-label={`Details and actions for ${p.display_name}`}
              onClick={() => {
                setMessage("");
                setMember(p);
              }}
            >
              <MoreHorizontal size={20} />
            </button>
          </article>
        ))}
      </div>
      {!members.length && <p>No matching members.</p>}
      <section className="shared-task-list">
        <header>
          <h2>Shared tasks</h2>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
            />
            Show done
          </label>
        </header>
        <p>Only tasks shared with you appear here.</p>
        {tasks
          .filter((t) => showDone || t.payload.state !== "DONE")
          .map((t) => (
            <button
              className={`shared-task-card ${t.payload.state === "DONE" ? "is-done" : ""}`}
              key={t.id}
              onClick={() => onSelect(t.id)}
            >
              <strong>
                {t.payload.state === "DONE" ? "✓ " : ""}
                {t.payload.title}
              </strong>
              <span>
                Assigned by {name(t.owner_id)} · To {name(t.assignee)}
                {t.assignee && ` · ${t.assignment_status}`}
              </span>
              <small>
                {t.payload.due
                  ? `Due ${new Date(t.payload.due + "T12:00:00").toLocaleDateString()}`
                  : "No due date"}{" "}
                · Updated {new Date(t.updated_at).toLocaleString()}
              </small>
            </button>
          ))}
        {!tasks.length && <p>No shared tasks yet.</p>}
      </section>
      {add && (
        <Dialog title="Add user" onClose={() => setAdd(false)}>
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              if (
                await run(
                  () =>
                    accountAction("create", {
                      username: f.get("username"),
                      password: f.get("password"),
                      name: f.get("name"),
                      job_title: f.get("job_title"),
                      role: f.get("role") || "user",
                    }),
                  "User added. Share their credentials privately.",
                )
              ) {
                form.reset();
                setAdd(false);
              }
            }}
          >
            <fieldset disabled={busy} className="plain-fieldset stack-form">
              <label>
                Username
                <input
                  name="username"
                  required
                  pattern="[a-zA-Z0-9_]{3,32}"
                  autoComplete="off"
                  maxLength={32}
                />
              </label>
              <label>
                Name
                <input name="name" required maxLength={80} />
              </label>
              <label>
                Job title
                <input name="job_title" maxLength={100} />
              </label>
              <label>
                Role
                <select name="role" defaultValue="user">
                  <option value="user">Normal User</option>
                  {profile.role === "super_admin" && (
                    <>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Superadmin</option>
                    </>
                  )}
                </select>
              </label>
              <label>
                Temporary password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  required
                />
              </label>
              <p role="status">{message}</p>
              <button className="primary">
                {busy ? "Adding…" : "Add user"}
              </button>
            </fieldset>
          </form>
        </Dialog>
      )}
      {member && (
        <Dialog title={member.display_name} onClose={() => setMember(null)}>
          <p>
            @{member.username} · {admin ? roleLabel(member.role) : ""}
            {member.enabled ? "" : " · Disabled"}
          </p>
          <p>{member.job_title || "Job title not set"}</p>
          {admin && canManageMember(profile.role, member.role) && (
            <>
              <form
                className="stack-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (
                    await run(
                      () =>
                        accountAction("edit", {
                          id: member.id,
                          name: f.get("name"),
                          job_title: f.get("job_title"),
                        }),
                      "Member updated.",
                    )
                  )
                    setMember(null);
                }}
              >
                <fieldset disabled={busy} className="plain-fieldset stack-form">
                  <label>
                    Name
                    <input
                      name="name"
                      required
                      maxLength={80}
                      defaultValue={member.display_name}
                    />
                  </label>
                  <label>
                    Job title
                    <input
                      name="job_title"
                      maxLength={100}
                      defaultValue={member.job_title}
                    />
                  </label>
                  <button className="primary">Save member</button>
                </fieldset>
              </form>
              {profile.role === "super_admin" && member.id !== profile.id && (
                <form
                  className="stack-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const role = new FormData(e.currentTarget).get("role");
                    if (
                      await run(
                        () => accountAction("role", { id: member.id, role }),
                        "Role updated.",
                      )
                    )
                      setMember(null);
                  }}
                >
                  <label>
                    Role
                    <select name="role" defaultValue={member.role}>
                      <option value="user">Normal User</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Superadmin</option>
                    </select>
                  </label>
                  <button className="secondary" disabled={busy}>
                    Save role
                  </button>
                </form>
              )}
              {member.id !== profile.id && (
                <>
                  <details>
                    <summary>Reset password</summary>
                    <form
                      className="stack-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        if (
                          await run(
                            () =>
                              accountAction("reset-password", {
                                id: member.id,
                                password: new FormData(form).get("password"),
                              }),
                            "Password reset. Share it privately.",
                          )
                        )
                          form.reset();
                      }}
                    >
                      <label>
                        New temporary password
                        <input
                          name="password"
                          type="password"
                          minLength={10}
                          required
                          autoComplete="new-password"
                        />
                      </label>
                      <button className="secondary" disabled={busy}>
                        Reset password
                      </button>
                    </form>
                  </details>
                  <button
                    className="text-button danger"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        member.enabled &&
                        !window.confirm(
                          `Disable ${member.display_name}? Their tasks will be preserved.`,
                        )
                      )
                        return;
                      if (
                        await run(
                          () =>
                            accountAction("access", {
                              id: member.id,
                              enabled: !member.enabled,
                            }),
                          member.enabled
                            ? "Account disabled."
                            : "Account enabled.",
                        )
                      )
                        setMember(null);
                    }}
                  >
                    {member.enabled ? "Disable account" : "Enable account"}
                  </button>
                </>
              )}
            </>
          )}
          <p role="status">{message}</p>
          <h3>Assigned tasks</h3>
          {tasks
            .filter((t) => t.assignee === member.id)
            .map((t) => (
              <button
                className="shared-task-card"
                key={t.id}
                onClick={() => {
                  setMember(null);
                  onSelect(t.id);
                }}
              >
                {t.payload.title}
              </button>
            ))}
          {!tasks.some((t) => t.assignee === member.id) && (
            <p>No shared assignments visible to you.</p>
          )}
        </Dialog>
      )}
      {groupEdit !== undefined && (
        <Dialog
          title={groupEdit ? "Edit group" : "Add group"}
          onClose={() => setGroupEdit(undefined)}
        >
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await run(
                  () =>
                    act("group", {
                      id: groupEdit?.id,
                      name: f.get("name"),
                      members: f.getAll("member"),
                    }),
                  "Group saved.",
                )
              )
                setGroupEdit(undefined);
            }}
          >
            <fieldset disabled={busy} className="plain-fieldset stack-form">
              <label>
                Group name
                <input
                  name="name"
                  maxLength={60}
                  required
                  defaultValue={groupEdit?.name || ""}
                />
              </label>
              <fieldset className="member-picker">
                <legend>Members</legend>
                {team
                  .filter((p) => p.enabled)
                  .map((p) => (
                    <label key={p.id}>
                      <input
                        type="checkbox"
                        name="member"
                        value={p.id}
                        defaultChecked={groupEdit?.members.includes(p.id)}
                      />
                      {p.display_name}
                    </label>
                  ))}
              </fieldset>
              <p role="status">{message}</p>
              <button className="primary">Save group</button>
            </fieldset>
          </form>
        </Dialog>
      )}
      {sharing && (
        <Dialog title="Share a Work task" onClose={() => setSharing(false)}>
          <p>
            This moves the task to Team. Personal tasks stay private. Choose
            members explicitly.
          </p>
          <label>
            Task
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Choose a task</option>
              {available.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          {!available.length && (
            <p>
              Add a Work task first. Repeating tasks remain in your own list.
            </p>
          )}
          <fieldset disabled={busy || !source} className="plain-fieldset">
            <SharingForm
              profile={profile}
              team={team}
              groups={groups}
              onSave={async (fields) => {
                if (
                  await run(
                    () => act("share", { id: source, ...fields }),
                    "Task shared.",
                  )
                ) {
                  onShared(source);
                  setSharing(false);
                }
              }}
            />
          </fieldset>
          <p role="status">{message}</p>
        </Dialog>
      )}
    </section>
  );
}
