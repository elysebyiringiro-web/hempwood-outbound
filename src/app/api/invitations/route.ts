import { approvedTeamEmails, hasHempWoodAccess, isAdminEmail, primaryEmail } from "@/lib/access";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  if (!hasHempWoodAccess(user) || !isAdminEmail(primaryEmail(user))) return null;
  return user;
}

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = await clerkClient();
  const invitations = await client.invitations.getInvitationList({ limit: 50, orderBy: "-created_at" });
  return Response.json({ invitations: invitations.data.map((invitation) => ({ id: invitation.id, email: invitation.emailAddress, status: invitation.status, createdAt: invitation.createdAt })) });
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as { email?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!approvedTeamEmails.includes(email as typeof approvedTeamEmails[number])) {
    return Response.json({ error: "This email is not on the approved team list." }, { status: 400 });
  }
  try {
    const client = await clerkClient();
    const invitation = await client.invitations.createInvitation({
      emailAddress: email,
      notify: true,
      expiresInDays: 30,
      redirectUrl: new URL("/sign-up", request.url).toString(),
    });
    return Response.json({ invitation: { id: invitation.id, email: invitation.emailAddress, status: invitation.status, createdAt: invitation.createdAt } }, { status: 201 });
  } catch (error) {
    console.error("Unable to create Clerk invitation", error);
    return Response.json({ error: "That email may already be invited or registered." }, { status: 409 });
  }
}
