"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Coffee,
  Download,
  GripVertical,
  Inbox,
  LayoutGrid,
  List,
  LogOut,
  Plus,
  Search,
  Settings2,
  Sun,
  Users,
  X,
  Terminal,
  Activity,
  Archive,
  Focus as FocusIcon,
  Keyboard,
} from "lucide-react";
import {
  complete,
  Context,
  day,
  elapsed,
  newTask,
  parseCapture,
  overlaps,
  reasons,
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
type Screen =
  | "Today"
  | "Inbox"
  | "Projects"
  | "People"
  | "Settings"
  | "Vault"
  | "Analytics";
const screens = [
  { name: "Today", label: "Command Center", icon: Terminal },
  { name: "Schedule", label: "Schedule & Timeline", icon: CalendarDays },
  { name: "Inbox", label: "Inbox", icon: Inbox },
  { name: "Projects", label: "Projects", icon: LayoutGrid },
  { name: "People", label: "People", icon: Users },
  { name: "Vault", label: "Vault & Archive", icon: Archive },
  { name: "Analytics", label: "Focus Analytics", icon: Activity },
] as const;
export function ExecutionApp() {
  const { tasks, update, user, ready, status, cloud } = useTasks();
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
    [email, setEmail] = useState(""),
    [authMessage, setAuthMessage] = useState(""),
    [assistant, setAssistant] = useState("Helpful"),
    [notification, setNotification] = useState(false),
    [drag, setDrag] = useState<string | null>(null),
    [today, setToday] = useState(day());
  const [tunnel, setTunnel] = useState(true);
  const [draftNew, setDraftNew] = useState<Task | null>(null);
  const input = useRef<HTMLInputElement>(null);
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
        input.current?.focus();
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
    const t = setTimeout(() => setToast(""), 4500);
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
  const next = recommend(visible, available),
    committed = visible.filter((t) => t.committed && t.state !== "WAITING"),
    later = visible.filter((t) => !t.committed && t.state !== "WAITING"),
    waiting = visible.filter((t) => t.state === "WAITING");
  const active = tasks.find((t) => t.id === focus);
  const editing = draftNew || tasks.find((t) => t.id === edit);
  const completed = tasks.filter(
    (t) => !t.archived && t.state === "DONE",
  ).length;
  const total = tasks.filter((t) => !t.archived).length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  function createDraft() {
    setDraftNew(newTask("", Math.max(-1, ...tasks.map((t) => t.rank)) + 1));
  }
  function patch(id: string, p: Partial<Task>) {
    update(tasks.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }
  function finish(t: Task) {
    if (
      t.actions.some((a) => !a.done) &&
      !window.confirm("Some steps are still open. Finish this task anyway?")
    )
      return;
    update([...tasks.filter((x) => x.id !== t.id), ...complete(t)]);
    setFocus(null);
    setToast("Finished. A little more space in your day.");
  }
  function start(t: Task) {
    const current = tasks.find((x) => x.state === "ACTIVE" && x.id !== t.id);
    if (
      current &&
      !window.confirm(`Pause “${current.title}” and start this instead?`)
    )
      return;
    update(
      tasks.map((x) =>
        x.id === t.id
          ? { ...x, state: "ACTIVE", seconds:elapsed(x), runningSince: Date.now() }
          : x.state === "ACTIVE"
            ? { ...x, state: "PAUSED", seconds: elapsed(x), runningSince: null }
            : x,
      ),
    );
    setFocus(t.id);
    window.scrollTo(0,0);
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
    if (!t.title) {
      setToast("Add a task title before the capture shortcuts.");
      return;
    }
    update([...tasks, t]);
    setCapture("");
    setToast("Captured. It’s safe in your Inbox.");
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
    patch(t.id, {
      due: day(d),
      start: "",
      committed: false,
      state: "RESCHEDULED",
      snoozes: t.snoozes + 1,
      seconds: elapsed(t),
      runningSince: null,
    });
    setToast("Moved to tomorrow. Room to decide again.");
  }
  function row(t: Task) {
    return (
      <TaskRow
        key={t.id}
        t={t}
        today={today}
        visible={visible}
        drag={drag}
        setDrag={setDrag}
        move={move}
        finish={finish}
        setEdit={setEdit}
        snooze={snooze}
        start={start}
      />
    );
  }
  function captureBar() {
    return (
      <div className="capture-card">
        <form className="capture" onSubmit={captureTask}>
          <Keyboard size={20} />
          <input
            ref={input}
            aria-label="Capture a task"
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
            placeholder="Type task title @work #p1 ~45m !tomorrow..."
          />
          <button aria-label="Save task" disabled={!capture.trim()}>
            <span className="desktop-enter">ENTER</span>
            <ArrowRight className="mobile-send" size={19} />
          </button>
        </form>
        <div className="capture-syntax">
          <span>Syntax:</span>
          <span className="syntax-tag">@tag</span>
          <span className="syntax-priority">#priority</span>
          <span className="syntax-duration">~duration</span>
          <span className="syntax-date">!date</span>
          <span className="parser-status">
            <i />
            Quick capture ready
          </span>
        </div>
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
          <div className="empty-inline">
            A little breathing room. Add something when you’re ready.
          </div>
        )}
      </section>
    );
  }
  if (!ready)
    return (
      <div className="loading">
        <img src={brand.icon} alt="" width="48" height="48" />
        <h2>{brand.name}</h2>
        <p>Making room for your day…</p>
      </div>
    );
  if (cloud && !user)
    return (
      <div className="auth-page">
        <img src={brand.icon} width="56" height="56" alt="to:DO mark" />
        <h1>
          Less on your mind.
          <br />
          More in motion.
        </h1>
        <p>Your space to decide, do, and finish.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await supabase!.auth.signInWithOtp({
              email,
              options: { emailRedirectTo: window.location.origin },
            });
            setAuthMessage(
              error
                ? error.message
                : "Check your email for your secure sign-in link.",
            );
          }}
        >
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button className="primary">
            Send sign-in link <ArrowRight size={17} />
          </button>
          <p role="status">{authMessage}</p>
        </form>
      </div>
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
          if (t.title)
            update([
              ...tasks.map((x) =>
                x.id === active.id
                  ? { ...x, state: "ACTIVE" as const, runningSince: Date.now() }
                  : x,
              ),
              t,
            ]);
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
              {c === "All" ? "Core Ops" : c}
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
        <div className="sidebar-note">
          <Coffee size={22} />
          <p>
            A little clarity.
            <br />
            Then, a little progress.
          </p>
        </div>
        <div className="sidebar-bottom">
          <button
            className={screen === "Settings" ? "nav-item selected" : "nav-item"}
            onClick={() => {
              setScreen("Settings");
              window.scrollTo(0, 0);
            }}
          >
            <Settings2 size={19} />
            <span>System Settings</span>
          </button>
          <div className="profile">
            <span className="avatar">
              {user?.email?.[0]?.toUpperCase() || "Y"}
            </span>
            <div>
              <strong>{user?.email?.split("@")[0] || "Your space"}</strong>
              <small>{cloud ? "Personal account" : "Local preview"}</small>
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
                  ? "Settings"
                  : screen}
            </span>
            <span className="brand">
              <img src={brand.icon} alt="" width="28" height="28" />
              to:DO
            </span>
            <span className="breadcrumb-slash">/</span>
            <div className="day-progress">
              <span>DAY FLOW</span>
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
              {tunnel ? "Focus Active" : "Standard View"}
              <kbd>⌘B</kbd>
            </button>
            <button className="primary new-task" onClick={createDraft}>
              <Plus size={16} />
              New Task
            </button>
            <button
              className="icon-button"
              aria-label="Toggle Split View"
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
          <div className="command-heading">
            <div>
              <span className="status-dot" />
              <h1>
                {screen === "Today"
                  ? mode === "Schedule"
                    ? "Schedule & Timeline"
                    : "Command Center"
                  : screen === "Vault"
                    ? "Vault & Archive"
                    : screen === "Analytics"
                      ? "Focus Analytics"
                      : screen === "Settings"
                        ? "System Settings"
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
            <div className="search">
              <Search size={16} />
              <input
                aria-label="Search tasks"
                placeholder="Find a task"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="tunnel-banner">
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
          {(screen !== "Today" || mode !== "List") && captureBar()}
          {screen !== "Settings" && (
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
                tasks={visible}
                onEdit={setEdit}
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
                {captureBar()}
                <div className="queue secondary-panel">
                  {section("Queue", committed, "Sort: Your order")}
                  {section("Later today • Flexible", later)}
                </div>
                <div className="summary-ribbon secondary-panel">
                  <div>
                    <span>TOTAL FOCUS TIME</span>
                    <strong>
                      {Math.floor(
                        tasks.reduce((s, t) => s + elapsed(t), 0) / 60,
                      )}{" "}
                      min
                    </strong>
                  </div>
                  <div>
                    <span>TASKS COMPLETED</span>
                    <strong className="positive">
                      {completed} of {total}
                    </strong>
                  </div>
                  <div>
                    <span>AVAILABLE WINDOW</span>
                    <strong>{available} min</strong>
                  </div>
                </div>
              </div>
              <ExecutionDeck
                tasks={tasks.filter(
                  (t) => context === "All" || t.context === context,
                )}
                status={status}
                cloud={cloud}
                onEdit={setEdit}
                onPeople={() => {
                  setScreen("People");
                  setMode("List");
                }}
              />
            </div>
          )}
          {screen === "Inbox" &&
            mode === "List" &&
            section(
              "Your captured thoughts",
              visible.filter((t) => !t.committed),
              "Open a task to give it context, or just start.",
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
                  Any task can grow. Open one and add small steps.
                </div>
              )}
            </div>
          )}
          {screen === "People" && mode === "List" && (
            <>
              {[...new Set(visible.map((t) => t.person).filter(Boolean))].map(
                (person) =>
                  section(
                    person,
                    visible.filter((t) => t.person === person),
                    "Open commitments & follow-ups",
                  ),
              )}
              {!visible.some((t) => t.person) && (
                <div className="empty-inline">
                  Add a person to a task to keep a follow-up here.
                </div>
              )}
            </>
          )}
          {screen !== "Settings" && mode === "Split" && (
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
          {screen !== "Settings" && mode === "Schedule" && (
            <ScheduleView
              tasks={visible}
              onEdit={setEdit}
              onNew={(start) =>
                setDraftNew({
                  ...newTask("", Math.max(-1, ...tasks.map((t) => t.rank)) + 1),
                  start,
                  duration: 30,
                })
              }
              row={row}
            />
          )}
          {screen === "Analytics" && (
            <section className="analytics-page">
              <h2>Your focus, at your pace.</h2>
              <p>Actual elapsed time across your task pool.</p>
              <div className="metrics-grid">
                {(["Personal", "Work"] as const).map((c) => (
                  <div key={c}>
                    <span>{c.toUpperCase()}</span>
                    <strong>
                      {Math.floor(
                        tasks
                          .filter((t) => t.context === c)
                          .reduce((s, t) => s + elapsed(t), 0) / 60,
                      )}{" "}
                      min
                    </strong>
                    <small>
                      {
                        tasks.filter(
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
                <>
                  <label>
                    Assistant style
                    <select
                      value={assistant}
                      onChange={(e) => {
                        setAssistant(e.target.value);
                        localStorage.setItem(
                          "todo-settings",
                          JSON.stringify({
                            assistant: e.target.value,
                            notification,
                          }),
                        );
                      }}
                    >
                      <option>Gentle</option>
                      <option>Helpful</option>
                      <option>Proactive</option>
                    </select>
                  </label>
                  <p>
                    {assistant === "Gentle"
                      ? "Keep suggestions quiet; your list stays in charge."
                      : assistant === "Helpful"
                        ? "Explain useful next steps. Ask before changing plans."
                        : "Show more opportunities. Every adjustment remains your choice."}
                  </p>
                  <hr />
                  <h2>Useful reminders</h2>
                  <p>
                    While to:DO is open: upcoming commitments, follow-ups, and
                    time checkpoints. Background push is not connected yet.
                  </p>
                  <button
                    className="secondary"
                    onClick={async () => {
                      if (typeof Notification === "undefined") {
                        setToast("This browser doesn’t support notifications.");
                        return;
                      }
                      const granted = await Notification.requestPermission();
                      setNotification(granted === "granted");
                      localStorage.setItem(
                        "todo-settings",
                        JSON.stringify({
                          assistant,
                          notification: granted === "granted",
                        }),
                      );
                      setToast(
                        granted === "granted"
                          ? "Reminders enabled while to:DO is open."
                          : "Notification permission was not granted.",
                      );
                    }}
                  >
                    {notification ? "Reminders enabled" : "Enable reminders"}
                  </button>
                  {notification && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setNotification(false);
                        localStorage.setItem(
                          "todo-settings",
                          JSON.stringify({ assistant, notification: false }),
                        );
                      }}
                    >
                      Turn off
                    </button>
                  )}
                  <hr />
                  <h2>Your data belongs to you</h2>
                  <p>
                    {cloud
                      ? "Tasks sync to your Supabase account."
                      : "This preview stores tasks in this browser only. It does not sync between devices."}
                  </p>
                  <button
                    className="secondary"
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(tasks, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `to-DO-${today}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download size={16} />
                    Export your tasks
                  </button>
                  <hr />
                </>
              )}
              <h2>Finished & archived</h2>
              {tasks
                .filter((t) => t.archived || t.state === "DONE")
                .map((t) => (
                  <div className="archive-row" key={t.id}>
                    <span>
                      <Check size={15} /> {t.title}
                    </span>
                    <button
                      className="text-button"
                      onClick={() =>
                        patch(t.id, { archived: false, state: "TODO" })
                      }
                    >
                      Restore
                    </button>
                  </div>
                ))}
            </section>
          )}
          <footer className="content-footer">
            <span className="brand-small">{brand.name}</span>
            <span>Less managing. More doing.</span>
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
            setToast("Archived. You can restore it in Settings.");
          }}
          onSave={(t) => {
            if (draftNew) {
              update([...tasks, { ...t, title: t.title.trim() }]);
              setDraftNew(null);
              setToast("Task captured.");
              return;
            }
            patch(t.id, {
              ...t,
              state: t.state === "ACTIVE" ? "PAUSED" : t.state,
              seconds: elapsed(editing),
              runningSince: null,
            });
            setEdit(null);
            setToast("Updated. Your plan is still yours.");
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
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
