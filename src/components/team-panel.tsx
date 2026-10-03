"use client";
import { useState } from "react";
import { Profile } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
export function TeamPanel({
  profile,
  team,
  refresh,
}: {
  profile: Profile;
  team: Profile[];
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="team-panel">
      <header>
        <h2>Team</h2>
        {profile.role === "super_admin" && (
          <button className="primary" onClick={() => setOpen(!open)}>
            Add user
          </button>
        )}
      </header>
      <div className="team-grid">
        {team.map((p) => (
          <article className="team-member" key={p.id}>
            <span className="avatar">
              {(p.display_name || p.username)[0].toUpperCase()}
            </span>
            <div>
              <h3>{p.display_name || p.username}</h3>
              <p>{p.job_title || "No job title"}</p>
              <small>
                @{p.username}
                {p.id === profile.id ? " · You" : ""}
              </small>
            </div>
          </article>
        ))}
      </div>
      {open && (
        <form
          className="add-user-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            const form = e.currentTarget,
              fields = new FormData(form);
            const { data, error } = await supabase!.functions.invoke(
              "account-admin",
              {
                body: {
                  action: "create",
                  username: fields.get("username"),
                  password: fields.get("password"),
                  name: fields.get("name"),
                  job_title: fields.get("job_title"),
                },
              },
            );
            setBusy(false);
            if (error || data?.error) {
              setMessage(data?.error || "Could not add user.");
              return;
            }
            form.reset();
            setMessage(
              "User added. Share their username and password privately.",
            );
            await refresh();
          }}
        >
          <h3>Add user</h3>
          <label>
            Username
            <input
              name="username"
              required
              pattern="[a-zA-Z0-9_]{3,32}"
              autoComplete="off"
              maxLength={32}
            />
          </label>
          <label>
            Name
            <input name="name" required maxLength={80} />
          </label>
          <label>
            Job title
            <input name="job_title" maxLength={100} />
          </label>
          <label>
            Temporary password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Adding…" : "Add user"}
          </button>
          <p role="status">{message}</p>
        </form>
      )}
    </section>
  );
}
