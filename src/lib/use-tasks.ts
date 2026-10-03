"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Task } from "./engine";
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("Loading…");
  const latest = useRef(tasks),
    dirty = useRef(false),
    loaded = useRef(false),
    generation = useRef(0);
  latest.current = tasks;
  function cache(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      setStatus("Storage full. Keep this tab open until saved.");
    }
  }
  useEffect(() => {
    try {
      localStorage.removeItem("todo-preview");
      localStorage.removeItem("todo-settings");
    } catch {}
    if (!supabase) {
      setReady(true);
      setStatus("Storage not configured.");
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user || null),
    );
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    loaded.current = false;
    dirty.current = false;
    generation.current++;
    setTasks([]);
    setReady(false);
    if (!supabase || !user) {
      setReady(true);
      setStatus("Sign in");
      return;
    }
    let cancelled = false;
    const key = `todo-v2-${user.id}`;
    void (async () => {
      let pending: { tasks: Task[]; pending: boolean } | null = null;
      try {
        pending = JSON.parse(localStorage.getItem(key) || "null");
      } catch {}
      const { data, error } = await supabase
        .from("tasks")
        .select("payload")
        .eq("owner_id", user.id)
        .order("rank")
        .limit(1000);
      if (cancelled) return;
      if (error) {
        setTasks(pending?.tasks || []);
        dirty.current = !!pending?.pending;
        setStatus("Offline. Changes will save when connected.");
      } else if (pending?.pending) {
        setTasks(pending.tasks);
        dirty.current = true;
        setStatus("Saving…");
      } else {
        const list = (data || []).map((r) => r.payload as Task);
        setTasks(list);
        cache(key, { tasks: list, pending: false });
        setStatus("Saved");
      }
      loaded.current = true;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);
  function update(next: Task[]) {
    if (!user || !supabase) return;
    latest.current = next;
    setTasks(next);
    dirty.current = true;
    cache(`todo-v2-${user.id}`, { tasks: next, pending: true });
    setStatus("Saving…");
  }
  useEffect(() => {
    if (!supabase || !user || !ready) return;
    let busy = false,
      cancelled = false;
    const epoch = generation.current;
    async function sync() {
      if (
        busy ||
        !dirty.current ||
        !loaded.current ||
        !navigator.onLine ||
        epoch !== generation.current
      )
        return;
      const snapshot = latest.current;
      busy = true;
      if (!snapshot.length) {
        dirty.current = false;
        busy = false;
        return;
      }
      const { error } = await supabase!.from("tasks").upsert(
        snapshot.map((t) => ({
          id: t.id,
          owner_id: user!.id,
          title: t.title,
          context: t.context,
          state: t.state,
          rank: t.rank,
          due: t.due || null,
          archived: t.archived,
          payload: t,
        })),
      );
      busy = false;
      if (cancelled || epoch !== generation.current) return;
      if (error) {
        setStatus("Not saved yet. Retrying…");
        return;
      }
      if (latest.current === snapshot) {
        dirty.current = false;
        cache(`todo-v2-${user!.id}`, { tasks: snapshot, pending: false });
        setStatus("Saved");
      }
    }
    const timer = setInterval(() => void sync(), 1500);
    window.addEventListener("online", sync);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("online", sync);
    };
  }, [user, ready]);
  return { tasks, update, user, ready, status, cloud: !!supabase };
}
