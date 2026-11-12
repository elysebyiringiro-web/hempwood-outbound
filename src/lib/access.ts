type AccessUser = {
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: Array<{ emailAddress: string }>;
  publicMetadata?: Record<string, unknown>;
};

export function primaryEmail(user: AccessUser | null | undefined) {
  return user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";
}

export function isAdminEmail(email: string) {
  const admins = (process.env.HEMPWOOD_ADMIN_EMAILS ?? "")
    .split(/[;,\n]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}

export function hasHempWoodAccess(user: AccessUser | null | undefined) {
  const email = primaryEmail(user);
  return isAdminEmail(email) || user?.publicMetadata?.hempwoodAccess === true;
}
