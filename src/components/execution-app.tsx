"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Coffee,
  Inbox,
  LayoutGrid,
  List,
  LogOut,
  Plus,
  Search,
  Settings2,
  Users,
  X,
  Terminal,
  Activity,
  Archive,
  Focus as FocusIcon,
} from "lucide-react";
import {
  complete,
  Context,
  day,
  elapsed,
  newTask,
  parseCapture,
  recommend,
  Task,
} from "@/lib/engine";
import { useTasks } from "@/lib/use-tasks";
import { useReminders } from "@/lib/use-reminders";
import { supabase } from "@/lib/supabase";
import { TaskEditor } from "./task-editor";
import { Focus } from "./focus";
import { TaskRow } from "./task-row";
import { NextPanel } from "./next-panel";
import { DayFlow } from "./day-flow";
import { ExecutionDeck } from "./execution-deck";
import { ScheduleView } from "./schedule-view";
import { brand } from "@/lib/brand";
import { useAccount } from "@/lib/use-account";
import { SignIn } from "./sign-in";
import { AccountPanel } from "./account-panel";
import { TeamPanel } from "./team-panel";
import { HowTo } from "./how-to";
import { Celebration } from "./celebration";
import { useCollaboration } from "@/lib/use-collaboration";
import { SharedTaskDetails } from "./shared-task-details";
import { SystemPanel } from "./system-panel";
import { canManage } from "@/lib/collaboration";
type Screen =
  "Today" | "Inbox" | "Projects" | "Team" | "Settings" | "Vault" | "Analytics";
