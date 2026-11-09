"use client";

import { useEffect, useMemo, useState } from "react";
import {
  campaignSteps,
  defaultSequenceContent,
  sourceSheetUrl,
  type Contact,
  type CrmData,
  type Lifecycle,
  type Project,
  weeklyProjectTarget,
} from "@/lib/crm-data";

type View = "contacts" | "targets" | "tasks" | "projects" | "sequences" | "handovers";

const navItems: { id: View; label: string; icon: string }[] = [
  { id: "contacts", label: "Contacts", icon: "♙" },
  { id: "targets", label: "Weekly targets", icon: "◎" },
  { id: "tasks", label: "Tasks", icon: "✓" },
  { id: "projects", label: "Projects", icon: "⌂" },
  { id: "sequences", label: "Sequences", icon: "→" },
  { id: "handovers", label: "MQL handovers", icon: "◇" },
];

const contactOwnerKey = "hempwood-contact-owners-v2";
const projectOwnerKey = "hempwood-project-owners-v2";
const sequenceContentKey = "hempwood-sequence-content-v2";
const workflowStateKey = "hempwood-workflow-state-v2";
const outreachTypes = new Set(["email", "call", "linkedin"]);

type WorkflowState = Record<
  string,
  Pick<Contact, "step" | "lifecycle" | "campaignStatus" | "dueDate" | "lastActivity" | "lastTouchpoint" | "activities">
>;

function readStoredMap(key: string) {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function readWorkflowState() {
  try {
    return JSON.parse(window.localStorage.getItem(workflowStateKey) ?? "{}") as WorkflowState;
  } catch {
    return {};
  }
}

function persistWorkflow(contact: Contact) {
  const current = readWorkflowState();
  current[contact.id] = {
    step: contact.step,
    lifecycle: contact.lifecycle,
    campaignStatus: contact.campaignStatus,
    dueDate: contact.dueDate,
    lastActivity: contact.lastActivity,
    lastTouchpoint: contact.lastTouchpoint,
    activities: contact.activities.filter((activity) => activity.note === "Logged in the campaign workspace."),
  };
  window.localStorage.setItem(workflowStateKey, JSON.stringify(current));
}

function kigaliWeekBounds(nowValue: string) {
  const now = new Date(nowValue);
  const kigaliOffset = 2 * 60 * 60 * 1000;
  const shifted = new Date(now.valueOf() + kigaliOffset);
  const day = shifted.getUTCDay() || 7;
  shifted.setUTCDate(shifted.getUTCDate() - day + 1);
  shifted.setUTCHours(0, 0, 0, 0);
  const start = shifted.valueOf() - kigaliOffset;
  return { start, end: start + 7 * 86_400_000 };
}

function projectsReachedThisWeek(contacts: Contact[], nowValue: string) {
  if (!nowValue) return 0;
  const { start, end } = kigaliWeekBounds(nowValue);
  const reached = new Set<string>();
  contacts.forEach((contact) => {
    contact.activities.forEach((activity) => {
      const timestamp = activity.dateValue ? new Date(activity.dateValue).valueOf() : Number.NaN;
      if (!outreachTypes.has(activity.type) || timestamp < start || timestamp >= end) return;
      if (activity.note === "Logged in the campaign workspace.") {
        contact.projects.forEach((project) => reached.add(project.id));
      } else if (activity.projectId) {
        reached.add(activity.projectId);
      }
    });
  });
  return reached.size;
}

function unreachedProjectCount(projects: Project[], contacts: Contact[]) {
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));
  return projects.filter(
    (project) =>
      !project.contactIds.some((contactId) =>
        byId.get(contactId)?.activities.some((activity) => outreachTypes.has(activity.type)),
      ),
  ).length;
}

function openFollowUpCount(contacts: Contact[]) {
  return contacts.filter((contact) => contact.step > 0 && contact.campaignStatus === "Active").length;
}

function lifecycleClass(lifecycle: Lifecycle) {
  return lifecycle ? lifecycle.toLowerCase() : "blank";
}

