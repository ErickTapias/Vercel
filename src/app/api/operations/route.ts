import { NextRequest } from "next/server";
import { ContingencyAndPaymentsController } from "@/modules/operations/ContingencyAndPaymentsController";

export const dynamic = "force-dynamic";

/**
 * RUTA API NUEVA E INDEPENDIENTE (/api/operations).
 * No interfiere con las rutas de facturación, nómina o conciliación existentes.
 * Expone únicamente operaciones de contingencia y conciliación de pagos flexibles.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const controller = new ContingencyAndPaymentsController();
    const result = await controller.handle(String(body.action || ""), body.data || {}, String(body.actor || "Sistema"));
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}

export async function GET() {
  return Response.json({ ok: true, module: "operations", endpoints: ["invoice.search", "reconciliation.summary", "payment.add", "payment.update", "payment.delete", "audit.list", "contingency.list", "contingency.create", "contingency.sync", "legal.references", "compliance.logs"] });
}
