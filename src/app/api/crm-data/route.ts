import { getCrmData } from "@/lib/sheet-data";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";

export async function GET() {
  try {
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