function dueLabel(dateValue: string) {
  if (!dateValue) return "No next action";
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const due = new Date(`${dateValue}T00:00:00Z`).valueOf();
  const days = Math.round((due - todayUtc) / 86_400_000);
  if (days === 0) return "Today";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(due));
}

function isOverdue(dateValue: string) {
  if (!dateValue) return false;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return new Date(`${dateValue}T00:00:00Z`).valueOf() < todayUtc;
}

function nextDueDate(currentStep: number, nextStep: number) {
  const due = new Date();
  const gap = campaignSteps[nextStep].day - campaignSteps[currentStep].day;
  due.setUTCDate(due.getUTCDate() + gap);
  return due.toISOString().slice(0, 10);
}

function personalizedCopy(contact: Contact, template: string) {
  const project = contact.projects[0];
  if (!project) return template;
  const portfolio = contact.projects[1]
    ? ` I also noticed ${contact.projects.slice(1).map((item) => item.name).join(", ")}, so I’m coordinating these opportunities in one conversation.`
    : "";
  const replacements: Record<string, string> = {
    "{firstName}": contact.name.split(" ")[0],
    "{project}": project.name,
    "{stage}": project.stage.toLowerCase(),
    "{applications}": project.projectType.toLowerCase(),
    "{portfolio}": portfolio,
  };
  return Object.entries(replacements).reduce(
    (content, [token, value]) => content.replaceAll(token, value),
    template,
  );
}

