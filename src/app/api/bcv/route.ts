import { fetchBcvRate } from "@/lib/bcv";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sync = url.searchParams.get("sync") === "true";

  const bcvData = await fetchBcvRate();

  if (sync && bcvData.rate > 0) {
    try {
      await db
        .update(s.settings)
        .set({
          exchangeRate: bcvData.rate,
        })
        .where(eq(s.settings.id, 1));
    } catch (e) {
      console.error("Error sincronizando tasa BCV en BD:", e);
    }
  }

  return Response.json({
    ok: true,
    ...bcvData,
  });
}
