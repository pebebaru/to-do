"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { type Profile, themes, resolveTheme, isAdmin } from "./accounts";
export function useAccount(user: User | null) {
  const id = user?.id;
  const current = useRef(id);
  current.current = id;
  const [profile, setProfile] = useState<Profile | null>(null),
    [team, setTeam] = useState<Profile[]>([]),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!supabase || !id) {
      setProfile(null);
      setTeam([]);
      return;
    }
    const result = await supabase
      .from("profiles")
      .select("id,username,display_name,job_title,role,theme,onboarded,enabled")
      .eq("enabled", true)
      .order("display_name");
    if (current.current !== id) return;
    if (result.error) {
      setError("Could not load your account. Retry.");
      return;
    }
    let people = result.data as Profile[];
    const me = people.find((p) => p.id === id);
    if (me && isAdmin(me.role)) {
      const { data } = await supabase.functions.invoke("account-admin", {
        body: { action: "list" },
      });
      if (data?.members) people = data.members;
    }
    if (current.current !== id) return;
    setTeam(people);
    setProfile(people.find((p) => p.id === id) || null);
    setError(me ? "" : "Account unavailable. Contact your administrator.");
  }, [id]);
  useEffect(() => {
    setProfile(null);
    setTeam([]);
    void refresh();
    const visibleRefresh = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(visibleRefresh, 60000);
    window.addEventListener("focus", visibleRefresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", visibleRefresh);
    };
  }, [refresh]);
  useEffect(() => {
    const theme = resolveTheme(profile?.theme);
    for (const [key, value] of Object.entries(themes[theme].tokens))
      document.documentElement.style.setProperty(`--${key}`, value);
    document.documentElement.dataset.theme = theme;
  }, [profile?.theme]);
  async function save(
    patch: Partial<
      Pick<Profile, "display_name" | "job_title" | "theme" | "onboarded">
    >,
  ) {
    if (!supabase || !id) return false;
    const result = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", id)
      .select("id")
      .single();
    if (current.current !== id) return false;
    if (result.error) {
      setError("Could not save your account.");
      return false;
    }
    await refresh();
    return true;
  }
  return { profile, team, error, save, refresh };
}
