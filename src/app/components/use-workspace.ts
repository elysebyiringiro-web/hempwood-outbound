"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { defaultSequenceContent, type Activity } from "@/lib/crm-data";
import { emptyWorkspace, progressOf, type Batch, type Change, type Progress, type Workspace } from "@/lib/workspace";

function legacyChanges(): Change[] {
  function read(key: string) {
    const raw = localStorage.getItem("hempwood-" + key);
    return raw === null ? null : JSON.parse(raw);
  }
  const changes: Change[] = [];
  for (const [kind, key] of [["owner","contact-owners-v2"],["type","contact-types-v1"],["project","project-owners-v2"]]) {
    for (const [id,value] of Object.entries(read(key) ?? {})) changes.push({ key: kind + "/" + id, value: value as string });
  }
  const sequence: string[] = read("sequence-content-v2") ?? [];
  sequence.forEach((value,i) => {
    if (value !== defaultSequenceContent[i]) changes.push({ key: "sequence/" + i, value });
  });
  const saved: Record<string, Progress & { workspaceNotes?: string; activities?: Activity[] }> = read("workflow-state-v2") ?? {};
  for (const [id, item] of Object.entries(saved)) {
    changes.push({ key: "progress/" + id, value: progressOf(item) });
    if (item.workspaceNotes) changes.push({ key: "notes/" + id, value: item.workspaceNotes });
    for (const a of item.activities ?? []) changes.push({ key: "activity/" + id + "/" + a.id, value: a });
  }
  return changes;
}

async function request(batch?: Batch): Promise<Workspace> {
  const response = await fetch("/api/workspace", batch ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(batch),
  } : { cache: "no-store" });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Team sync failed. Please retry.");
  return response.json();
}

export function useWorkspace() {
  const [state, setState] = useState(emptyWorkspace);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const accept = useCallback((next: Workspace) => setState(old => next.revision >= old.revision ? next : old), []);
  useEffect(() => {
    let active = true, running = false, imported = false;
    async function sync() {
      if (running || document.hidden) return;
      running = true;
      try {
        let next: Workspace | undefined;
        if (!imported) {
          const changes = legacyChanges();
          if (changes.length) {
            const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(changes)));
            const id = Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, "0")).join("");
            if (localStorage.getItem("hempwood-team-import-v1") !== id) {
              next = await request({ id, importing: true, changes });
              localStorage.setItem("hempwood-team-import-v1", id);
              if (active) setMessage("Imported this browser’s saved edits into the team workspace.");
            }
          }
          imported = true;
        }
        next ??= await request();
        if (active) { accept(next); setReady(true); }
      } catch (e) {
        if (active) setMessage((e as Error).message);
      } finally { running = false; }
    }
    void sync();
    const timer = setInterval(sync, 15000);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", sync); document.removeEventListener("visibilitychange", sync); };
  }, [accept]);
  async function save(changes: Change[]) {
    if (busy.current || !ready) return false;
    busy.current = true;
    setPending(true);
    try {
      accept(await request({ id: crypto.randomUUID(), importing: false, changes: changes.map(c => ({ ...c, version: c.version ?? state.fields[c.key]?.version ?? 0 })) }));
      setMessage("Saved to team workspace");
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      try { accept(await request()); } catch { /* Display the original save error. */ }
      return false;
    } finally { busy.current = false; setPending(false); }
  }
  return { state, save, ready, message, pending };
}
