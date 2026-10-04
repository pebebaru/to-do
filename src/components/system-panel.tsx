"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/accounts";
import type { Task } from "@/lib/engine";
type Records = {
  accounts: number;
  privateCount: number;
  sharedCount: number;
  offset: number;
  tasks: { id: string; owner_id: string; payload: Task }[];
  shared: { id: string; owner_id: string; payload: Task }[];
};
export function SystemPanel({ team }: { team: Profile[] }) {
  const [data, setData] = useState<Records | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load(offset = 0) {
    setBusy(true);
    setError("");
    try {
      const r = await supabase!.functions.invoke("account-admin", {
        body: { action: "system", offset },
      });
      if (r.error || r.data?.error)
        throw Error("Could not load system records.");
      setData(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="system-panel">
      <h2>System</h2>
      <p>
        All account records, including personal tasks. Only superadmins can open
        this view.
      </p>
      <button
        className="secondary"
        disabled={busy}
        onClick={() => void load(data?.offset || 0)}
      >
        {busy ? "Loading…" : data ? "Refresh records" : "Open system records"}
      </button>
      <p role="status">{error}</p>
      {data && (
        <>
          <p>
            {data.accounts} accounts · {data.privateCount} private records ·{" "}
            {data.sharedCount} shared records
          </p>
          {[...data.tasks, ...data.shared].map((t) => (
            <details className="system-record" key={t.id}>
              <summary>
                {t.payload.title} ·{" "}
                {team.find((p) => p.id === t.owner_id)?.display_name ||
                  "Account"}
              </summary>
              <p>
                {t.payload.context} · {t.payload.state} ·{" "}
                {t.payload.archived ? "Archived" : "Saved"}
              </p>
              <p>{t.payload.notes || "No notes"}</p>
              <p>{t.payload.start || "Unscheduled"}</p>
            </details>
          ))}
          <div className="button-row">
            <button
              disabled={busy || data.offset === 0}
              onClick={() => void load(Math.max(0, data.offset - 50))}
            >
              Previous
            </button>
            <button
              disabled={
                busy ||
                data.offset + 50 >=
                  Math.max(data.privateCount, data.sharedCount)
              }
              onClick={() => void load(data.offset + 50)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
