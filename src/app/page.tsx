import CrmApp from "./components/crm-app";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { hasHempWoodAccess, isAdminEmail, primaryEmail } from "@/lib/access";

// Authentication is request-bound, so this route intentionally blocks until
// Clerk has resolved the current user's session.
export const instant = false;

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!hasHempWoodAccess(user)) redirect("/not-authorized");
  const email = primaryEmail(user);
  return (
    <CrmApp
      viewerName={user.fullName || user.firstName || email}
      viewerEmail={email}
      canManageAccess={isAdminEmail(email)}
    />
  );
}