const screens = [
  { name: "Today", label: "Today", icon: Terminal },
  { name: "Schedule", label: "Schedule", icon: CalendarDays },
  { name: "Inbox", label: "Inbox", icon: Inbox },
  { name: "Projects", label: "Projects", icon: LayoutGrid },
  { name: "Team", label: "Team", icon: Users },
  { name: "Vault", label: "History", icon: Archive },
  { name: "Analytics", label: "Time", icon: Activity },
] as const;
export function ExecutionApp() {
  const { tasks, update, user, ready, status, cloud, retry } = useTasks();
  const account = useAccount(user);
  const [memberPreview, setMemberPreview] = useState(false);
  const memberProfile =
    account.profile && memberPreview
      ? { ...account.profile, role: "user" as const }
      : account.profile;
  const collaboration = useCollaboration(user?.id);
  const [sharedEdit, setSharedEdit] = useState<string | null>(null),
    [sharedUndo, setSharedUndo] = useState<{
      id: string;
      state: Task["state"];
    } | null>(null),
    [showDone, setShowDone] = useState(true),
    [undo, setUndo] = useState<{ before: Task; spawned: string[] } | null>(
      null,
    );
  const sharedEditing = collaboration.tasks.find((t) => t.id === sharedEdit);
  const [quickOptions, setQuickOptions] = useState(false),
    [quickDate, setQuickDate] = useState(""),
    [quickMinutes, setQuickMinutes] = useState(""),
    [quickPriority, setQuickPriority] = useState<1 | 2 | 3>(2);
  const [help, setHelp] = useState(false),
    [celebrating, setCelebrating] = useState(false);
  const closeCelebration = useCallback(() => setCelebrating(false), []);
  const [screen, setScreen] = useState<Screen>("Today"),
    [context, setContext] = useState<"All" | Context>("All"),
    [mode, setMode] = useState("List"),
    [capture, setCapture] = useState(""),
    [query, setQuery] = useState(""),
    [edit, setEdit] = useState<string | null>(null),
    [focus, setFocus] = useState<string | null>(null),
    [why, setWhy] = useState(false),
    [available, setAvailable] = useState(60),
    [toast, setToast] = useState(""),
    [assistant, setAssistant] = useState("Helpful"),
    [notification, setNotification] = useState(false),
    [drag, setDrag] = useState<string | null>(null),
    [today, setToday] = useState(day());
  const [tunnel, setTunnel] = useState(false);
  const [draftNew, setDraftNew] = useState<Task | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const navigationReady = useRef(false);
  useEffect(() => {
    const read = () => {
      const value = location.hash.slice(1);
      if (value === "Schedule") {
        setScreen("Today");
        setMode("Schedule");
      } else if (
        [
          "Today",
          "Inbox",
          "Projects",
          "Team",
          "Settings",
          "Vault",
          "Analytics",
        ].includes(value)
      ) {
        setScreen(value as Screen);
        setMode("List");
      }
    };
    read();
    window.addEventListener("popstate", read);
    window.addEventListener("hashchange", read);
    return () => {
      window.removeEventListener("popstate", read);
      window.removeEventListener("hashchange", read);
    };
  }, []);
  useEffect(() => {
    if (!navigationReady.current) {
      navigationReady.current = true;
      return;
    }
    const value =
      screen === "Today" && mode === "Schedule" ? "Schedule" : screen;
    if (location.hash !== "#" + value) history.pushState(null, "", "#" + value);
  }, [screen, mode]);
  useEffect(() => {
    setMemberPreview(false);
    setEdit(null);
    setFocus(null);
    setDraftNew(null);
    setSharedEdit(null);
    setToast("");
  }, [user?.id]);
  useEffect(() => {
    try {
      const settings = JSON.parse(
        localStorage.getItem("todo-settings") || "{}",
      );
      setAssistant(settings.assistant || "Helpful");
      setNotification(!!settings.notification);
    } catch {}
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setScreen("Today");
        setMode("List");
        requestAnimationFrame(() => input.current?.focus());
      }
      if (e.key === "Escape") {
        setEdit(null);
        setDraftNew(null);
        setFocus(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setTunnel((v) => !v);
      }
    };
    window.addEventListener("keydown", key);
    const i = setInterval(() => setToday(day()), 60000);
    return () => {
      window.removeEventListener("keydown", key);
      clearInterval(i);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(
      () => {
        setToast("");
        setUndo(null);
        setSharedUndo(null);
      },
      toast === "Done." ? 8000 : 4500,
    );
    return () => clearTimeout(t);
  }, [toast]);
  useReminders(tasks, notification, assistant, user?.id || "preview");
  const visible = tasks
    .filter(
      (t) =>
        !t.archived &&
        t.state !== "DONE" &&
        (context === "All" || t.context === context) &&
        t.title.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => a.rank - b.rank);
  const scheduleTasks = [
    ...tasks,
    ...collaboration.tasks.map((t) => ({ ...t.payload, archived: false })),
  ].filter(
    (t) =>
      !t.archived &&
      (showDone || t.state !== "DONE") &&
      (context === "All" || t.context === context) &&
      t.title.toLowerCase().includes(query.toLowerCase()),
  );
  const next = recommend(
      [
        ...tasks,
        ...collaboration.tasks
          .filter(
            (t) =>
              canManage(t, user?.id || "") &&
              (!t.assignee || t.assignee === user?.id),
          )
          .map((t) => ({ ...t.payload, archived: false })),
      ].filter(
        (t) => !t.archived && (context === "All" || t.context === context),
      ),
      available,
    ),
    committed = visible.filter((t) => t.committed && t.state !== "WAITING"),
    later = visible.filter((t) => !t.committed && t.state !== "WAITING");
  const active = [
    ...collaboration.tasks.map((t) => t.payload),
    ...tasks.filter((t) => !t.archived),
  ].find((t) => t.id === focus);
  const myShared = collaboration.tasks.filter(
    (t) =>
      (!t.assignee && t.owner_id === user?.id) ||
      (t.assignee === user?.id && t.assignment_status === "accepted"),
  );
  const myTasks = [
    ...tasks.filter((t) => !t.archived),
    ...myShared.map((t) => t.payload),
  ];
  const editing = draftNew || tasks.find((t) => t.id === edit);
  const completed = myTasks.filter(
    (t) => !t.archived && t.state === "DONE",
  ).length;
  const total = myTasks.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  function createDraft() {
    setDraftNew(newTask("", Math.max(-1, ...tasks.map((t) => t.rank)) + 1));
  }
  function patch(id: string, p: Partial<Task>) {
    const shared = collaboration.tasks.find((t) => t.id === id);
    if (shared) {
      const fields = { ...p };
      delete fields.seconds;
      delete fields.runningSince;
      void collaboration
        .act(p.state === "PAUSED" ? "pause" : "update", {
          id,
          version: shared.version,
          patch: fields,
        })
        .catch((e) => setToast(e.message));
      return;
    }
    update(tasks.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }
  function openTask(id: string) {
    if (collaboration.tasks.some((t) => t.id === id)) setSharedEdit(id);
    else setEdit(id);
  }
  function recordCompletion(t: Task, before = t) {
    const result = complete(t);
    setUndo({
      before: {
        ...before,
        seconds: elapsed(before),
        runningSince: null,
        state:
          before.state === "ACTIVE"
            ? "PAUSED"
            : before.state === "DONE"
              ? "TODO"
              : before.state,
      },
      spawned: result.slice(1).map((x) => x.id),
    });
    update([...tasks.filter((x) => x.id !== t.id), ...result]);
    setFocus(null);
    setCelebrating(true);
    setToast("Done.");
  }
  function finish(t: Task) {
    if (t.state === "DONE") return;
    const shared = collaboration.tasks.find((s) => s.id === t.id);
    if (shared) {
      void collaboration
        .act("update", {
          id: t.id,
          version: shared.version,
          patch: { state: "DONE" },
        })
        .then(() => {
          setSharedUndo({
            id: t.id,
            state: t.state === "ACTIVE" ? "PAUSED" : t.state,
          });
          setUndo(null);
          setFocus(null);
          setCelebrating(true);
          setToast("Done.");
        })
        .catch((e) => setToast(e.message));
      return;
    }
    if (
      t.actions.some((a) => !a.done) &&
      !window.confirm("Some steps are still open. Finish this task anyway?")
    )
      return;
    recordCompletion(t);
  }
  function start(t: Task) {
    const shared = collaboration.tasks.find((s) => s.id === t.id);
    const current = [
      ...tasks.filter((t) => !t.archived),
      ...collaboration.tasks
        .filter((s) => canManage(s, user?.id || ""))
        .map((s) => s.payload),
    ].find((x) => x.state === "ACTIVE" && x.id !== t.id);
    if (
      current &&
      !window.confirm(`Pause “${current.title}” and start this instead?`)
    )
      return;
    const currentShared = collaboration.tasks.find((s) => s.id === current?.id);
    if (shared || currentShared) {
      void (async () => {
        if (currentShared)
          await collaboration.act("pause", {
            id: currentShared.id,
            version: currentShared.version,
          });
        if (shared) {
          if (current && !currentShared)
            update(
              tasks.map((x) =>
                x.id === current.id
                  ? {
                      ...x,
                      state: "PAUSED",
                      seconds: elapsed(x),
                      runningSince: null,
                    }
                  : x,
              ),
            );
          await collaboration.act("start", {
            id: t.id,
            version: shared.version,
          });
          setFocus(t.id);
        } else startPrivate(t);
      })().catch((e) => setToast(e.message));
      return;
    }
    startPrivate(t);
  }
  function startPrivate(t: Task) {
    update(
      tasks.map((x) =>
        x.id === t.id
          ? {
              ...x,
              state: "ACTIVE",
              seconds: elapsed(x),
              runningSince: Date.now(),
            }
          : x.state === "ACTIVE"
            ? { ...x, state: "PAUSED", seconds: elapsed(x), runningSince: null }
            : x,
      ),
    );
    setFocus(t.id);
    window.scrollTo(0, 0);
  }
  function captureTask(e: React.FormEvent) {
    e.preventDefault();
    if (!capture.trim()) return;
    const t = parseCapture(
      capture.trim(),
      Math.max(-1, ...tasks.map((x) => x.rank)) + 1,
    );
    if (context !== "All" && !/@(work|personal)\b/i.test(capture))
      t.context = context;
    if (quickOptions) {
      if (
        quickMinutes &&
        (!Number.isInteger(Number(quickMinutes)) ||
          Number(quickMinutes) < 0 ||
          Number(quickMinutes) > 1440)
      ) {
        setToast("Use 0–1440 minutes.");
        return;
      }
      if (quickDate) {
        t.due = quickDate;
        t.committed = quickDate === day();
      }
      if (quickMinutes) t.duration = Number(quickMinutes);
      t.priority = quickPriority;
    }
    if (!t.title) {
      setToast("Add a task title before the capture shortcuts.");
      return;
    }
    update([...tasks, t]);
    setCapture("");
    setToast("Added.");
  }
  function move(id: string, targetId: string) {
    const ordered = tasks
      .filter((t) => !t.archived)
      .sort((a, b) => a.rank - b.rank);
    const from = ordered.findIndex((t) => t.id === id),
      to = ordered.findIndex((t) => t.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    const ranks = new Map(ordered.map((t, i) => [t.id, i]));
    update(tasks.map((t) => ({ ...t, rank: ranks.get(t.id) ?? t.rank })));
  }
  function snooze(t: Task) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const shared = collaboration.tasks.find((s) => s.id === t.id);
    if (shared) {
      void collaboration
        .act("update", {
          id: t.id,
          version: shared.version,
          patch: { due: day(d), start: "", state: "RESCHEDULED" },
        })
        .then(() => setToast("Moved to tomorrow."))
        .catch((e) => setToast(e.message));
      return;
    }
    patch(t.id, {
      due: day(d),
      start: "",
      committed: false,
      state: "RESCHEDULED",
      snoozes: t.snoozes + 1,
      seconds: elapsed(t),
      runningSince: null,
    });
    setToast("Moved to tomorrow.");
  }
  function row(t: Task) {
    if (collaboration.tasks.some((x) => x.id === t.id))
      return (
        <button
          className="shared-task-card"
          key={t.id}
          onClick={() => openTask(t.id)}
        >
          <strong>
            {t.state === "DONE" ? "✓ " : ""}
            {t.title}
          </strong>
          <small>
            Shared Work task
            {t.start
              ? ` · ${new Date(t.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </small>
        </button>
      );
    return (
      <TaskRow
        key={t.id}
        t={t}
        personName={account.team.find((p) => p.id === t.person)?.display_name}
        today={today}
        visible={visible}
        drag={drag}
        setDrag={setDrag}
        move={move}
        finish={finish}
        setEdit={setEdit}
        snooze={snooze}
        start={start}
        schedule={(start) =>
          patch(t.id, {
            start,
            duration: t.duration || 30,
            state: t.state === "DONE" ? "DONE" : "SCHEDULED",
          })
        }
      />
    );
  }
  function captureBar() {
    return (
      <div className="capture-card">
        <form className="capture" onSubmit={captureTask}>
          <Plus size={20} />
          <input
            ref={input}
            aria-label="Capture a task"
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
            placeholder="Add a task"
          />
          <button aria-label="Add task" disabled={!capture.trim()}>
            <span className="desktop-enter">ADD</span>
            <Plus className="mobile-send" size={19} />
          </button>
        </form>
        <button
          className="text-button quick-options-toggle"
          aria-expanded={quickOptions}
          onClick={() => setQuickOptions(!quickOptions)}
        >
          Options
        </button>
        {quickOptions && (
          <div className="quick-options">
            <label>
              Due
              <input
                type="date"
                value={quickDate}
                onChange={(e) => setQuickDate(e.target.value)}
              />
            </label>
            <label>
              Minutes
              <input
                type="number"
                min={0}
                max={1440}
                value={quickMinutes}
                onChange={(e) => setQuickMinutes(e.target.value)}
              />
            </label>
            <label>
              Priority
              <select
                value={quickPriority}
                onChange={(e) =>
                  setQuickPriority(Number(e.target.value) as 1 | 2 | 3)
                }
              >
                <option value={1}>Urgent</option>
                <option value={2}>Normal</option>
                <option value={3}>Low</option>
              </select>
            </label>
          </div>
        )}
        <details className="capture-shortcuts">
          <summary>Shortcuts</summary>
          <div className="capture-syntax">
            <span>Shortcuts:</span>
            <span className="syntax-tag">@tag</span>
            <span className="syntax-priority">#priority</span>
            <span className="syntax-duration">~duration</span>
            <span className="syntax-date">!date</span>
            <span className="parser-status">
              <i />
            </span>
          </div>
        </details>
      </div>
    );
  }
  function section(title: string, items: Task[], description?: string) {
    return (
      <section className="task-section">
        <header>
          <h2>
            {title}
            <span>{items.length}</span>
          </h2>
          {description && <p>{description}</p>}
        </header>
        {items.length ? (
          items.map(row)
        ) : (
          <div className="empty-inline">No tasks.</div>
        )}
      </section>
    );
  }
  if (!ready)
    return (
      <div className="loading">
        <img src={brand.icon} alt="" width="48" height="48" />
        <h2>{brand.name}</h2>
        <p>Loading…</p>
      </div>
    );
  if (!cloud)
    return (
      <main className="auth-page">
        <h1>to:DO</h1>
        <p>Storage is not configured.</p>
      </main>
    );
  if (!user) return <SignIn />;
  if (!account.profile || account.profile.id !== user.id)
    return (
      <main className="auth-page">
        <h1>to:DO</h1>
        <p>{account.error || "Loading account…"}</p>
        <button className="secondary" onClick={() => void account.refresh()}>
          Retry
        </button>
        <button
          className="text-button"
          onClick={() => supabase!.auth.signOut()}
        >
          Sign out
        </button>
      </main>
    );
  if (active)
    return (
      <Focus
        task={active}
        onPause={() =>
          patch(active.id, {
            state: "PAUSED",
            seconds: elapsed(active),
            runningSince: null,
          })
        }
        onResume={() => start(active)}
        onDone={() => finish(active)}
        onClose={() => setFocus(null)}
        onStep={(id) =>
          patch(active.id, {
            actions: active.actions.map((a) =>
              a.id === id ? { ...a, done: true } : a,
            ),
          })
        }
        onExtend={() => patch(active.id, { duration: active.duration + 10 })}
        onCapture={(title) => {
          const t = parseCapture(
            title,
            Math.max(-1, ...tasks.map((x) => x.rank)) + 1,
          );
          if (t.title) {
            update([...tasks, t]);
            if (collaboration.tasks.some((s) => s.id === active.id))
              start(active);
            else
              update([
                ...tasks.map((x) =>
                  x.id === active.id
                    ? {
                        ...x,
                        state: "ACTIVE" as const,
                        seconds: elapsed(x),
                        runningSince: Date.now(),
                      }
                    : x,
                ),
                t,
              ]);
          }
        }}
      />
    );
  return (
    <div className={`app-shell ${tunnel ? "focus-tunnel" : ""}`}>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="to:DO home">
          <img src={brand.icon} alt="" width="35" height="35" />
          to:DO
        </a>
        <div className="sidebar-status">
          <span className="status-dot" />
          {cloud ? status : "Local workspace"}
        </div>
        <button
          className="quick-capture"
          onClick={() => input.current?.focus()}
        >
          <Search size={16} />
          Quick capture<kbd>⌘K</kbd>
        </button>
        <span className="space-label">WORKSPACES</span>
        <div className="workspace-pills">
          {(["All", "Personal", "Work"] as const).map((c) => (
            <button
              key={c}
              aria-pressed={context === c}
              onClick={() => setContext(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <nav>
          {screens.map((s) => (
            <button
              key={s.name}
              className={
                (
                  s.name === "Schedule"
                    ? screen === "Today" && mode === "Schedule"
                    : screen === s.name && mode === "List"
                )
                  ? `nav-item selected ${s.name === "Vault" || s.name === "Analytics" ? "desktop-only" : ""}`
                  : `nav-item ${s.name === "Vault" || s.name === "Analytics" ? "desktop-only" : ""}`
              }
              aria-current={
                (
                  s.name === "Schedule"
                    ? screen === "Today" && mode === "Schedule"
                    : screen === s.name && mode === "List"
                )
                  ? "page"
                  : undefined
              }
              onClick={() => {
                setScreen(s.name === "Schedule" ? "Today" : s.name);
                setMode(s.name === "Schedule" ? "Schedule" : "List");
                window.scrollTo(0, 0);
              }}
            >
              <s.icon size={19} />
              <span className="nav-desktop-label">{s.label}</span>
              <span className="nav-mobile-label">{s.name}</span>
              {s.name === "Inbox" && (
                <span className="nav-count">
                  {
                    tasks.filter(
                      (t) => !t.archived && t.state === "TODO" && !t.committed,
                    ).length
                  }
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note" hidden>
          <Coffee size={22} />
          <p>
            <br />
          </p>
        </div>
        <div className="sidebar-bottom">
          <button
            aria-label="Account"
            className={screen === "Settings" ? "nav-item selected" : "nav-item"}
            onClick={() => {
              setScreen("Settings");
              window.scrollTo(0, 0);
            }}
          >
            <Settings2 size={19} />
            <span>Account</span>
          </button>
          <div className="profile">
            <span className="avatar">
              {account.profile.display_name[0]?.toUpperCase() || "U"}
            </span>
            <div>
              <strong>
                {account.profile.display_name || account.profile.username}
              </strong>
              <small>{account.profile.job_title || "Account"}</small>
            </div>
            {user && (
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={() => supabase!.auth.signOut()}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-identity">
            <span className="mobile-page-title">
              {screen === "Today"
                ? mode === "Schedule"
                  ? "Schedule"
                  : "Today"
                : screen === "Settings"
                  ? "Account"
                  : screen}
            </span>
            <span className="brand">
              <img src={brand.icon} alt="" width="28" height="28" />
              to:DO
            </span>
            <span className="breadcrumb-slash">/</span>
            <div className="day-progress">
              <span>TASKS</span>
              <div>
                <i style={{ width: `${progress}%` }} />
              </div>
              <strong>{progress}%</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              className="tunnel-toggle"
              aria-pressed={tunnel}
              onClick={() => setTunnel(!tunnel)}
            >
              <FocusIcon size={16} />
              {"Dim panels"}
              <kbd>⌘B</kbd>
            </button>
            <button
              className="primary new-task"
              hidden={screen === "Team" || screen === "Settings"}
              onClick={createDraft}
            >
              <Plus size={16} />
              Add task
            </button>
            <button
              className="icon-button"
              aria-label="Toggle Split View"
              hidden={screen === "Team" || screen === "Settings"}
              onClick={() => {
                setScreen("Today");
                setMode(mode === "Split" ? "List" : "Split");
              }}
            >
              <LayoutGrid size={16} />
            </button>
            <span className="sync-status">
              <span className="status-dot" />
              {status}
            </span>
          </div>
        </header>
        <main className="content">
          {memberPreview && (
            <div className="save-feedback" role="status">
              Member view
              <button onClick={() => setMemberPreview(false)}>Exit</button>
            </div>
          )}
          {status !== "Saved" && status !== "Sign in" && (
            <div className="save-feedback" role="status">
              {status}
              {status !== "Saving…" && (
                <button className="text-button" onClick={retry}>
                  Retry
                </button>
              )}
            </div>
          )}
          <div className="command-heading">
            <div>
              <h1>
                {screen === "Today"
                  ? mode === "Schedule"
                    ? "Schedule"
                    : "Today"
                  : screen === "Vault"
                    ? "History"
                    : screen === "Analytics"
                      ? "Time"
                      : screen === "Settings"
                        ? "Account"
                        : screen}
              </h1>
              <span className="date-label">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <div
              className="search"
              hidden={screen === "Team" || screen === "Settings"}
            >
              <Search size={16} />
              <input
                aria-label="Search tasks"
                placeholder="Search tasks"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="tunnel-banner" hidden>
            <span>
              <FocusIcon size={15} />
              {tunnel
                ? "Focus Mode active — Secondary panels blurred"
                : "Standard view — Your execution workspace"}
            </span>
            <button onClick={() => setTunnel(!tunnel)}>
              Press <kbd>⌘B</kbd> to toggle preview
            </button>
          </div>
          {screen !== "Team" && screen !== "Settings" && captureBar()}
          {screen !== "Settings" && screen !== "Team" && (
            <div className="view-toolbar">
              <div className="segments">
                {(["All", "Personal", "Work"] as const).map((c) => (
                  <button
                    className={context === c ? "active" : ""}
                    aria-pressed={context === c}
                    onClick={() => setContext(c)}
                    key={c}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="view-buttons">
                <label className="inline-check show-done">
                  <input
                    type="checkbox"
                    checked={showDone}
                    onChange={(e) => setShowDone(e.target.checked)}
                  />
                  Show done
                </label>
                {[
                  { name: "List", icon: List },
                  { name: "Schedule", icon: CalendarDays },
                  { name: "Split", icon: LayoutGrid },
                ].map((v) => (
                  <button
                    key={v.name}
                    className={mode === v.name ? "active" : ""}
                    aria-label={v.name}
                    aria-pressed={mode === v.name}
                    onClick={() => setMode(v.name)}
                  >
                    <v.icon size={16} />
                    <span>{v.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {screen === "Today" && mode === "List" && (
            <div className="today-layout">
              <DayFlow
                tasks={scheduleTasks}
                onEdit={openTask}
                onSchedule={() => setMode("Schedule")}
              />
              <div className="execution-lane">
                <NextPanel
                  next={next}
                  today={today}
                  available={available}
                  setAvailable={setAvailable}
                  why={why}
                  setWhy={setWhy}
                  start={start}
                  assistant={assistant}
                  finish={finish}
                  snooze={snooze}
                />
                <div className="queue secondary-panel">
                  {section("Queue", committed, "Sort: Your order")}
                  {section("Later", later)}
                  {myShared.length > 0 &&
                    section(
                      "Shared tasks",
                      myShared
                        .map((t) => t.payload)
                        .filter(
                          (t) =>
                            (showDone || t.state !== "DONE") &&
                            (context === "All" || context === "Work") &&
                            t.title.toLowerCase().includes(query.toLowerCase()),
                        ),
                    )}
                  {showDone &&
                    tasks.some((t) => !t.archived && t.state === "DONE") &&
                    section(
                      "Done",
                      tasks.filter(
                        (t) =>
                          !t.archived &&
                          t.state === "DONE" &&
                          (context === "All" || context === t.context) &&
                          t.title.toLowerCase().includes(query.toLowerCase()),
                      ),
                    )}
                </div>
                <div className="summary-ribbon secondary-panel">
                  <div>
                    <span>TIME SPENT</span>
                    <strong>
                      {Math.floor(
                        myTasks.reduce((s, t) => s + elapsed(t), 0) / 60,
                      )}{" "}
                      min
                    </strong>
                  </div>
                  <div>
                    <span>DONE</span>
                    <strong className="positive">
                      {completed} of {total}
                    </strong>
                  </div>
                  <div>
                    <span>AVAILABLE TIME</span>
                    <strong>{available} min</strong>
                  </div>
                </div>
              </div>
              <ExecutionDeck
                tasks={myTasks.filter(
                  (t) => context === "All" || t.context === context,
                )}
                status={status}
                cloud={cloud}
                team={account.team}
                onEdit={openTask}
                onPeople={() => {
                  setScreen("Team");
                  setMode("List");
                }}
              />
            </div>
          )}
          {screen === "Inbox" &&
            mode === "List" &&
            section(
              "Inbox",
              visible.filter((t) => !t.committed),
              "",
            )}
          {screen === "Projects" && mode === "List" && (
            <div className="projects">
              {visible
                .filter((t) => t.actions.length)
                .map((t) => (
                  <button
                    key={t.id}
                    className="project"
                    onClick={() => setEdit(t.id)}
                  >
                    <span className={`context ${t.context.toLowerCase()}`}>
                      {t.context}
                    </span>
                    <h2>{t.title}</h2>
                    <div className="progress">
                      <span
                        style={{
                          width: `${(t.actions.filter((a) => a.done).length / t.actions.length) * 100}%`,
                        }}
                      />
                    </div>
                    <p>
                      {t.actions.filter((a) => a.done).length} of{" "}
                      {t.actions.length} steps complete
                    </p>
                    <strong>
                      Next:{" "}
                      {t.actions.find((a) => !a.done)?.title ||
                        "Ready to finish"}
                    </strong>
                    <ArrowRight size={18} />
                  </button>
                ))}
              {!visible.some((t) => t.actions.length) && (
                <div className="empty-inline">
                  Add steps to a task to see it here.
                </div>
              )}
            </div>
          )}
          {screen === "Team" && (
            <TeamPanel
              profile={memberProfile!}
              team={account.team}
              refresh={account.refresh}
              tasks={collaboration.tasks}
              groups={collaboration.groups}
              privateTasks={status === "Saved" ? tasks : []}
              act={collaboration.act}
              onSelect={setSharedEdit}
              onShared={(id) =>
                update(
                  tasks.map((t) =>
                    t.id === id
                      ? {
                          ...t,
                          archived: true,
                          source: "shared",
                          runningSince: null,
                        }
                      : t,
                  ),
                )
              }
            />
          )}
          {screen !== "Settings" && screen !== "Team" && mode === "Split" && (
            <div className="split">
              {(["Personal", "Work"] as const)
                .filter((c) => context === "All" || context === c)
                .map((c) => (
                  <div key={c}>
                    {section(
                      c,
                      visible.filter((t) => t.context === c),
                    )}
                  </div>
                ))}
            </div>
          )}
          {screen !== "Settings" &&
            screen !== "Team" &&
            mode === "Schedule" && (
              <ScheduleView
                tasks={scheduleTasks}
                onEdit={openTask}
                onNew={(start) =>
                  setDraftNew({
                    ...newTask(
                      "",
                      Math.max(-1, ...tasks.map((t) => t.rank)) + 1,
                    ),
                    start,
                    duration: 30,
                  })
                }
                row={row}
              />
            )}
          {screen === "Analytics" && (
            <section className="analytics-page">
              <h2>Time</h2>
              <p>Time spent on tasks.</p>
              <div className="metrics-grid">
                {(["Personal", "Work"] as const).map((c) => (
                  <div key={c}>
                    <span>{c.toUpperCase()}</span>
                    <strong>
                      {Math.floor(
                        myTasks
                          .filter((t) => t.context === c)
                          .reduce((s, t) => s + elapsed(t), 0) / 60,
                      )}{" "}
                      min
                    </strong>
                    <small>
                      {
                        myTasks.filter(
                          (t) => t.context === c && t.state === "DONE",
                        ).length
                      }{" "}
                      completed tasks
                    </small>
                  </div>
                ))}
              </div>
            </section>
          )}
          {(screen === "Settings" || screen === "Vault") && (
            <section className="settings">
              {screen === "Settings" && (
                <AccountPanel
                  key={account.profile.id}
                  profile={account.profile}
                  preview={memberPreview}
                  onPreview={() => setMemberPreview(!memberPreview)}
                  onNavigate={(s) => {
                    setScreen(s);
                    setMode("List");
                  }}
                  save={account.save}
                  onHelp={() => setHelp(true)}
                  onMessage={setToast}
                />
              )}
              {screen === "Settings" &&
                account.profile.role === "super_admin" &&
                !memberPreview && <SystemPanel team={account.team} />}
              {screen === "Vault" && (
                <>
                  <h2>History</h2>
                  {tasks
                    .filter(
                      (t) =>
                        t.source !== "shared" &&
                        (t.archived || t.state === "DONE"),
                    )
                    .map((t) => (
                      <div className="archive-row" key={t.id}>
                        <span>
                          <Check size={15} /> {t.title}
                        </span>
                        <button
                          className="text-button"
                          onClick={() =>
                            patch(t.id, {
                              archived: false,
                              state: "TODO",
                              completedAt: undefined,
                            })
                          }
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                </>
              )}
            </section>
          )}
          <footer className="content-footer">
            <span className="brand-small">{brand.name}</span>

            <span>
              {visible.length} open {visible.length === 1 ? "task" : "tasks"}
            </span>
          </footer>
        </main>
      </div>
      {editing && (
        <TaskEditor
          key={editing.id}
          task={editing}
          team={account.team}
          onClose={() => {
            setEdit(null);
            setDraftNew(null);
          }}
          onDelete={() => {
            if (draftNew) {
              setDraftNew(null);
              return;
            }
            patch(editing.id, {
              archived: true,
              seconds: elapsed(editing),
              runningSince: null,
              state: "PAUSED",
            });
            setEdit(null);
            setToast("Archived.");
          }}
          onSave={(t) => {
            if (t.state === "DONE" && (draftNew || editing.state !== "DONE")) {
              recordCompletion(
                {
                  ...t,
                  title: t.title.trim(),
                  seconds: elapsed(editing),
                  runningSince: null,
                },
                {
                  ...t,
                  state: draftNew ? "TODO" : editing.state,
                  completedAt: editing.completedAt,
                },
              );
              setDraftNew(null);
              setEdit(null);
              setCelebrating(true);
              return;
            }
            if (draftNew) {
              update([...tasks, { ...t, title: t.title.trim() }]);
              setDraftNew(null);
              setToast("Added.");
              return;
            }
            patch(t.id, {
              ...t,
              state: t.state === "ACTIVE" ? "PAUSED" : t.state,
              seconds: elapsed(editing),
              runningSince: null,
            });
            setEdit(null);
            setToast("Saved.");
          }}
        />
      )}
      {sharedEditing && (
        <SharedTaskDetails
          key={sharedEditing.id}
          task={sharedEditing}
          profile={account.profile}
          team={account.team}
          groups={collaboration.groups}
          act={collaboration.act}
          onClose={() => setSharedEdit(null)}
          onFinish={() => setCelebrating(true)}
          onStart={() => {
            setSharedEdit(null);
            start(sharedEditing.payload);
          }}
        />
      )}
      {collaboration.error && (
        <div className="cloud-error" role="status">
          {collaboration.error}
          <button onClick={() => void collaboration.refresh()}>Retry</button>
        </div>
      )}
      {(help || !account.profile.onboarded) && (
        <HowTo
          name={account.profile.display_name || account.profile.username}
          onDone={async () => {
            if (await account.save({ onboarded: true })) setHelp(false);
          }}
        />
      )}
      {celebrating && <Celebration onEnd={closeCelebration} />}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          {sharedUndo && toast === "Done." && (
            <button
              className="text-button"
              onClick={() => {
                const t = collaboration.tasks.find(
                  (t) => t.id === sharedUndo.id,
                );
                if (t)
                  void collaboration
                    .act("update", {
                      id: t.id,
                      version: t.version,
                      patch: { state: sharedUndo.state },
                    })
                    .then(() => {
                      setSharedUndo(null);
                      setCelebrating(false);
                      setToast("Reopened.");
                    })
                    .catch((e) => setToast(e.message));
              }}
            >
              Undo
            </button>
          )}
          {undo && toast === "Done." && (
            <button
              className="text-button"
              onClick={() => {
                update([
                  ...tasks.filter(
                    (t) =>
                      t.id !== undo.before.id && !undo.spawned.includes(t.id),
                  ),
                  undo.before,
                ]);
                setUndo(null);
                setCelebrating(false);
                setToast("Reopened.");
              }}
            >
              Undo
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