export default function CrmApp() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<View>("contacts");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [editingSequence, setEditingSequence] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState("");
  const [sourceMeta, setSourceMeta] = useState({ tab: "Sample Projects", syncedAt: "" });
  const [refreshToken, setRefreshToken] = useState(0);
  const [sequenceContent, setSequenceContent] = useState<string[]>(() => {
    if (typeof window === "undefined") return [...defaultSequenceContent];
    try {
      const stored = JSON.parse(window.localStorage.getItem(sequenceContentKey) ?? "null") as string[] | null;
      return stored?.length === campaignSteps.length ? stored : [...defaultSequenceContent];
    } catch {
      return [...defaultSequenceContent];
    }
  });

  useEffect(() => {
    const controller = new AbortController();
    async function syncSheet() {
      setLoading(true);
      setSyncError("");
      try {
        const response = await fetch("/api/crm-data", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("The client-facing sheet could not be loaded.");
        const data = (await response.json()) as CrmData;
        const contactOwners = readStoredMap(contactOwnerKey);
        const projectOwners = readStoredMap(projectOwnerKey);
        const workflow = readWorkflowState();
        setContacts(data.contacts.map((contact) => {
          const saved = workflow[contact.id];
          if (!saved) return { ...contact, owner: contactOwners[contact.id] || contact.owner };
          const activityIds = new Set(contact.activities.map((activity) => activity.id));
          return {
            ...contact,
            ...saved,
            owner: contactOwners[contact.id] || contact.owner,
            activities: [...saved.activities.filter((activity) => !activityIds.has(activity.id)), ...contact.activities],
          };
        }));
        setProjects(data.projects.map((project) => ({ ...project, assignee: projectOwners[project.id] || project.assignee })));
        setSourceMeta({ tab: data.sourceTab, syncedAt: data.syncedAt });
      } catch (error) {
        if ((error as Error).name !== "AbortError") setSyncError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void syncSheet();
    return () => controller.abort();
  }, [refreshToken]);

  const contactNameById = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact.name])),
    [contacts],
  );
  const filteredContacts = contacts.filter((contact) =>
    `${contact.name} ${contact.company} ${contact.email} ${contact.projects.map((project) => project.name).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const filteredProjects = projects.filter((project) =>
    `${project.name} ${project.owner} ${project.location} ${project.architectureFirm}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const selected = contacts.find((contact) => contact.id === selectedId) ?? null;
  const taskContact = contacts.find((contact) => contact.id === taskId) ?? null;
  const weeklyReached = projectsReachedThisWeek(contacts, sourceMeta.syncedAt);
  const unreached = unreachedProjectCount(projects, contacts);
  const openFollowUps = openFollowUpCount(contacts);
  const dueWork = unreached + openFollowUps;
  const targetPercent = Math.min(100, Math.round((weeklyReached / weeklyProjectTarget) * 100));
  function updateContactOwner(contactId: string, owner: string) {
    setContacts((current) => current.map((contact) => (contact.id === contactId ? { ...contact, owner } : contact)));
    const stored = readStoredMap(contactOwnerKey);
    stored[contactId] = owner;
    window.localStorage.setItem(contactOwnerKey, JSON.stringify(stored));
  }

  function updateProjectOwner(projectId: string, assignee: string) {
    setProjects((current) => current.map((project) => (project.id === projectId ? { ...project, assignee } : project)));
    const stored = readStoredMap(projectOwnerKey);
    stored[projectId] = assignee;
    window.localStorage.setItem(projectOwnerKey, JSON.stringify(stored));
  }

  function updateLifecycle(contactId: string, lifecycle: Lifecycle) {
    setContacts((current) =>
      current.map((contact) => {
        if (contact.id !== contactId) return contact;
        let updated: Contact;
        if (lifecycle === "MQL") {
          updated = { ...contact, lifecycle, campaignStatus: "Stopped – MQL", dueDate: "" };
        } else if (lifecycle === "Nurture") {
          updated = { ...contact, lifecycle, campaignStatus: "Paused – Nurture", dueDate: "" };
        } else if (lifecycle === "Disqualified") {
          updated = { ...contact, lifecycle, campaignStatus: "Closed", dueDate: "" };
        } else {
          updated = { ...contact, lifecycle, campaignStatus: contact.activities.length ? "Active" : "Not started", dueDate: new Date().toISOString().slice(0, 10) };
        }
        persistWorkflow(updated);
        return updated;
      }),
    );
  }

  function completeStep(contactId: string, outcome: string) {
    setContacts((current) =>
      current.map((contact) => {
        if (contact.id !== contactId) return contact;
        const step = campaignSteps[contact.step];
        const today = new Date().toISOString();
        const activity = {
          id: crypto.randomUUID(),
          type: step.channel.toLowerCase() === "linkedin" ? ("linkedin" as const) : step.channel.toLowerCase() === "call" ? ("call" as const) : ("email" as const),
          title: `${step.name} · ${outcome}`,
          note: "Logged in the campaign workspace.",
          date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date()),
          dateValue: today,
          projectId: contact.projects[0]?.id ?? "",
        };
        let updated: Contact;
        if (["Meeting booked", "Sample requested", "Replied"].includes(outcome)) {
          updated = { ...contact, lifecycle: "MQL", campaignStatus: "Stopped – MQL", dueDate: "", lastActivity: activity.date, lastTouchpoint: activity.title, activities: [activity, ...contact.activities] };
        } else if (contact.step === campaignSteps.length - 1) {
          updated = { ...contact, lifecycle: "Nurture", campaignStatus: "Completed", dueDate: "", lastActivity: activity.date, lastTouchpoint: activity.title, activities: [activity, ...contact.activities] };
        } else {
          const nextStep = contact.step + 1;
          updated = { ...contact, step: nextStep, campaignStatus: "Active", dueDate: nextDueDate(contact.step, nextStep), lastActivity: activity.date, lastTouchpoint: activity.title, activities: [activity, ...contact.activities] };
        }
        persistWorkflow(updated);
        return updated;
      }),
    );
    setTaskId(null);
  }

  function saveSequenceContent(index: number, content: string) {
    const updated = sequenceContent.map((item, itemIndex) => (itemIndex === index ? content : item));
    setSequenceContent(updated);
    window.localStorage.setItem(sequenceContentKey, JSON.stringify(updated));
    setEditingSequence(null);
  }

  return (
    <div className="crm-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">|||</span><span><b>HEMPWOOD</b><small>OUTBOUND CRM</small></span></div>
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={view === item.id && !selected ? "active" : ""} onClick={() => { setSelectedId(null); setView(item.id); }}>
              <span>{item.icon}</span>{item.label}
              {item.id === "tasks" && <i>{dueWork}</i>}
              {item.id === "handovers" && <i>{contacts.filter((contact) => contact.lifecycle === "MQL").length}</i>}
            </button>
          ))}
        </nav>
        <div className="workspace-user"><span>JR</span><div><b>Jay Robbins</b><small>Campaign owner</small></div></div>
      </aside>

      <main>
        <header className="global-header">
          <label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contacts or projects" /></label>
          <div className="source-status"><span>{loading ? "Syncing…" : `${projects.length} projects · ${contacts.length} contacts`}</span><button className="secondary" onClick={() => setRefreshToken((value) => value + 1)}>Sync sheet</button></div>
        </header>

        {syncError ? <div className="sync-error"><b>Sheet sync failed</b><p>{syncError}</p><button className="primary" onClick={() => setRefreshToken((value) => value + 1)}>Try again</button></div> : loading && !contacts.length ? <div className="loading-state">Loading projects and contacts from {sourceMeta.tab}…</div> : selected ? (
          <ContactRecord contact={selected} onBack={() => setSelectedId(null)} onLifecycle={updateLifecycle} onOwner={updateContactOwner} onWork={() => setTaskId(selected.id)} />
        ) : (
          <>
            {view === "contacts" && <ContactsView contacts={filteredContacts} allContacts={contacts} weeklyReached={weeklyReached} unreached={unreached} openFollowUps={openFollowUps} targetPercent={targetPercent} sourceMeta={sourceMeta} onSelect={setSelectedId} onTargets={() => setView("targets")} />}
            {view === "targets" && <TargetsView count={weeklyReached} percent={targetPercent} />}
            {view === "tasks" && <TasksView contacts={contacts} onWork={setTaskId} onSelect={setSelectedId} />}
            {view === "projects" && <ProjectsView projects={filteredProjects} contactNameById={contactNameById} onAssign={updateProjectOwner} />}
            {view === "sequences" && <SequenceView content={sequenceContent} onEdit={setEditingSequence} />}
            {view === "handovers" && <HandoversView contacts={contacts.filter((contact) => contact.lifecycle === "MQL")} onSelect={setSelectedId} />}
          </>
        )}
      </main>

      {taskContact && <TaskModal contact={taskContact} template={sequenceContent[taskContact.step]} onClose={() => setTaskId(null)} onComplete={completeStep} />}
      {editingSequence !== null && <SequenceEditor key={editingSequence} index={editingSequence} content={sequenceContent[editingSequence]} onClose={() => setEditingSequence(null)} onSave={saveSequenceContent} />}
    </div>
  );
}

