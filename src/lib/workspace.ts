import type { Activity, Contact, CrmData } from "./crm-data";
import { defaultSequenceContent } from "./crm-data";

export type Progress = Pick<Contact, "step" | "lifecycle" | "campaignStatus" | "dueDate" | "lastActivity" | "lastTouchpoint">;
export type Value = string | Progress | Activity;
export type Fields = Record<string, { value: Value; version: number }>;
export type Change = { key: string; value: Value; version?: number };
export type Batch = { id: string; importing: boolean; changes: Change[] };
export type NoteRevision = { at: string; actor: string; imported: boolean; text: string };
export type Workspace = { revision: number; fields: Fields; notesHistory: Record<string, NoteRevision[]> };
export type Journal = Pick<Workspace, "revision" | "fields"> & { history: { at: string; actor: string; batch: Batch }[] };
export const emptyWorkspace = (): Workspace => ({ revision: 0, fields: {}, notesHistory: {} });

export function snapshot(doc: Journal): Workspace {
  const notesHistory: Workspace["notesHistory"] = {};
  for (const { at, actor, batch } of doc.history) {
    for (const { key, value } of batch.changes) {
      if (!key.startsWith("notes/")) continue;
      (notesHistory[key] ??= []).push({ at, actor, imported: batch.importing, text: value as string });
    }
  }
  return { revision: doc.revision, fields: doc.fields, notesHistory };
}

export function progressOf(c: Progress): Progress {
  const { step, lifecycle, campaignStatus, dueDate, lastActivity, lastTouchpoint } = c;
  return { step, lifecycle, campaignStatus, dueDate, lastActivity, lastTouchpoint };
}

export function applyBatch(doc: Journal, batch: Batch, actor: string, at: string) {
  if (doc.history.some(h => h.batch.id === batch.id)) return "duplicate";
  if (!batch.importing && batch.changes.some(c => (doc.fields[c.key]?.version ?? 0) !== c.version)) return "conflict";
  doc.revision++;
  for (const { key, value } of batch.changes) {
    const existing = doc.fields[key];
    if (batch.importing && existing) {
      // Keep both independently saved notes visible. Every imported value,
      // including conflicting workflow snapshots, is also kept in history.
      if (key.startsWith("notes/") && value && existing.value !== value) {
        const seen = doc.history.some(h => h.batch.importing && h.batch.changes.some(c => c.key === key && c.value === value));
        if (!seen) doc.fields[key] = { value: [existing.value, value].filter(Boolean).join("\n\n"), version: doc.revision };
      } else if (key.startsWith("progress/")) {
        const previous = doc.history[existing.version - 1]?.batch;
        const prefix = key.replace("progress/", "activity/") + "/";
        const lastTouch = (b: Batch) => Math.max(0, ...b.changes.filter(c => c.key.startsWith(prefix)).map(c => Date.parse((c.value as Activity).dateValue) || 0));
        if (previous?.importing && lastTouch(batch) > lastTouch(previous)) {
          doc.fields[key] = { value, version: doc.revision };
        }
      }
      continue;
    }
    doc.fields[key] = { value, version: doc.revision };
  }
  doc.history.push({ actor, at, batch });
  return "applied";
}

export function projectWorkspace(data: CrmData, fields: Fields) {
  const activities = new Map<string, Activity[]>();
  for (const [key, field] of Object.entries(fields)) {
    const [kind, id] = key.split("/");
    if (kind !== "activity") continue;
    const list = activities.get(id) ?? [];
    list.push(field.value as Activity);
    activities.set(id, list);
  }
  const contacts = data.contacts.map(c => {
    const added = activities.get(c.id) ?? [];
    const ids = new Set(added.map(a => a.id));
    return {
      ...c, ...fields["progress/" + c.id]?.value as Progress | undefined,
      workspaceNotes: (fields["notes/" + c.id]?.value as string) ?? c.workspaceNotes,
      owner: (fields["owner/" + c.id]?.value as string) ?? c.owner,
      contactType: (fields["type/" + c.id]?.value as Contact["contactType"]) ?? c.contactType,
      activities: [...added.reverse(), ...c.activities.filter(a => !ids.has(a.id))].sort((a,b) => b.dateValue.localeCompare(a.dateValue)),
    };
  });
  const projects = data.projects.map(p => ({ ...p, assignee: (fields["project/" + p.id]?.value as string) ?? p.assignee }));
  const sequence = defaultSequenceContent.map((s,i) => (fields["sequence/" + i]?.value as string) ?? s);
  return { contacts, projects, sequence };
}
