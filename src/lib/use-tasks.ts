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
    syncNow = useRef<() => Promise<void>>(async () => {}),
    dirty = useRef(false),
    loaded = useRef(false),
    generation = useRef(0),
    removed = useRef<string[]>([]);
  const userId = user?.id;
  const [reload, setReload] = useState(0);
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
    removed.current = [];
    generation.current++;
    setTasks([]);
    setReady(false);
    if (!supabase || !userId) {
      setReady(true);
      setStatus("Sign in");
      return;
    }
    let cancelled = false;
    const key = `todo-v2-${userId}`;
    void (async () => {
      let pending: {
        tasks: Task[];
        pending: boolean;
        removed?: string[];
      } | null = null;
      try {
        pending = JSON.parse(localStorage.getItem(key) || "null");
      } catch {}
      const { data, error } = await supabase
        .from("tasks")
        .select("payload")
        .eq("owner_id", userId)
        .order("rank")
        .limit(1000);
      if (cancelled) return;
      removed.current = pending?.removed || [];
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
  }, [userId, reload]);
  function update(next: Task[]) {
    if (!userId || !supabase) return;
    const nextIds = new Set(next.map((t) => t.id));
    removed.current = [
      ...new Set([
        ...removed.current,
        ...latest.current.filter((t) => !nextIds.has(t.id)).map((t) => t.id),
      ]),
    ].filter((id) => !nextIds.has(id));
    latest.current = next;
    setTasks(next);
    dirty.current = true;
    cache(`todo-v2-${userId}`, {
      tasks: next,
      pending: true,
      removed: removed.current,
    });
    setStatus("Saving…");
  }
  useEffect(() => {
    if (!supabase || !userId || !ready) return;
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
      const deleting = [...removed.current];
      if (deleting.length) {
        const { error } = await supabase!
          .from("tasks")
          .delete()
          .eq("owner_id", userId!)
          .in("id", deleting);
        if (cancelled || epoch !== generation.current) return;
        if (error) {
          busy = false;
          setStatus("Not saved yet. Retrying…");
          return;
        }
        removed.current = removed.current.filter(
          (id) => !deleting.includes(id),
        );
      }
      const { error } = snapshot.length
        ? await supabase!.from("tasks").upsert(
            snapshot.map((t) => ({
              id: t.id,
              owner_id: userId!,
              title: t.title,
              context: t.context,
              state: t.state,
              rank: t.rank,
              due: t.due || null,
              archived: t.archived,
              payload: t,
            })),
          )
        : { error: null };
      busy = false;
      if (cancelled || epoch !== generation.current) return;
      if (error) {
        setStatus("Not saved yet. Retrying…");
        return;
      }
      if (latest.current === snapshot && !removed.current.length) {
        dirty.current = false;
        cache(`todo-v2-${userId}`, { tasks: snapshot, pending: false });
        setStatus("Saved");
      }
    }
    const timer = setInterval(() => void sync(), 1500);
    syncNow.current = sync;
    const reconnect = () => {
      if (dirty.current) void sync();
      else setReload((n) => n + 1);
    };
    window.addEventListener("online", reconnect);
    return () => {
      cancelled = true;
      syncNow.current = async () => {};
      clearInterval(timer);
      window.removeEventListener("online", reconnect);
    };
  }, [userId, ready]);
  return {
    tasks,
    update,
    user,
    ready,
    status,
    cloud: !!supabase,
    retry: () =>
      dirty.current ? void syncNow.current() : setReload((n) => n + 1),
  };
}
