export const lifecycleStages = [
  "Prospect",
  "Lead",
  "MQL",
  "SQL",
  "Customer/Order",
  "Specified",
  "Nurture",
] as const;

export type Lifecycle = (typeof lifecycleStages)[number];

export const contactTypes = ["Architect", "General Contractor", "Owner", "Landlord"] as const;

export type ContactType = (typeof contactTypes)[number];

export type Project = {
  id: string;
  name: string;
  state: string;
  ownership: string;
  audienceType: string;
  projectType: string;
  location: string;
  owner: string;
  stage: string;
  source: string;
  architectureFirm: string;
  comments: string;
  assignee: string;
  contactIds: string[];
};

export type Activity = {
  id: string;
  type: "email" | "call" | "linkedin" | "sample" | "handover" | "research";
  title: string;
  note: string;
  date: string;
  dateValue: string;
  projectId: string;
};

export type Contact = {
  id: string;
  initials: string;
  name: string;
  title: string;
  company: string;
  companyWebsite: string;
  companyLinkedIn: string;
  personalLinkedIn: string;
  email: string;
  phone: string;
  relationship: string;
  contactType: ContactType;
  lifecycle: Lifecycle;
  sequenceStatus: string;
  callStatus: string;
  campaignStatus: string;
  step: number;
  dueDate: string;
  owner: string;
  lastActivity: string;
  lastTouchpoint: string;
  comments: string;
  summary: string;
  projects: Project[];
  activities: Activity[];
};

export type CrmData = {
  contacts: Contact[];
  projects: Project[];
  sourceUrl: string;
  sourceTab: string;
  syncedAt: string;
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

export const defaultSequenceContent = [
  "Hi {firstName},\n\nI’m reaching out because {project} is currently in {stage}, while interior finish decisions can still be influenced.{portfolio}\n\nHempWood is a US-grown, carbon-negative, zero-VOC hardwood alternative. {applications} look like the strongest applications.\n\nI’m not assuming you own this decision. Are you the right person to speak with, or could you direct me to the team member handling interior materials and specifications?\n\nBest,\nHempWood",
  "Call objective: confirm the team and material-selection process for {project}.\n\nAsk whether the project is still in {stage}, who guides interior finish specifications, and whether samples or technical information would be useful.",
  "Hi {firstName} — reaching out with a material idea related to {project}. HempWood is a US-grown, zero-VOC hardwood alternative for {applications}. I’d value connecting and can coordinate with the right project-team member.",
  "Thanks for connecting, {firstName}. If {project} is still evaluating interior finishes, I can share HempWood samples and technical details. Who on the team would be best to coordinate with?",
  "Hi {firstName},\n\nA practical follow-up for {project}: HempWood supports {applications} with a carbon-negative, zero-VOC material grown and manufactured in the US.\n\nWould samples or a concise technical comparison be useful for the team?",
  "Second call objective: confirm whether {project} has advanced, who owns interior finish specifications, and whether samples, technical information, or a lunch-and-learn are useful.",
  "Hi {firstName},\n\nI’ll close the loop for now on {project}. Is there a colleague or project-team member who owns the interior material decision? If the timing is early, I’m happy to reconnect around the next design milestone.\n\nBest,\nHempWood",
] as const;

export const weeklyProjectTarget = 83;
export const defaultAssignee = "Jay Robbins";
export const sourceSheetUrl =
  "https://docs.google.com/spreadsheets/d/1o9tvZAtzLbAQxXYdT8xAxIIByoB4bKok2qAQjXX_hfA/edit?usp=sharing";
