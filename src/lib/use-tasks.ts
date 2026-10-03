"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { examples, Task } from "./engine";
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("Loading your space…");
  const latest = useRef(tasks),
    dirty = useRef(false),
    loaded = useRef(false),
    storageOkay = useRef(true);
  function persist(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      storageOkay.current = true;
    } catch {
      storageOkay.current = false;
      setStatus(
        "Changes are in memory only. Export them before closing this page.",
      );
    }
  }
  latest.current = tasks;
  useEffect(() => {
    if (!supabase) {
      try {
        setTasks(
          JSON.parse(localStorage.getItem("todo-preview") || "null") ||
            examples(),
        );
      } catch {
        setTasks(examples());
      }
      loaded.current = true;
      setReady(true);
      setStatus("Device-local preview");
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((_event, u) => {
      setUser(u?.user ?? null);
    });
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!supabase) return;
    loaded.current = false;
    setReady(false);
    setTasks([]);
    dirty.current = false;
    if (!user) {
      setReady(true);
      setStatus("Sign in to your space");
      return;
    }
    let cancelled = false;
    const key = `todo-${user.id}`;
    async function load() {
      let cache: { tasks: Task[]; pending: boolean } | null = null;
      try {
        cache = JSON.parse(localStorage.getItem(key) || "null");
      } catch {}
      const { data, error } = await supabase!
        .from("tasks")
        .select("payload")
        .eq("owner_id", user!.id)
        .order("archived")
        .order("rank")
        .limit(1000);
      if (cancelled) return;
      if (cache?.pending) {
        setTasks(cache.tasks);
        dirty.current = true;
        setStatus("Your offline changes are ready to sync");
      } else if (error) {
        setTasks(cache?.tasks || []);
        setStatus("Couldn’t load cloud tasks. Cached changes stay here.");
      } else {
        const remote = (data || []).map((r) => r.payload as Task);
        setTasks(remote);
        persist(key, { tasks: remote, pending: false });
        setStatus("Synced to your space");
      }
      loaded.current = true;
      setReady(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);
  function update(next: Task[]) {
    setTasks(next);
    dirty.current = true;
    const key = user ? `todo-${user.id}` : "todo-preview";
    persist(key, user ? { tasks: next, pending: true } : next);
    if (user && storageOkay.current) setStatus("Saving…");
  }
  useEffect(() => {
    if (!supabase || !user || !ready) return;
    let busy = false,
      cancelled = false;
    async function sync() {
      if (busy || !dirty.current || !loaded.current || !navigator.onLine)
        return;
      busy = true;
      const snapshot = latest.current;
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
      if (cancelled) return;
      if (error) {
        setStatus(
          storageOkay.current
            ? "Couldn’t sync. Your changes are saved on this device."
            : "Couldn’t sync. Export your changes before closing this page.",
        );
        return;
      }
      if (latest.current === snapshot) {
        dirty.current = false;
        persist(`todo-${user!.id}`, { tasks: snapshot, pending: false });
        setStatus("Synced to your space");
      }
    }
    const timer = setInterval(() => void sync(), 2000);
    window.addEventListener("online", sync);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("online", sync);
    };
  }, [user, ready]);
  return { tasks, update, user, ready, status, cloud: !!supabase };
}