function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="page-header"><h1>{title}</h1>{children}</div>;
}

function ContactsView({ contacts, allContacts, weeklyReached, unreached, openFollowUps, targetPercent, sourceMeta, onSelect, onTargets }: { contacts: Contact[]; allContacts: Contact[]; weeklyReached: number; unreached: number; openFollowUps: number; targetPercent: number; sourceMeta: { tab: string; syncedAt: string }; onSelect: (id: string) => void; onTargets: () => void }) {
  const dueToday = unreached + openFollowUps;
  const overdue = allContacts.filter((contact) => isOverdue(contact.dueDate)).length;
  return <section className="view"><PageHeader title="Contacts"><a href={sourceSheetUrl} target="_blank" rel="noreferrer">{sourceMeta.tab}</a></PageHeader>
    <button className="target-strip" onClick={onTargets}><span><small>THIS WEEK</small><b>Projects reached through outreach</b></span><strong>{weeklyReached} / {weeklyProjectTarget}</strong><em><i style={{ width: `${targetPercent}%` }} /></em><span>{Math.max(0, weeklyProjectTarget - weeklyReached)} remaining</span><b>View target →</b></button>
    <div className="stats"><div><small>Due today</small><b>{dueToday}</b><p>{unreached} unreached projects + {openFollowUps} follow-ups</p></div><div><small>Overdue follow-ups</small><b className="danger">{overdue}</b></div><div><small>Contacts</small><b>{allContacts.length}</b></div><div><small>MQL handovers</small><b>{allContacts.filter((contact) => contact.lifecycle === "MQL").length}</b></div></div>
    <div className="table-card"><table className="contacts-table"><thead><tr><th>Contact</th><th className="align-center">Lifecycle</th><th className="align-center">Projects</th><th className="align-center">Person LinkedIn</th><th className="align-center">Company LinkedIn</th><th className="align-center">Website</th><th>Current step</th><th>Last touchpoint</th><th>Assignee</th></tr></thead><tbody>{contacts.map((contact) => { const step = campaignSteps[Math.min(contact.step, campaignSteps.length - 1)]; return <tr key={contact.id} onClick={() => onSelect(contact.id)}><td><div className="contact-cell"><span>{contact.initials}</span><div><b>{contact.name}</b><small>{contact.company}</small></div></div></td><td className="align-center"><span className={`pill ${lifecycleClass(contact.lifecycle)}`}>{contact.lifecycle || "—"}</span></td><td className="align-center">{contact.projects.length}</td><td className="align-center link-cell" onClick={(event) => event.stopPropagation()}><ContactLink href={contact.personalLinkedIn}>Profile</ContactLink></td><td className="align-center link-cell" onClick={(event) => event.stopPropagation()}><ContactLink href={contact.companyLinkedIn}>Company</ContactLink></td><td className="align-center link-cell" onClick={(event) => event.stopPropagation()}><ContactLink href={contact.companyWebsite}>Website</ContactLink></td><td>{contact.lifecycle === "MQL" ? "Sales handover" : `${contact.step + 1}. ${step.name}`}</td><td>{contact.lastActivity}</td><td>{contact.owner}</td></tr>; })}</tbody></table></div>
  </section>;
}

