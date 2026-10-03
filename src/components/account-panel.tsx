"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Profile, themes, Theme } from "@/lib/accounts";
export function AccountPanel({
  profile,
  save,
  onHelp,
  onMessage,
}: {
  profile: Profile;
  save: (
    p: Partial<
      Pick<Profile, "display_name" | "job_title" | "theme" | "onboarded">
    >,
  ) => Promise<boolean>;
  onHelp: () => void;
  onMessage: (s: string) => void;
}) {
  const [name, setName] = useState(profile.display_name),
    [job, setJob] = useState(profile.job_title),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="account-panel">
      <h2>Account</h2>
      <p>
        @{profile.username} ·{" "}
        {profile.role === "super_admin" ? "Superadmin" : "Member"}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await save({
            display_name: name.trim(),
            job_title: job.trim(),
          });
          setBusy(false);
          onMessage(ok ? "Saved." : "Could not save.");
        }}
      >
        <label>
          Name
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Job title
          <input
            maxLength={100}
            value={job}
            onChange={(e) => setJob(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          Save
        </button>
      </form>
      <h3>Color</h3>
      <div className="theme-options">
        {(Object.entries(themes) as [Theme, string][]).map(([key, color]) => (
          <button
            key={key}
            aria-pressed={profile.theme === key}
            style={{ background: color }}
            onClick={async () => {
              if (!(await save({ theme: key })))
                onMessage("Could not save color.");
            }}
          >
            {key}
          </button>
        ))}
      </div>
      <h3>Password</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const result = await supabase!.auth.updateUser({ password });
          setBusy(false);
          onMessage(
            result.error ? "Could not change password." : "Password changed.",
          );
          if (!result.error) setPassword("");
        }}
      >
        <label>
          New password
          <input
            type="password"
            minLength={10}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="secondary" disabled={busy}>
          Change password
        </button>
      </form>
      <h3>Time</h3>
      <p>{Intl.DateTimeFormat().resolvedOptions().timeZone} · device time</p>
      <button className="secondary" onClick={onHelp}>
        How to use
      </button>
      <button className="text-button" onClick={() => supabase!.auth.signOut()}>
        Sign out
      </button>
    </section>
  );
}
