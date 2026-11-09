"use client";

import { useEffect, useMemo, useState } from "react";
import {
  campaignSteps,
  type Contact,
  type Lifecycle,
  seedContacts,
  weeklyProjectTarget,
} from "@/lib/crm-data";

type View = "contacts" | "targets" | "tasks" | "projects" | "sequences" | "handovers";

const navItems: { id: View; label: string; icon: string }[] = [
  { id: "contacts", label: "Contacts", icon: "♙" },
  { id: "targets", label: "Weekly targets", icon: "◎" },
  { id: "tasks", label: "Tasks", icon: "✓" },
  { id: "projects", label: "Projects", icon: "⌂" },
  { id: "sequences", label: "Sequences", icon: "↗" },
  { id: "handovers", label: "MQL handovers", icon: "◇" },
];

function personalizedCopy(contact: Contact) {
  const project = contact.projects[0];
  const portfolio = contact.projects[1]
    ? ` I also noticed ${contact.projects[1].name}, so I’m coordinating both opportunities in one conversation.`
    : "";
  const firstName = contact.name.split(" ")[0];

  return [
    `Hi ${firstName},\n\nI’m reaching out because ${project.name} is currently in ${project.stage.toLowerCase()}, while interior finish decisions can still be influenced.${portfolio}\n\nHempWood is a US-grown, carbon-negative, zero-VOC hardwood alternative. ${project.applications} look like the strongest applications.\n\nI’m not assuming you own this decision. Are you the right person to speak with, or could you direct me to the team member handling interior materials and specifications?\n\nBest,\nHempWood`,
    `Call objective: confirm the team and material-selection process for ${project.name}.\n\nAsk whether the project is still in ${project.stage.toLowerCase()}, who guides interior finish specifications, and whether samples or technical information would be useful.`,
    `Hi ${firstName} — reaching out with a material idea related to ${project.name}. HempWood is a US-grown, zero-VOC hardwood alternative for ${project.applications.toLowerCase()}. I’d value connecting and can coordinate with the right project-team member.`,
    `Thanks for connecting, ${firstName}. If ${project.name} is still evaluating interior finishes, I can share HempWood samples and technical details. Who on the team would be best to coordinate with?`,
    `Hi ${firstName},\n\nA practical follow-up for ${project.name}: HempWood supports ${project.applications.toLowerCase()} with a carbon-negative, zero-VOC material grown and manufactured in the US.\n\nWould samples or a concise technical comparison be useful for the team?`,
    `Second call objective: confirm whether ${project.name} has advanced, who owns interior finish specifications, and whether samples, technical information, or a lunch-and-learn are useful.`,
    `Hi ${firstName},\n\nI’ll close the loop for now on ${project.name}. Is there a colleague or project-team member who owns the interior material decision? If the timing is early, I’m happy to reconnect around the next design milestone.\n\nBest,\nHempWood`,
  ][contact.step];
}

