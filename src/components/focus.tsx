"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Pause,
  Play,
  Clock3,
  Plus,
  AlertOctagon,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { elapsed, Task } from "@/lib/engine";
export function Focus({
  task,
  onPause,
  onResume,
  onDone,
  onClose,
  onStep,
  onExtend,
  onCapture,
}: {
  task: Task;
  onPause: () => void;
  onResume: () => void;
  onDone: () => void;
  onClose: () => void;
  onStep: (id: string) => void;
  onExtend: () => void;
  onCapture: (title: string) => void;
}) {
  const [now, setNow] = useState(Date.now()),
    [checkpoint, setCheckpoint] = useState(false);
  const [interruption, setInterruption] = useState(false),
    [thought, setThought] = useState("");
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const seconds = elapsed(task, now),
    over = task.duration > 0 && seconds >= task.duration * 60,
    step = task.actions.find((a) => !a.done);
  return (
    <div className="focus-screen">
      <header>
        <button className="text-button" onClick={onClose}>
          <ArrowLeft size={18} /> Back to your day
        </button>
        <span className="brand">{brand.name}</span>
      </header>
      <main>
        <span className="eyebrow">ONE THING AT A TIME</span>
        <span className={`context ${task.context.toLowerCase()}`}>
          {task.context}
        </span>
        <h1>{task.title}</h1>
        <div className="focus-ring">
          <svg viewBox="0 0 240 240" aria-hidden="true">
            <circle
              cx="120"
              cy="120"
              r="104"
              fill="none"
              stroke="#282a2f"
              strokeWidth="5"
              strokeDasharray="4 6"
            />
            <circle
              cx="120"
              cy="120"
              r="104"
              fill="none"
              stroke="#4d8eff"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray="653.45"
              strokeDashoffset={
                task.duration
                  ? 653.45 * (1 - Math.min(1, seconds / (task.duration * 60)))
                  : 0
              }
            />
          </svg>
          <div>
            <div className="timer">
              {seconds>=3600&&`${String(Math.floor(seconds / 3600)).padStart(2,"0")}:`}
              {String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:
              {String(seconds % 60).padStart(2, "0")}
            </div>
            <span className="timer-caption">
              ELAPSED ·{" "}
              {task.duration ? `~${task.duration}:00 PLANNED` : "OPEN SESSION"}
            </span>
          </div>
        </div>
        <div className="focus-checkpoint">
          <Clock3 size={16} />
          {task.state === "PAUSED"
            ? "SESSION PAUSED"
            : over
              ? "TIME TO CHECK IN"
              : "DEEP FOCUS SESSION"}
        </div>
        <p>
          {task.state === "PAUSED"
            ? "Take a breath. Your progress is here."
            : task.duration
              ? `${task.duration} min estimated · time is a checkpoint, not a deadline`
              : "Room to make progress, at your own pace."}
        </p>
        {step && <button className="focus-step" onClick={()=>onStep(step.id)}><span className="check-circle"/><span><small className="eyebrow">TELEMETRY // MICRO-STEP</small>{step.title}</span></button>}
        {over && !checkpoint && (
          <div className="checkpoint">
            <strong>This has taken longer than planned.</strong>
            <p>Choose a useful stopping point.</p>
            <button className="secondary" onClick={() => setCheckpoint(true)}>
              Continue
            </button>
            <button className="secondary" onClick={() => setCheckpoint(true)}>
              Finish this step
            </button>
            <button className="text-button" onClick={onPause}>
              Pause & rethink
            </button>
          </div>
        )}
        <div className="focus-controls">
          <button onClick={task.state === "PAUSED" ? onResume : onPause}>
            {task.state === "PAUSED" ? <Play size={18} /> : <Pause size={18} />}{" "}
            {task.state === "PAUSED" ? "Resume" : "Pause"}
          </button>
          <button onClick={onExtend}>
            <Plus size={18} />
            +10 Mins
          </button>
          <button disabled={!step} onClick={() => step && onStep(step.id)}>
            <Check size={18} />
            Next Step
          </button>
        </div>
        <button className="primary finish-focus" onClick={onDone}>
          <Check size={22} />
          COMMIT // MARK COMPLETED
        </button>
        <button
          className="interrupt-focus"
          onClick={() => {
            onPause();
            setInterruption(true);
          }}
        >
          <AlertOctagon size={20} />
          EMERGENCY STOP // URGENT INTERRUPTION
        </button>
        {interruption && (
          <form
            className="interruption-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!thought.trim()) return;
              onCapture(thought.trim());
              setThought("");
              setInterruption(false);
            }}
          >
            <label htmlFor="focus-thought">PARK INTRUSIVE THOUGHT</label>
            <input
              id="focus-thought"
              autoFocus
              value={thought}
              onChange={(e) => setThought(e.target.value)}
              placeholder="Note request or idea (saved to inbox)..."
              required
            />
            <div>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setInterruption(false);
                  onResume();
                }}
              >
                Cancel & resume
              </button>
              <button className="primary">Park & Resume Focus</button>
            </div>
          </form>
        )}
      </main>
      <footer>You don’t have to do everything. Just this next thing.</footer>
    </div>
  );
}