function TargetsView({ count, percent }: { count: number; percent: number }) {
  return <section className="view"><PageHeader title="Weekly targets"><a href="https://docs.google.com/spreadsheets/d/1aV1t5wTRRSkyO1vzysj_6z1UGFKWVuoZYLBTDPLv6Js/edit" target="_blank" rel="noreferrer">HempWood targets</a></PageHeader>
    <article className="target-card"><div><span className="target-icon">→</span><span className={`pace ${count >= weeklyProjectTarget ? "good" : ""}`}>{count >= weeklyProjectTarget ? "Target reached" : "In progress"}</span></div><small>Unique projects reached through email, phone, or LinkedIn this week</small><h2>{count}<span> / {weeklyProjectTarget}</span></h2><em><i style={{ width: `${percent}%` }} /></em><p>{Math.max(0, weeklyProjectTarget - count)} projects remaining this week</p></article>
  </section>;
}

function TasksView({ contacts, onWork, onSelect }: { contacts: Contact[]; onWork: (id: string) => void; onSelect: (id: string) => void }) {
  const tasks = contacts
    .filter((contact) => ["Active", "Not started"].includes(contact.campaignStatus))
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  return <section className="view"><PageHeader title="Tasks"/><div className="task-list">{tasks.map((contact) => {
    const step = campaignSteps[Math.min(contact.step, campaignSteps.length - 1)];
    const label = dueLabel(contact.dueDate);
    return <article key={contact.id}><span className="task-icon">{step.channel === "Email" ? "✉" : step.channel === "Call" ? "⌕" : "in"}</span><div><b>{step.name}</b><p>{contact.name} · {contact.projects.map((project) => project.name).join(" + ")}</p></div><time className={isOverdue(contact.dueDate) ? "danger" : ""}>{label}</time><button className="secondary" onClick={() => onSelect(contact.id)}>View</button><button className="primary" onClick={() => onWork(contact.id)}>Work task</button></article>;
  })}</div></section>;
}

