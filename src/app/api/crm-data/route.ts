import { getCrmData } from "@/lib/sheet-data";
import { hasHempWoodAccess } from "@/lib/access";
import { auth, currentUser } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasHempWoodAccess(await currentUser())) return Response.json({ error: "Forbidden" }, { status: 403 });
    await connection();
    return Response.json(await getCrmData());
  } catch (error) {
    unstable_rethrow(error);
    console.error("Unable to sync the client-facing project sheet", error);
    return Response.json(
      { error: "The client-facing sheet could not be loaded." },
      { status: 502 },
    );
  }
}
