"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "./supabase";
import type { SharedTask, TeamGroup } from "./collaboration";
export async function teamAction(
  action: string,
  fields: Record<string, unknown> = {},
) {
  const { data, error } = await supabase!.functions.invoke("team-tasks", {
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
export function useCollaboration(userId?: string) {
  const current = useRef(userId);
  current.current = userId;
  const [tasks, setTasks] = useState<SharedTask[]>([]),
    [groups, setGroups] = useState<TeamGroup[]>([]),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!userId || !supabase) return;
    const [a, b] = await Promise.all([
      supabase
        .from("shared_tasks")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1000),
      supabase.from("team_groups").select("id,name,members").order("name"),
    ]);
    if (current.current !== userId) return;
    if (a.error || b.error) {
      setError("Could not load shared tasks. Retry.");
      return;
    }
    setTasks(a.data as SharedTask[]);
    setGroups(b.data as TeamGroup[]);
    setError("");
  }, [userId]);
  useEffect(() => {
    setTasks([]);
    setGroups([]);
    if (!userId) return;
    void refresh();
    const i = setInterval(() => void refresh(), 15000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(i);
      window.removeEventListener("focus", refresh);
    };
  }, [userId, refresh]);
  async function act(action: string, fields: Record<string, unknown> = {}) {
    const result = await teamAction(action, fields);
    await refresh();
    return result;
  }
  return { tasks, groups, error, refresh, act };
}