function ProjectsView({ projects, contactNameById, onAssign }: { projects: Project[]; contactNameById: Map<string, string>; onAssign: (id: string, owner: string) => void }) {
  return <section className="view"><PageHeader title="Projects"><span className="count-label">{projects.length} from Sample Projects</span></PageHeader><div className="table-card"><table><thead><tr><th>Project</th><th>Owner / applicant</th><th>Stage</th><th>Type</th><th>Contacts</th><th className="align-center">Source</th><th>Assignee</th></tr></thead><tbody>{projects.map((project) => <tr key={project.id}><td><b>{project.name}</b><small>{project.location}</small></td><td>{project.owner || "—"}</td><td>{project.stage || "—"}</td><td>{project.projectType || "—"}</td><td>{project.contactIds.map((id) => contactNameById.get(id)).filter(Boolean).join(", ") || "Contact unavailable"}</td><td className="align-center">{project.source ? <a className="link" href={project.source.split(/\s\|\s|\n/)[0]} target="_blank" rel="noreferrer">Open</a> : "—"}</td><td><input className="inline-input" aria-label={`Assignee for ${project.name}`} value={project.assignee} onChange={(event) => onAssign(project.id, event.target.value)} /></td></tr>)}</tbody></table></div></section>;
}

function SequenceView({ content, onEdit }: { content: string[]; onEdit: (index: number) => void }) {
  return <section className="view"><PageHeader title="Sequences"/><article className="sequence-card"><header><div><span>→</span><div><h2>Early-design influence</h2><p>7 steps · 20 days · one sequence per person</p></div></div><span className="pill lead">Active</span></header>{campaignSteps.map((step, index) => <div className="sequence-step" key={step.name}><span>{index + 1}</span><div><b>{step.name}</b><small>{content[index]?.trim() ? "Content ready" : "Content needed"}</small></div><time>{step.channel} · Day {step.day}</time><button onClick={() => onEdit(index)}>Edit content</button></div>)}</article></section>;
}

function HandoversView({ contacts, onSelect }: { contacts: Contact[]; onSelect: (id: string) => void }) {
  return <section className="view"><PageHeader title="MQL handovers"/><div className="handover-grid">{contacts.map((contact) => <article key={contact.id}><header><div><h2>{contact.name}</h2><p>{contact.company}</p></div><span className="pill mql">Open</span></header><div className="handover-meta"><span><small>Assignee</small><b>{contact.owner}</b></span><span><small>Projects</small><b>{contact.projects.length}</b></span><span><small>Last touchpoint</small><b>{contact.lastActivity}</b></span></div><p>{contact.summary}</p><button className="primary" onClick={() => onSelect(contact.id)}>Review record</button></article>)}</div></section>;
}

function ContactLink({ href, children }: { href: string; children: React.ReactNode }) {
  return href ? <a className="link" href={href} target="_blank" rel="noreferrer">{children}</a> : <span>—</span>;
}

