"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { loginEmail } from "@/lib/accounts";
export function SignIn() {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="auth-page">
      <img src="/mark.svg" width="48" height="48" alt="" />
      <h1>to:DO</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          const result = await supabase!.auth.signInWithPassword({
            email: loginEmail(username),
            password,
          });
          setBusy(false);
          if (result.error) setMessage("Username or password is incorrect.");
        }}
      >
        <label>
          Username
          <input
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p role="status">{message}</p>
      </form>
      <p>Accounts are added by your admin.</p>
    </main>
  );
}
