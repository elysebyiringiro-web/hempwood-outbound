import { currentUser } from "@clerk/nextjs/server";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { z } from "zod";
import { hasHempWoodAccess, primaryEmail } from "@/lib/access";
import { contactTypes, lifecycleStages } from "@/lib/crm-data";
import { applyBatch, emptyWorkspace, snapshot, type Journal } from "@/lib/workspace";

const path = "crm/workspace-v1.json";
const id = "[a-z0-9-]{1,80}";
const progress = z.object({
  step: z.number().int().min(0).max(6), lifecycle: z.enum(lifecycleStages),
  campaignStatus: z.string(), dueDate: z.string(), lastActivity: z.string(), lastTouchpoint: z.string(),
});
const activity = z.object({
  id: z.string(), type: z.enum(["email","call","linkedin","sample","handover","research"]),
  title: z.string(), note: z.string(), date: z.string(), dateValue: z.string(), projectId: z.string(),
});
const version = z.number().int().nonnegative().optional();
const change = z.union([
  z.object({ key: z.string().regex(new RegExp("^(notes|owner|project)/" + id + "$|^sequence/[0-6]$")), value: z.string(), version }),
  z.object({ key: z.string().regex(new RegExp("^type/" + id + "$")), value: z.enum(contactTypes), version }),
  z.object({ key: z.string().regex(new RegExp("^progress/" + id + "$")), value: progress, version }),
  z.object({ key: z.string().regex(new RegExp("^activity/" + id + "/[a-zA-Z0-9-]+$")), value: activity, version }),
]);
const schema = z.object({ id: z.string().regex(/^[a-f0-9-]{32,64}$/), importing: z.boolean(), changes: z.array(change).min(1) });
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function read() {
  const result = await get(path, { access: "private", useCache: false });
  if (!result) return { doc: { ...emptyWorkspace(), history: [] } as Journal, etag: undefined };
  if (!result.stream) throw new Error("Missing workspace content");
  return { doc: await new Response(result.stream).json() as Journal, etag: result.blob.etag };
}
export async function GET() {
  if (!hasHempWoodAccess(await currentUser())) return json({ error: "Access denied" }, 403);
  const { doc } = await read();
  return json(snapshot(doc));
}
export async function POST(request: Request) {
  const user = await currentUser();
  if (!hasHempWoodAccess(user)) return json({ error: "Access denied" }, 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "This edit could not be validated. Browser data has been kept." }, 400);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { doc, etag } = await read();
    const result = applyBatch(doc, parsed.data, primaryEmail(user), new Date().toISOString());
    if (result === "conflict") return json({ error: "Another teammate edited this field. Review the latest version before saving again." }, 409);
    if (result === "applied") {
      try {
        await put(path, JSON.stringify(doc), { access: "private", addRandomSuffix: false, ifMatch: etag, contentType: "application/json" });
      } catch (error) {
        if (error instanceof BlobPreconditionFailedError || (!etag && (await read()).etag)) continue;
        throw error;
      }
    }
    return json(snapshot(doc));
  }
  return json({ error: "Workspace is busy. Please retry." }, 503);
}