function ContactRecord({ contact, onBack, onLifecycle, onOwner, onWork }: { contact: Contact; onBack: () => void; onLifecycle: (id: string, lifecycle: Lifecycle) => void; onOwner: (id: string, owner: string) => void; onWork: () => void }) {
  const step = campaignSteps[Math.min(contact.step, campaignSteps.length - 1)];
  return <section className="record"><header><button onClick={onBack}>← Contacts</button><span className="avatar">{contact.initials}</span><div><h1>{contact.name}</h1><p>{contact.company}</p></div><button className="primary" onClick={onWork}>{contact.lifecycle === "MQL" ? "Review handover" : "Work current task"}</button></header><div className="record-grid"><aside><div className="profile"><span className="large-avatar">{contact.initials}</span><h2>{contact.name}</h2><p>{contact.title || "Role not listed"}</p></div><div className="panel"><h3>Contact information</h3><label>Lifecycle from sheet<select value={contact.lifecycle} onChange={(event) => onLifecycle(contact.id, event.target.value as Lifecycle)}><option value="">—</option><option>Lead</option><option>MQL</option><option>Nurture</option><option>Disqualified</option></select></label><label>Actual role<b>{contact.title || "—"}</b></label><label>Email{contact.email ? <a className="link" href={`mailto:${contact.email}`}>{contact.email}</a> : <b>—</b>}</label><label>Phone{contact.phone ? <a className="link" href={`tel:${contact.phone}`}>{contact.phone}</a> : <b>—</b>}</label><label>Personal LinkedIn<ContactLink href={contact.personalLinkedIn}>Open profile</ContactLink></label><label>Company LinkedIn<ContactLink href={contact.companyLinkedIn}>Open company</ContactLink></label><label>Company website<ContactLink href={contact.companyWebsite}>Open website</ContactLink></label><label>Relationship<b>{contact.relationship || "—"}</b></label><label>Assignee<input className="owner-input" value={contact.owner} onChange={(event) => onOwner(contact.id, event.target.value)} /></label></div></aside><div><div className="panel current"><h3>{contact.lifecycle === "MQL" ? "Sales handover" : `Step ${contact.step + 1} · ${step.name}`}</h3><p>{contact.lifecycle === "MQL" ? "Sequence stopped at MQL." : `${step.channel} · Day ${step.day} · ${dueLabel(contact.dueDate)}`}</p>{contact.lifecycle !== "MQL" && <button className="primary" onClick={onWork}>Work task</button>}</div><div className="panel"><h3>Last touchpoint from sheet</h3><p className="touchpoint-note">{contact.lastTouchpoint || "No touchpoint recorded."}</p></div><div className="panel"><h3>Activity history</h3><div className="timeline">{contact.activities.length ? contact.activities.map((activity) => <article key={activity.id}><span>✓</span><div><b>{activity.title}</b><p>{activity.note}</p><small>{activity.date}</small></div></article>) : <p>No activity recorded in the source sheet.</p>}</div></div></div><aside><div className="panel"><h3>Source context</h3><p>{contact.summary}</p>{contact.comments && <p><b>Comments:</b> {contact.comments}</p>}</div><div className="panel"><h3>Projects ({contact.projects.length})</h3>{contact.projects.map((project) => <article className="project-mini" key={project.id}><b>{project.name}</b><p>{project.owner} · {project.location}</p><p>{project.stage}</p>{project.source && <a className="link" href={project.source.split(/\s\|\s|\n/)[0]} target="_blank" rel="noreferrer">Project source</a>}</article>)}</div></aside></div></section>;
}

function TaskModal({ contact, template, onClose, onComplete }: { contact: Contact; template: string; onClose: () => void; onComplete: (id: string, outcome: string) => void }) {
  const [outcome, setOutcome] = useState("Completed");
  const step = campaignSteps[Math.min(contact.step, campaignSteps.length - 1)];
  return <div className="modal-backdrop"><section className="modal"><header><div><small>STEP {contact.step + 1} · {step.channel} · DAY {step.day}</small><h2>{step.name}</h2></div><button onClick={onClose}>×</button></header><div className="modal-grid"><div><div className="context"><b>{contact.name}</b> · {contact.company}<br/>{contact.projects.map((project) => project.name).join(" + ")}</div><label>Suggested content<textarea rows={14} defaultValue={personalizedCopy(contact, template)} /></label></div><aside><h3>Log activity</h3><label>Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option>Completed</option><option>Voicemail left</option><option>No answer</option><option>Connected</option><option>Replied</option><option>Meeting booked</option><option>Sample requested</option></select></label><p>A reply, meeting, or sample request moves the contact to MQL and stops the sequence.</p><button className="primary full" onClick={() => onComplete(contact.id, outcome)}>Complete step</button><button className="secondary full" onClick={onClose}>Cancel</button></aside></div></section></div>;
}

function SequenceEditor({ index, content, onClose, onSave }: { index: number; content: string; onClose: () => void; onSave: (index: number, content: string) => void }) {
  const [value, setValue] = useState(content);
  const step = campaignSteps[index];
  return <div className="modal-backdrop"><section className="modal sequence-editor"><header><div><small>STEP {index + 1} · DAY {step.day}</small><h2>Edit {step.name}</h2></div><button onClick={onClose}>×</button></header><div className="editor-body"><p>Available tokens: {"{firstName}, {project}, {stage}, {applications}, {portfolio}"}</p><textarea rows={16} value={value} onChange={(event) => setValue(event.target.value)} /><div><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={() => onSave(index, value)}>Save content</button></div></div></section></div>;
}
