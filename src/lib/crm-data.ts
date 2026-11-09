export type Lifecycle = "Lead" | "MQL" | "Nurture" | "Disqualified";

export type Project = {
  id: string;
  name: string;
  owner: string;
  location: string;
  stage: string;
  applications: string;
  priority: "P1" | "P2";
};

export type Activity = {
  id: string;
  type: "email" | "call" | "linkedin" | "sample" | "handover" | "research";
  title: string;
  note: string;
  date: string;
};

export type Contact = {
  id: string;
  initials: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  relationship: string;
  lifecycle: Lifecycle;
  sequenceStatus: string;
  step: number;
  nextDate: string;
  owner: string;
  lastActivity: string;
  priority: "P1" | "P2";
  summary: string;
  projects: Project[];
  activities: Activity[];
};

export const campaignSteps = [
  { name: "Email 1", day: 1, channel: "Email" },
  { name: "Call 1 / VM", day: 4, channel: "Call" },
  { name: "LinkedIn Connect", day: 6, channel: "LinkedIn" },
  { name: "LinkedIn Message", day: 9, channel: "LinkedIn" },
  { name: "Email 2", day: 12, channel: "Email" },
  { name: "Call 2 / VM", day: 16, channel: "Call" },
  { name: "Email 3 / Close", day: 20, channel: "Email" },
] as const;

export const weeklyProjectTarget = 83;

export const seedContacts: Contact[] = [
  {
    id: "rob",
    initials: "RD",
    name: "Rob Deal, AIA, LEED AP",
    title: "President, Lexington Office",
    company: "JRA Architects",
    email: "rdeal@jrarchitects.com",
    phone: "+1 859-899-9997",
    relationship: "Local architect / sector alternative",
    lifecycle: "Lead",
    sequenceStatus: "Active",
    step: 0,
    nextDate: "Today",
    owner: "Maya Chen",
    lastActivity: "No activity",
    priority: "P1",
    summary:
      "Lexington-based architecture leader with two active University of Kentucky opportunities. Public evidence does not identify him as project lead, so outreach should route to the person responsible for interiors and specifications.",
    projects: [
      { id: "uk-arts", name: "UK Arts & Innovation Complex", owner: "University of Kentucky", location: "Lexington, KY", stage: "Schematic design", applications: "Wall cladding · stairs · millwork", priority: "P1" },
      { id: "uk-health", name: "UK King’s Daughters Health Park", owner: "UK King’s Daughters", location: "Ashland, KY", stage: "Schematic design", applications: "Reception · wall finishes · counters", priority: "P2" },
    ],
    activities: [{ id: "a1", type: "research", title: "Research completed", note: "Relationship and projects verified.", date: "Today · 8:15 AM" }],
  },
  {
    id: "cameron",
    initials: "CB",
    name: "Cameron S. Bolin, AIA",
    title: "Senior Associate / Project Manager",
    company: "BarberMcMurry Architects",
    email: "cbolin@bma1915.com",
    phone: "+1 865-719-1893",
    relationship: "Local architect / sector alternative",
    lifecycle: "Lead",
    sequenceStatus: "Active",
    step: 1,
    nextDate: "4 days overdue",
    owner: "Maya Chen",
    lastActivity: "Email sent · Oct 30",
    priority: "P1",
    summary: "Senior architect and project manager at a Tennessee firm relevant to ETSU’s market. The next call should confirm the working team and material-selection process.",
    projects: [{ id: "etsu-life", name: "ETSU Student Life Village", owner: "East Tennessee State University", location: "Johnson City, TN", stage: "Programming / early design", applications: "Flooring · stairs · counters · wall finish", priority: "P1" }],
    activities: [{ id: "a2", type: "email", title: "Email 1 sent", note: "Project-specific introduction sent.", date: "Oct 30 · 10:42 AM" }],
  },
  {
    id: "denis",
    initials: "DH",
    name: "Denis Henmi",
    title: "Principal",
    company: "DLR Group",
    email: "dhenmi@dlrgroup.com",
    phone: "+1 415-901-7202",
    relationship: "Named architecture-firm contact",
    lifecycle: "MQL",
    sequenceStatus: "Stopped – MQL",
    step: 4,
    nextDate: "Sales review today",
    owner: "HempWood sales",
    lastActivity: "Sample delivered · Oct 30",
    priority: "P1",
    summary: "The project team confirmed sample receipt. Campaign outreach is stopped and the record is ready for sales ownership and feedback follow-up.",
    projects: [{ id: "freedom-west", name: "Freedom West 2.0 — Hotel Phase", owner: "MacFarlane Partners + Avanath", location: "San Francisco, CA", stage: "Environmental review", applications: "Hospitality flooring · walls · millwork", priority: "P1" }],
    activities: [
      { id: "a3", type: "sample", title: "Sample delivered", note: "Firm confirmed receipt.", date: "Oct 30 · 3:12 PM" },
      { id: "a4", type: "call", title: "Call connected", note: "Project context discussed.", date: "Oct 16 · 11:20 AM" },
    ],
  },
  {
    id: "erica",
    initials: "ER",
    name: "Erica Rasch, NCIDQ",
    title: "Interior Designer",
    company: "McCarty Holsaple McCarty",
    email: "erasch@mhminc.com",
    phone: "+1 404-867-2456",
    relationship: "Local architect / sector alternative",
    lifecycle: "Lead",
    sequenceStatus: "Active",
    step: 2,
    nextDate: "Nov 11",
    owner: "Maya Chen",
    lastActivity: "Call · Nov 7",
    priority: "P1",
    summary: "Interior designer at the selected architecture firm for an early-stage medical education renovation. Public sources do not confirm her project assignment.",
    projects: [{ id: "etsu-com", name: "ETSU COM Building 4 Renovation", owner: "East Tennessee State University", location: "Johnson City, TN", stage: "Early design", applications: "Student support interiors · walls · counters", priority: "P1" }],
    activities: [{ id: "a5", type: "call", title: "Call 1 completed", note: "No answer; voicemail left.", date: "Nov 7 · 2:04 PM" }],
  },
  {
    id: "ian",
    initials: "IM",
    name: "Ian McHone",
    title: "Lexington Office Lead",
    company: "Joseph & Joseph Architects",
    email: "i.mchone@josephandjoseph.net",
    phone: "+1 859-227-9059",
    relationship: "Local architect / sector alternative",
    lifecycle: "Lead",
    sequenceStatus: "Active",
    step: 4,
    nextDate: "Nov 12",
    owner: "Maya Chen",
    lastActivity: "LinkedIn · Nov 8",
    priority: "P1",
    summary: "Lexington office leader associated with a firm named on two Kentucky hospitality projects. One portfolio message should reference both opportunities.",
    projects: [
      { id: "angels-envy", name: "Angel’s Envy Distillery Expansion", owner: "Angel’s Envy / Bacardi", location: "Louisville, KY", stage: "Design", applications: "Tasting rooms · rooftop bar · event spaces", priority: "P1" },
      { id: "daniel-boone", name: "Daniel Boone Hotel Renovation", owner: "City of Whitesburg", location: "Whitesburg, KY", stage: "Entering design", applications: "Historic hospitality · retail interiors", priority: "P1" },
    ],
    activities: [{ id: "a6", type: "linkedin", title: "LinkedIn message sent", note: "Referenced both opportunities.", date: "Nov 8 · 4:05 PM" }],
  },
];