export default function CrmApp() {
  const [contacts, setContacts] = useState<Contact[]>(() => {
    if (typeof window === "undefined") return seedContacts;
    const stored = window.localStorage.getItem("hempwood-vercel-crm-v1");
    return stored ? (JSON.parse(stored) as Contact[]) : seedContacts;
  });
  const [view, setView] = useState<View>("contacts");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem("hempwood-vercel-crm-v1", JSON.stringify(contacts));
  }, [contacts]);

  const projects = useMemo(() => {
    const map = new Map<string, Contact["projects"][number] & { contacts: string[] }>();
    contacts.forEach((contact) =>
      contact.projects.forEach((project) => {
        const existing = map.get(project.id);
        if (existing) existing.contacts.push(contact.name);
        else map.set(project.id, { ...project, contacts: [contact.name] });
      }),
    );
    return [...map.values()];
  }, [contacts]);

  const filteredContacts = contacts.filter((contact) =>
    `${contact.name} ${contact.company} ${contact.projects.map((project) => project.name).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const selected = contacts.find((contact) => contact.id === selectedId) ?? null;
  const taskContact = contacts.find((contact) => contact.id === taskId) ?? null;
  const targetPercent = Math.min(100, Math.round((projects.length / weeklyProjectTarget) * 100));

  function updateLifecycle(contactId: string, lifecycle: Lifecycle) {
    setContacts((current) =>
      current.map((contact) => {
        if (contact.id !== contactId) return contact;
        if (lifecycle === "MQL") {
          return {
            ...contact,
            lifecycle,
            sequenceStatus: "Stopped – MQL",
            nextDate: "Sales review today",
            owner: "HempWood sales",
            activities: [
              { id: crypto.randomUUID(), type: "handover", title: "MQL handover created", note: "Sequence stopped and sales ownership assigned.", date: "Today" },
              ...contact.activities,
            ],
          };
        }
        return { ...contact, lifecycle };
      }),
    );
  }

  function completeStep(contactId: string, outcome: string) {
    setContacts((current) =>
      current.map((contact) => {
        if (contact.id !== contactId) return contact;
        const step = campaignSteps[contact.step];
        const activity = {
          id: crypto.randomUUID(),
          type: step.channel.toLowerCase() === "linkedin" ? ("linkedin" as const) : step.channel.toLowerCase() === "call" ? ("call" as const) : ("email" as const),
          title: `${step.name} · ${outcome}`,
          note: "Completed from the task workspace.",
          date: "Today",
        };
        if (outcome === "Meeting booked" || outcome === "Sample requested") {
          return {
            ...contact,
            lifecycle: "MQL" as const,
            sequenceStatus: "Stopped – MQL",
            nextDate: "Sales review today",
            owner: "HempWood sales",
            lastActivity: `${step.name} · Today`,
            activities: [
              { id: crypto.randomUUID(), type: "handover" as const, title: "MQL handover created", note: `Trigger: ${outcome}.`, date: "Today" },
              activity,
              ...contact.activities,
            ],
          };
        }
        if (contact.step === campaignSteps.length - 1) {
          return { ...contact, lifecycle: "Nurture" as const, sequenceStatus: "Completed", nextDate: "Nurture review", activities: [activity, ...contact.activities] };
        }
        const nextStep = contact.step + 1;
        return { ...contact, step: nextStep, nextDate: `Day ${campaignSteps[nextStep].day}`, lastActivity: `${step.name} · Today`, activities: [activity, ...contact.activities] };
      }),
    );
    setTaskId(null);
  }

  return (
    <div className="crm-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">|||</span><span><b>HEMPWOOD</b><small>OUTBOUND CRM</small></span></div>
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={view === item.id && !selected ? "active" : ""} onClick={() => { setSelectedId(null); setView(item.id); }}>
              <span>{item.icon}</span>{item.label}
              {item.id === "tasks" && <i>{contacts.filter((contact) => contact.sequenceStatus === "Active").length}</i>}
              {item.id === "handovers" && <i>{contacts.filter((contact) => contact.lifecycle === "MQL").length}</i>}
            </button>
          ))}
        </nav>
        <div className="workspace-user"><span>HW</span><div><b>HempWood team</b><small>Workspace admin</small></div></div>
      </aside>

      <main>
        <header className="global-header">
          <label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contacts, projects, activities" /></label>
          <button className="primary">＋ Create contact</button>
        </header>

        {selected ? (
          <ContactRecord contact={selected} onBack={() => setSelectedId(null)} onLifecycle={updateLifecycle} onWork={() => setTaskId(selected.id)} />
        ) : (
          <>
            {view === "contacts" && <ContactsView contacts={filteredContacts} projects={projects.length} targetPercent={targetPercent} onSelect={setSelectedId} onTargets={() => setView("targets")} />}
            {view === "targets" && <TargetsView count={projects.length} percent={targetPercent} />}
            {view === "tasks" && <TasksView contacts={contacts} onWork={setTaskId} onSelect={setSelectedId} />}
            {view === "projects" && <ProjectsView projects={projects} />}
            {view === "sequences" && <SequenceView />}
            {view === "handovers" && <HandoversView contacts={contacts.filter((contact) => contact.lifecycle === "MQL")} onSelect={setSelectedId} />}
          </>
        )}
      </main>

      {taskContact && <TaskModal contact={taskContact} onClose={() => setTaskId(null)} onComplete={completeStep} />}
    </div>
  );
}

function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="page-header"><h1>{title}</h1>{children}</div>;
}

function ContactsView({ contacts, projects, targetPercent, onSelect, onTargets }: { contacts: Contact[]; projects: number; targetPercent: number; onSelect: (id: string) => void; onTargets: () => void }) {
  return <section className="view"><PageHeader title="Contacts"><button className="secondary">Import</button></PageHeader>
    <button className="target-strip" onClick={onTargets}><span><small>THIS WEEK</small><b>Qualified projects sourced</b></span><strong>{projects} / {weeklyProjectTarget}</strong><em><i style={{ width: `${targetPercent}%` }} /></em><span>{weeklyProjectTarget - projects} remaining</span><b>View targets →</b></button>
    <div className="stats"><div><small>Due today</small><b>{contacts.filter((contact) => contact.nextDate.toLowerCase().includes("today")).length}</b></div><div><small>Overdue</small><b className="danger">{contacts.filter((contact) => contact.nextDate.includes("overdue")).length}</b></div><div><small>Active sequences</small><b>{contacts.filter((contact) => contact.sequenceStatus === "Active").length}</b></div><div><small>MQL handovers</small><b>{contacts.filter((contact) => contact.lifecycle === "MQL").length}</b></div></div>
    <div className="table-card"><table><thead><tr><th>Contact</th><th>Lifecycle</th><th>Projects</th><th>Sequence</th><th>Current step</th><th>Next activity</th><th>Owner</th></tr></thead><tbody>{contacts.map((contact) => { const step = campaignSteps[Math.min(contact.step, campaignSteps.length - 1)]; return <tr key={contact.id} onClick={() => onSelect(contact.id)}><td><div className="contact-cell"><span>{contact.initials}</span><div><b>{contact.name}</b><small>{contact.company}</small></div></div></td><td><span className={`pill ${contact.lifecycle.toLowerCase()}`}>{contact.lifecycle}</span></td><td>{contact.projects.length}</td><td><span className="pill">{contact.sequenceStatus}</span></td><td>{contact.lifecycle === "MQL" ? "Sales handover" : `${contact.step + 1}. ${step.name}`}</td><td className={contact.nextDate.includes("overdue") ? "danger" : "link"}>{contact.nextDate}</td><td>{contact.owner}</td></tr>; })}</tbody></table></div>
  </section>;
}

function TargetsView({ count, percent }: { count: number; percent: number }) {
  return <section className="view"><PageHeader title="Weekly targets"><a href="https://docs.google.com/spreadsheets/d/1aV1t5wTRRSkyO1vzysj_6z1UGFKWVuoZYLBTDPLv6Js/edit" target="_blank" rel="noreferrer">Pipeline calculator ↗</a></PageHeader>
    <div className="week-row"><span><small>WEEK OF</small><b>Nov 9–15, 2026</b></span><span className="pill lead">In progress</span></div>
    <article className="target-card"><div><span className="target-icon">⌂</span><span className={`pace ${count >= 17 ? "good" : ""}`}>{count >= 17 ? "On track" : "Behind pace"}</span></div><small>Qualified projects sourced</small><h2>{count}<span> / {weeklyProjectTarget} this week</span></h2><em><i style={{ width: `${percent}%` }} /></em><p>{weeklyProjectTarget - count} remaining · 17 projects per workday</p></article>
    <div className="target-details"><article><h3>Daily project pace</h3><div className="daily-grid">{["Mon","Tue","Wed","Thu","Fri"].map((day, index) => <div key={day}><span>{day}</span><b>{index === 0 ? count : "—"}</b><small>{index < 3 ? 17 : 16} target</small></div>)}</div></article><article><h3>What counts</h3><ul><li>Active, forward-looking project</li><li>HempWood-compatible interiors</li><li>Credible dated evidence</li><li>No confirmed construction start</li><li>Duplicate project counts once</li></ul></article></div>
  </section>;
}

function TasksView({ contacts, onWork, onSelect }: { contacts: Contact[]; onWork: (id: string) => void; onSelect: (id: string) => void }) {
  const tasks = contacts.filter((contact) => contact.sequenceStatus === "Active");
  return <section className="view"><PageHeader title="Tasks"/><div className="task-list">{tasks.map((contact) => {
    const step = campaignSteps[contact.step];
    return <article key={contact.id}><span className="task-icon">{step.channel === "Email" ? "✉" : step.channel === "Call" ? "⌕" : "in"}</span><div><b>{step.name}</b><p>{contact.name} · {contact.projects.map((project) => project.name).join(" + ")}</p></div><time className={contact.nextDate.includes("overdue") ? "danger" : ""}>{contact.nextDate}</time><button className="secondary" onClick={() => onSelect(contact.id)}>View</button><button className="primary" onClick={() => onWork(contact.id)}>Work task</button></article>;
  })}</div></section>;
}

function ProjectsView({ projects }: { projects: Array<Contact["projects"][number] & { contacts: string[] }> }) {
  return <section className="view"><PageHeader title="Projects"/><div className="table-card"><table><thead><tr><th>Project</th><th>Owner / applicant</th><th>Stage</th><th>Applications</th><th>Contacts</th><th>Priority</th></tr></thead><tbody>{projects.map((project) => <tr key={project.id}><td><b className="link">{project.name}</b><small>{project.location}</small></td><td>{project.owner}</td><td>{project.stage}</td><td>{project.applications}</td><td>{project.contacts.length}</td><td><span className="pill lead">{project.priority}</span></td></tr>)}</tbody></table></div></section>;
}

function SequenceView() {
  return <section className="view"><PageHeader title="Sequences"/><article className="sequence-card"><header><div><span>↗</span><div><h2>Early-design influence</h2><p>7 steps · 20 days · Contact-level deduplication</p></div></div><span className="pill lead">Active</span></header>{campaignSteps.map((step, index) => <div className="sequence-step" key={step.name}><span>{index + 1}</span><div><b>{step.name}</b><small>Content ready</small></div><time>{step.channel} · Day {step.day}</time><button>Edit content</button></div>)}</article></section>;
}

function HandoversView({ contacts, onSelect }: { contacts: Contact[]; onSelect: (id: string) => void }) {
  return <section className="view"><PageHeader title="MQL handovers"/><div className="handover-grid">{contacts.map((contact) => <article key={contact.id}><header><div><h2>{contact.name}</h2><p>{contact.company}</p></div><span className="pill mql">Open</span></header><div className="handover-meta"><span><small>Owner</small><b>{contact.owner}</b></span><span><small>Projects</small><b>{contact.projects.length}</b></span><span><small>Last activity</small><b>{contact.lastActivity}</b></span></div><p>{contact.summary}</p><button className="primary" onClick={() => onSelect(contact.id)}>Review record</button></article>)}</div></section>;
}

function ContactRecord({ contact, onBack, onLifecycle, onWork }: { contact: Contact; onBack: () => void; onLifecycle: (id: string, lifecycle: Lifecycle) => void; onWork: () => void }) {
  const step = campaignSteps[Math.min(contact.step, campaignSteps.length - 1)];
  return <section className="record"><header><button onClick={onBack}>← Contacts</button><span className="avatar">{contact.initials}</span><div><h1>{contact.name}</h1><p>{contact.company}</p></div><button className="primary" onClick={onWork}>{contact.lifecycle === "MQL" ? "Review handover" : "Work current task"}</button></header><div className="record-grid"><aside><div className="profile"><span className="large-avatar">{contact.initials}</span><h2>{contact.name}</h2><p>{contact.title}</p></div><div className="panel"><h3>About this contact</h3><label>Lifecycle<select value={contact.lifecycle} onChange={(event) => onLifecycle(contact.id, event.target.value as Lifecycle)}><option>Lead</option><option>MQL</option><option>Nurture</option><option>Disqualified</option></select></label><label>Email<b>{contact.email}</b></label><label>Phone<b>{contact.phone}</b></label><label>Relationship<b>{contact.relationship}</b></label><label>Owner<b>{contact.owner}</b></label></div></aside><div><div className="panel current"><h3>{contact.lifecycle === "MQL" ? "Sales handover" : `Step ${contact.step + 1} · ${step.name}`}</h3><p>{contact.lifecycle === "MQL" ? "Sequence stopped. Review context and accept sales ownership." : `${step.channel} · Day ${step.day} · ${contact.nextDate}`}</p>{contact.lifecycle !== "MQL" && <button className="primary" onClick={onWork}>Work task</button>}</div><div className="panel"><h3>Activity</h3><div className="timeline">{contact.activities.map((activity) => <article key={activity.id}><span>✓</span><div><b>{activity.title}</b><p>{activity.note}</p><small>{activity.date}</small></div></article>)}</div></div></div><aside><div className="panel"><h3>Research summary</h3><p>{contact.summary}</p></div><div className="panel"><h3>Projects ({contact.projects.length})</h3>{contact.projects.map((project) => <article className="project-mini" key={project.id}><b>{project.name}</b><p>{project.owner} · {project.location}</p><span className="pill lead">{project.priority}</span></article>)}</div></aside></div></section>;
}

function TaskModal({ contact, onClose, onComplete }: { contact: Contact; onClose: () => void; onComplete: (id: string, outcome: string) => void }) {
  const [outcome, setOutcome] = useState("Completed");
  const step = campaignSteps[contact.step];
  return <div className="modal-backdrop"><section className="modal"><header><div><small>STEP {contact.step + 1} · {step.channel} · DAY {step.day}</small><h2>{step.name}</h2></div><button onClick={onClose}>×</button></header><div className="modal-grid"><div><div className="context"><b>{contact.name}</b> · {contact.company}<br/>{contact.projects.map((project) => project.name).join(" + ")}</div><label>Suggested content<textarea rows={14} defaultValue={personalizedCopy(contact)} /></label></div><aside><h3>Log activity</h3><label>Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option>Completed</option><option>Voicemail left</option><option>No answer</option><option>Connected</option><option>Replied</option><option>Meeting booked</option><option>Sample requested</option></select></label><p>Meeting booked or sample requested will stop the sequence and create an MQL handover.</p><button className="primary full" onClick={() => onComplete(contact.id, outcome)}>Complete step</button><button className="secondary full" onClick={onClose}>Cancel</button></aside></div></section></div>;
}
