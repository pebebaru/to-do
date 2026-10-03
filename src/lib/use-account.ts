"use client";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { Profile, themes } from "./accounts";
export function useAccount(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null),
    [team, setTeam] = useState<Profile[]>([]),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!supabase || !user) {
      setProfile(null);
      setTeam([]);
      return;
    }
    const result = await supabase
      .from("profiles")
      .select("id,username,display_name,job_title,role,theme,onboarded,enabled")
      .eq("enabled", true)
      .order("display_name");
    if (result.error) {
      setError("Could not load your account.");
      return;
    }
    let people = result.data as Profile[];
    if (people.find((p) => p.id === user.id)?.role === "super_admin") {
      const { data, error } = await supabase.functions.invoke("account-admin", {
        body: { action: "list" },
      });
      if (!error && data?.members) people = data.members;
    }
    setTeam(people);
    setProfile(people.find((p) => p.id === user.id) || null);
    setError("");
  }, [user]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--accent",
      themes[profile?.theme || "blue"],
    );
    document.documentElement.style.setProperty(
      "--primary",
      profile?.theme === "blue" || !profile
        ? "#adc6ff"
        : `color-mix(in srgb, ${themes[profile.theme]} 55%, white)`,
    );
    document.documentElement.dataset.theme = profile?.theme || "blue";
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [profile?.theme]);
  async function save(
    patch: Partial<
      Pick<Profile, "display_name" | "job_title" | "theme" | "onboarded">
    >,
  ) {
    if (!supabase || !user) return false;
    const result = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select("id")
      .single();
    if (result.error) {
      setError("Could not save your account.");
      return false;
    }
    await refresh();
    return true;
  }
  return { profile, team, error, save, refresh };
}
