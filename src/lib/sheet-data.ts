import { parse } from "csv-parse/sync";
import { fetch as undiciFetch, ProxyAgent } from "undici";

import {
  campaignSteps,
  defaultAssignee,
  lifecycleStages,
  sourceSheetUrl,
  type Activity,
  type Contact,
  type CrmData,
  type Lifecycle,
  type Project,
} from "@/lib/crm-data";

const sourceCsvUrl =
  "https://docs.google.com/spreadsheets/d/1o9tvZAtzLbAQxXYdT8xAxIIByoB4bKok2qAQjXX_hfA/export?format=csv&gid=354551367";

type SheetRow = Record<string, string>;

function compact(value?: string) {
  return (value ?? "").trim();
}

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function initials(name: string) {
  return name
    .replace(/,.*$/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function normalizeLifecycle(value: string): Lifecycle {
  const normalized = value.trim().replace(/\.$/, "").toLowerCase();
  if (!normalized) return "Prospect";
  if (normalized.includes("specified")) return "Specified";
  if (["customer", "order", "customer/order"].includes(normalized)) return "Customer/Order";
  const match = lifecycleStages.find(
    (stage) => stage.toLowerCase() === value.trim().toLowerCase(),
  );
  return match ?? "Prospect";
}

function inferCompany(row: SheetRow) {
  const companyCell = compact(row["Company Website"]);
  if (companyCell && companyCell !== "-" && !isUrl(companyCell)) return companyCell;
  const audience = compact(row["Audience Type"]).toLowerCase();
  if (audience.includes("owner")) return compact(row["Owner / Applicant"]);
  const firm = compact(row["Architecture Firm"]);
  if (firm && firm !== "-" && !firm.toLowerCase().includes("to be selected")) return firm;
  return compact(row["Owner / Applicant"]);
}

const verifiedWebsiteDomains = new Set([
  "actonarchitects.com",
  "arcadis.com",
  "bararch.com",
  "ci.ceres.ca.us",
  "coarchitects.com",
  "dlrgroup.com",
  "flad.com",
  "gensler.com",
  "hksinc.com",
  "josephandjoseph.net",
  "kevin-tsai.com",
  "kfcyumcenter.com",
  "perkinswill.com",
  "som.com",
  "stantec.com",
]);

const verifiedWebsiteOverrides: Record<string, string> = {
  "First 5 Humboldt": "https://www.first5humboldt.org/",
  "10 Design": "https://10design.co/",
};

function inferCompanyWebsite(row: SheetRow, company: string, email: string) {
  const websiteCell = compact(row["Company Website"]);
  if (isUrl(websiteCell)) return websiteCell;
  if (verifiedWebsiteOverrides[company]) return verifiedWebsiteOverrides[company];
  const domain = email.split("@")[1]?.toLowerCase();
  return domain && verifiedWebsiteDomains.has(domain) ? `https://${domain}` : "";
}

function inferActivityType(note: string): Activity["type"] {
  const normalized = note.toLowerCase();
  if (normalized.includes("sample")) return "sample";
  if (normalized.includes("linkedin") || normalized.includes("li invite") || normalized.includes("li connection")) return "linkedin";
  if (normalized.includes("vm") || normalized.includes("voicemail") || normalized.includes("call") || normalized.includes("spoke")) return "call";
  if (normalized.includes("email")) return "email";
  return "research";
}

function extractLatestDate(note: string, now: Date) {
  const matches = [...note.matchAll(/\b(1[0-2]|0?[1-9])[\/:](3[01]|[12]\d|0?[1-9])\b/g)];
  const dates = matches
    .map((match) => {
      const month = Number(match[1]);
      const day = Number(match[2]);
      let year = now.getUTCFullYear();
      if (month > now.getUTCMonth() + 2) year -= 1;
      const date = new Date(Date.UTC(year, month - 1, day));
      return Number.isNaN(date.valueOf()) ? null : date;
    })
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.valueOf() - a.valueOf());
  return dates[0] ?? null;
}

function displayDate(date: Date | null) {
  if (!date) return "Date not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function deriveStep(row: SheetRow) {
  const evidence = [compact(row["Sequence Status"]), compact(row.Call), compact(row["Last Touchpoint"])]
    .join(" ")
    .toLowerCase();

  if (/email\s*3|close[ -]?the[ -]?loop/.test(evidence)) return 6;
  if (/call\s*2|second call/.test(evidence)) return 6;
  if (/email\s*2|2nd email|second email/.test(evidence)) return 5;
  if (/linkedin message|li message/.test(evidence)) return 4;
  if (/linkedin (invite|request|connection)|li (invite|request|connection)/.test(evidence)) return 3;
  if (/voicemail|voice ?mail|\bvm\b|call connected|spoke to/.test(evidence)) return 2;
  if (/email\s*1|email sent|\bemail\b/.test(evidence)) return 1;
  return 0;
}

function deriveDueDate(step: number, latest: Date | null, lifecycle: Lifecycle, now: Date) {
  if (["MQL", "SQL", "Customer/Order", "Specified", "Nurture"].includes(lifecycle)) return "";
  if (!latest || step === 0) return now.toISOString().slice(0, 10);
  const previousDay = campaignSteps[Math.max(0, step - 1)].day;
  const gap = campaignSteps[Math.min(step, campaignSteps.length - 1)].day - previousDay;
  const due = new Date(latest);
  due.setUTCDate(due.getUTCDate() + Math.max(1, gap));
  return due.toISOString().slice(0, 10);
}

function campaignStatus(lifecycle: Lifecycle, hasActivity: boolean) {
  if (lifecycle === "MQL") return "Stopped – MQL";
  if (lifecycle === "SQL") return "Sales follow-up";
  if (lifecycle === "Customer/Order") return "Closed – Customer";
  if (lifecycle === "Specified") return "Closed – Specified";
  if (lifecycle === "Nurture") return "Paused – Nurture";
  return hasActivity ? "Active" : "Not started";
}

function rowProject(row: SheetRow): Project {
  const name = compact(row["Project Name"]);
  return {
    id: slug(`${compact(row.State)}-${name}`),
    name,
    state: compact(row.State),
    ownership: compact(row.Ownership),
    audienceType: compact(row["Audience Type"]),
    projectType: compact(row["Project Type"]),
    location: compact(row.Location),
    owner: compact(row["Owner / Applicant"]),
    stage: compact(row["Current Stage"]),
    source: compact(row.Source),
    architectureFirm: compact(row["Architecture Firm"]),
    comments: compact(row.Comments),
    assignee: defaultAssignee,
    contactIds: [],
  };
}

export async function getCrmData(): Promise<CrmData> {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
  const response = await undiciFetch(sourceCsvUrl, { dispatcher, redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Source sheet returned ${response.status}`);
  }
  const csv = await response.text();
  await dispatcher?.close();
  const rows = parse(csv, {
    columns: (headers: string[]) => headers.map((header) => header.trim()),
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as SheetRow[];
  const populatedRows = rows.filter((row) => compact(row["Project Name"]));
  const now = new Date();
  const projectMap = new Map<string, Project>();
  const contactMap = new Map<string, Contact>();

  for (const row of populatedRows) {
    const incomingProject = rowProject(row);
    const project = projectMap.get(incomingProject.id) ?? incomingProject;
    projectMap.set(project.id, project);

    const name = compact(row.Names);
    if (!name || name === "-") continue;
    const email = compact(row.Email);
    const company = inferCompany(row);
    const contactId = slug(email || `${name}-${company}`);
    if (!project.contactIds.includes(contactId)) project.contactIds.push(contactId);

    const lifecycle = normalizeLifecycle(compact(row.Lifecycle));
    const lastTouchpoint = compact(row["Last Touchpoint"]);
    const latestDate = extractLatestDate(lastTouchpoint, now);
    const step = deriveStep(row);
    const activity: Activity | null = lastTouchpoint
      ? {
          id: `${contactId}-${project.id}-touchpoint`,
          type: inferActivityType(lastTouchpoint),
          title: project.name,
          note: lastTouchpoint,
          date: displayDate(latestDate),
          dateValue: latestDate?.toISOString() ?? "",
          projectId: project.id,
        }
      : null;

    const existing = contactMap.get(contactId);
    if (!existing) {
      contactMap.set(contactId, {
        id: contactId,
        initials: initials(name),
        name,
        title: compact(row.Role),
        company,
        companyWebsite: inferCompanyWebsite(row, company, email),
        companyLinkedIn: compact(row["Company LinkedIn"]) === "-" ? "" : compact(row["Company LinkedIn"]),
        personalLinkedIn: compact(row["Personal LinkedIn"]) === "-" ? "" : compact(row["Personal LinkedIn"]),
        email: email === "-" ? "" : email,
        phone: compact(row.Phone),
        relationship: compact(row["Audience Type"]),
        lifecycle,
        sequenceStatus: compact(row["Sequence Status"]),
        callStatus: compact(row.Call),
        campaignStatus: campaignStatus(lifecycle, Boolean(lastTouchpoint)),
        step,
        dueDate: deriveDueDate(step, latestDate, lifecycle, now),
        owner: defaultAssignee,
        lastActivity: displayDate(latestDate),
        lastTouchpoint,
        comments: compact(row.Comments),
        summary: `${compact(row.Role) || "Contact"} at ${company || "the listed organization"}. The source sheet associates this person through “${compact(row["Audience Type"]) || "relationship not specified"}.”`,
        projects: [project],
        activities: activity ? [activity] : [],
      });
      continue;
    }

    if (!existing.projects.some((item) => item.id === project.id)) existing.projects.push(project);
    if (activity && !existing.activities.some((item) => item.id === activity.id)) existing.activities.push(activity);
    if (!existing.lifecycle && lifecycle) existing.lifecycle = lifecycle;
    if (step > existing.step) {
      existing.step = step;
      existing.sequenceStatus = compact(row["Sequence Status"]) || existing.sequenceStatus;
      existing.callStatus = compact(row.Call) || existing.callStatus;
    }
    if (compact(row.Comments) && !existing.comments.includes(compact(row.Comments))) {
      existing.comments = [existing.comments, compact(row.Comments)].filter(Boolean).join("\n\n");
    }
  }

  const projects = [...projectMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const contacts = [...contactMap.values()]
    .map((contact) => {
      contact.activities.sort((a, b) => b.dateValue.localeCompare(a.dateValue));
      const latest = contact.activities[0]?.dateValue ? new Date(contact.activities[0].dateValue) : null;
      contact.lastActivity = contact.activities[0]?.date ?? "No activity in sheet";
      contact.lastTouchpoint = contact.activities[0]?.note ?? "";
      contact.dueDate = deriveDueDate(contact.step, latest, contact.lifecycle, now);
      contact.campaignStatus = campaignStatus(contact.lifecycle, contact.activities.length > 0);
      contact.summary = `${contact.summary} ${contact.projects.length} project${contact.projects.length === 1 ? " is" : "s are"} bundled on this contact record.`;
      return contact;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    contacts,
    projects,
    sourceUrl: sourceSheetUrl,
    sourceTab: "Sample Projects",
    syncedAt: now.toISOString(),
  };
}
