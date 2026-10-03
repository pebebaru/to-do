"use client";
import { useEffect } from "react";
import { brand } from "./brand";
import { day, elapsed, Task } from "./engine";

/** Foreground only; no permission request occurs in this hook. */
export function useReminders(
  tasks: Task[],
  enabled: boolean,
  style: string,
  scope: string,
) {
  useEffect(() => {
    if (
      !enabled ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const storageKey = `todo-reminders-${scope}-${day()}`;
      let sent: string[] = [];
      try {
        sent = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
      } catch {}
      const budget = style === "Gentle" ? 4 : style === "Proactive" ? 12 : 8;
      if (sent.length >= budget) return;
      for (const task of tasks) {
        if (task.archived || task.state === "DONE") continue;
        const delta = task.start
          ? (new Date(task.start).getTime() - Date.now()) / 60000
          : null;
        const kind =
          task.state === "ACTIVE" &&
          task.duration &&
          elapsed(task) >= task.duration * 60
            ? "checkpoint"
            : delta !== null && delta <= 0 && delta > -1
              ? "start"
              : delta !== null && delta <= 10 && delta > 0
                ? "upcoming"
                : task.state === "WAITING" && task.due === day()
                  ? "follow-up"
                  : "";
        // Upcoming/start share a decision, so suppress a second notification.
        const key = `${task.id}-${kind === "upcoming" || kind === "start" ? `schedule-${task.start}` : kind}`;
        if (!kind || sent.includes(key)) continue;
        const body =
          kind === "checkpoint"
            ? `${task.title}: your planned time is up. Choose a stopping point.`
            : kind === "follow-up"
              ? `A follow-up with ${task.person || "someone"} is due today.`
              : kind === "start"
                ? `It’s time for ${task.title}. Your next step is ready.`
                : `${task.title} starts in ${Math.ceil(delta!)} minutes.`;
        try {
          new Notification(brand.name, { body, tag: key });
          sessionStorage.setItem(storageKey, JSON.stringify([...sent, key]));
        } catch {
          /* The browser may reject delivery despite permission. Core work continues. */
        }
        break;
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [tasks, enabled, style, scope]);
}
