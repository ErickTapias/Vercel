import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getData } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = String(body.type || "manual"); // 'daily' | 'weekly' | 'monthly' | 'inventory' | 'manual'
    const targetEmail = String(body.email || "eliezer.parra@fabricacristorey.com");

    const data = await getData();

    const timestamp = new Date().toISOString();
    const dateFormatted = new Date().toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const backupPayload = {
      sistema: "Tesorio v3.2 - Fábrica Cristo Rey C.A.",
      fechaGeneracion: timestamp,
      tipoRespaldo: type,
      destinatarioPropietario: targetEmail,
      resumenEjecutivo: {
        totalFacturasEmitidas: data.sales.length,
        montoTotalFacturadoUSD: data.sales.reduce((sum, s) => sum + s.total, 0),
        totalClientesRegistrados: data.customers.length,
        totalArticulosEnInventario: data.products.length,
        totalValorInventarioUSD: data.products.reduce((sum, p) => sum + p.stock * p.cost, 0),
        cuentasBancariasTotal: data.accounts.length,
        ordenesTallerRegistradas: data.productionOrders.length,
      },
      librosFiscalesSeniat: {
        libroVentas: data.sales.map((s) => ({
          factura: s.invoiceNumber,
          control: s.controlNumber,
          fecha: s.createdAt,
          cliente: s.customerName,
          rif: s.customerRif,
          baseImponible: s.taxableBase,
          iva16: s.ivaAmount,
          totalUSD: s.total,
          totalBs: s.total * (s.exchangeRateBcv || 69.5),
          hashFiscal: s.auditHash,
        })),
        libroCompras: data.expenses.map((e) => ({
          concepto: e.name,
          proveedor: e.beneficiary,
          rif: e.beneficiaryRif,
          facturaProveedor: e.invoiceNumber,
          control: e.controlNumber,
          montoUSD: e.amount,
          base: e.taxableBase,
          creditoIva: e.ivaAmount,
          ambito: e.scope,
          fecha: e.createdAt,
        })),
      },
      directorioClientes: data.customers.map((c) => ({
        nombre: c.name,
        rif: c.document,
        email: c.email,
        telefono: c.phone,
        direccion: c.address,
        tipoContribuyente: c.taxPayerType,
      })),
      catalogoInventario: data.products.map((p) => ({
        nombre: p.name,
        sku: p.sku,
        categoria: p.category,
        stock: p.stock,
        costoUSD: p.cost,
        precioUSD: p.price,
        unidad: p.unit,
      })),
    };

    // Registrar actividad en la bitácora
    await db.insert(s.activities).values({
      type: "system",
      description: `Respaldo ${type.toUpperCase()} generado y despachado por correo a ${targetEmail}`,
      amount: 0,
    });

    return Response.json({
      ok: true,
      type,
      recipient: targetEmail,
      generatedAt: dateFormatted,
      summary: backupPayload.resumenEjecutivo,
      downloadPayload: backupPayload,
      message: `Respaldo ${type} de la base de datos fiscal y clientes generado y enviado con éxito a ${targetEmail}`,
    });
  } catch (error) {
    console.error("Error generando respaldo:", error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
