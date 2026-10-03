"use client";
import { useState, useRef, useEffect } from "react";
export function HowTo({ name, onDone }: { name: string; onDone: () => void }) {
  const [step, setStep] = useState(0),
    [task, setTask] = useState(""),
    [done, setDone] = useState(false),
    [scheduled, setScheduled] = useState(false),
    [running, setRunning] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="overlay tutorial-overlay">
      <section
        className="how-to"
        ref={ref}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            const nodes = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>("button,input"),
            ).filter((x) => !x.hasAttribute("disabled"));
            const first = nodes[0],
              last = nodes.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-label="How to use to:DO"
      >
        <span className="eyebrow">{step + 1} / 4</span>
        <h2>
          {step === 0
            ? `Hi ${name}`
            : step === 1
              ? "Add a task"
              : step === 2
                ? "Plan your time"
                : "Finish a task"}
        </h2>
        {step === 0 && <p>Here’s a quick walkthrough.</p>}
        {step === 1 && (
          <>
            <p>Give it a short name.</p>
            <label>
              Practice task
              <input
                autoFocus
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Write a note"
              />
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <p>Schedule adds a time block. Start opens the timer.</p>
            <div className="tour-example">
              <strong>{task || "Write a note"}</strong>
              <button className="secondary" onClick={() => setScheduled(true)}>
                {scheduled ? "09:00 · 15 min" : "Try Schedule"}
              </button>
              <button className="primary" onClick={() => setRunning(true)}>
                {running ? "00:01 · Running" : "Try Start"}
              </button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <p>Tap the circle to finish. It stays on your schedule.</p>
            <button
              className={`tour-finish ${done ? "done" : ""}`}
              aria-label="Finish practice task"
              onClick={() => setDone(true)}
            >
              <span className="check-circle">{done ? "✓" : ""}</span>
              {task || "Write a note"}
            </button>
            <small>Practice only. This task is not saved.</small>
          </>
        )}
        <footer>
          <button className="text-button" onClick={onDone}>
            Skip
          </button>
          <button
            className="primary"
            disabled={step === 1 && !task.trim()}
            onClick={() => (step === 3 ? onDone() : setStep(step + 1))}
          >
            {step === 3 ? "Open my tasks" : "Next"}
          </button>
        </footer>
      </section>
    </div>
  );
}
