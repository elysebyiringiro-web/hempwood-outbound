type AccessUser = {
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: Array<{ emailAddress: string }>;
};

export const approvedTeamEmails = [
  "gwilson@hempwood.com",
  "elyse.byiringiro@thinkananta.com",
  "jrobbins@hempwood.com",
  "office@hempwood.com",
  "will@fantasticvoyage.tv",
  "shourya@thinkananta.com",
  "amol@thinkananta.com",
] as const;

const approvedTeamEmailSet = new Set<string>(approvedTeamEmails);
const adminEmailSet = new Set<string>(["elyse.byiringiro@thinkananta.com"]);

export function primaryEmail(user: AccessUser | null | undefined) {
  return user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";
}

export function isAdminEmail(email: string) {
  return adminEmailSet.has(email.trim().toLowerCase());
}

export function hasHempWoodAccess(user: AccessUser | null | undefined) {
  return approvedTeamEmailSet.has(primaryEmail(user).trim().toLowerCase());
}
