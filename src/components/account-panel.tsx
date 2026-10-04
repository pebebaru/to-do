"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Profile, themes, Theme, resolveTheme } from "@/lib/accounts";
export function AccountPanel({
  profile,
  save,
  onHelp,
  onMessage,
  preview,
  onPreview,
  onNavigate,
}: {
  profile: Profile;
  preview: boolean;
  onPreview: () => void;
  onNavigate: (screen: "Vault" | "Analytics") => void;
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
        @{profile.username}
        {!preview && profile.role !== "user" && (
          <> · {profile.role === "super_admin" ? "Superadmin" : "Admin"}</>
        )}
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
      <h3>Appearance</h3>
      <div className="theme-options" role="group" aria-label="Color palette">
        {(Object.entries(themes) as [Theme, (typeof themes)[Theme]][]).map(
          ([key, theme]) => (
            <button
              key={key}
              className="palette-option"
              aria-label={theme.label}
              aria-pressed={resolveTheme(profile.theme) === key}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const ok = await save({ theme: key });
                setBusy(false);
                onMessage(
                  ok ? "Appearance saved." : "Could not save appearance.",
                );
              }}
            >
              <span className="palette-preview" aria-hidden="true">
                {[
                  theme.tokens.background,
                  theme.tokens.surface,
                  theme.tokens.accent,
                  theme.tokens.secondary,
                ].map((color, i) => (
                  <i key={i} style={{ background: color }} />
                ))}
              </span>
              {resolveTheme(profile.theme) === key && (
                <span className="palette-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ),
        )}
      </div>
      <div className="button-row account-shortcuts">
        <button className="secondary" onClick={() => onNavigate("Vault")}>
          History
        </button>
        <button className="secondary" onClick={() => onNavigate("Analytics")}>
          Time
        </button>
      </div>
      {profile.role === "super_admin" && (
        <div className="member-preview-control">
          <button
            className="secondary"
            aria-pressed={preview}
            onClick={onPreview}
          >
            {preview ? "Exit member view" : "View as member"}
          </button>
          <p>Uses your own tasks with management controls hidden.</p>
        </div>
      )}
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
