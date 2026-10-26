import type { Sale, Settings } from "./types";

export type SeniatInvoicePayload = {
  documentType: "FACTURA";
  invoiceNumber: string;
  controlNumber: string;
  issueDate: string; // DDMMAAAA
  issueTime: string; // HH:MM:SS
  exchangeRateBcv: number;
  emitter: {
    businessName: string;
    legalName: string;
    rif: string;
    address: string;
    phone: string;
    email: string;
  };
  client: {
    name: string;
    rif: string; // V-..., J-..., E-..., G-...
    address: string;
    email: string;
  };
  items: Array<{
    line: number;
    description: string;
    quantity: number;
    unitPriceUsd: number;
    totalPriceUsd: number;
    totalPriceBs: number;
    isExempt: boolean;
    exemptIndicator: "(E)" | "";
  }>;
  taxSummary: {
    taxableBaseUsd: number;
    taxableBaseBs: number;
    exemptAmountUsd: number;
    exemptAmountBs: number;
    ivaRate: number; // 16
    ivaAmountUsd: number;
    ivaAmountBs: number;
    igtfRate: number; // 3
    igtfAmountUsd: number;
    igtfAmountBs: number;
    totalUsd: number;
    totalBs: number;
  };
  payments: Array<{
    method: string;
    bankName: string;
    reference: string;
    amountUsd: number;
    amountBs: number;
  }>;
  legalFooter: {
    resolution: string;
    printerProv: string;
    printerRif: string;
    auditHash: string;
    qrUrl: string;
  };
};

export function buildSeniatPayload(sale: Sale, settings: Settings): SeniatInvoicePayload {
  const dateObj = new Date(sale.createdAt);
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = String(dateObj.getFullYear());
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const seconds = String(dateObj.getSeconds()).padStart(2, "0");

  const issueDate = `${day}/${month}/${year}`;
  const issueTime = `${hours}:${minutes}:${seconds}`;

  const rate = sale.exchangeRateBcv || settings.exchangeRate || 69.5;

  const items = sale.items.map((i, idx) => {
    const isEx = Boolean(i.isExempt);
    const totalUsd = i.price * i.quantity;
    return {
      line: idx + 1,
      description: i.name,
      quantity: i.quantity,
      unitPriceUsd: i.price,
      totalPriceUsd: totalUsd,
      totalPriceBs: totalUsd * rate,
      isExempt: isEx,
      exemptIndicator: isEx ? ("(E)" as const) : ("" as const),
    };
  });

  const qrUrl = `https://seniat.gob.ve/consulta/factura?rif=${encodeURIComponent(
    settings.rif
  )}&factura=${encodeURIComponent(sale.invoiceNumber)}&control=${encodeURIComponent(
    sale.controlNumber
  )}&fecha=${day}${month}${year}&monto=${sale.total.toFixed(2)}`;

  return {
    documentType: "FACTURA",
    invoiceNumber: sale.invoiceNumber,
    controlNumber: sale.controlNumber,
    issueDate,
    issueTime,
    exchangeRateBcv: rate,
    emitter: {
      businessName: settings.businessName,
      legalName: settings.legalName,
      rif: settings.rif,
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
    },
    client: {
      name: sale.customerName,
      rif: sale.customerRif,
      address: sale.customerAddress,
      email: sale.customerEmail,
    },
    items,
    taxSummary: {
      taxableBaseUsd: sale.taxableBase,
      taxableBaseBs: sale.taxableBase * rate,
      exemptAmountUsd: sale.exemptAmount,
      exemptAmountBs: sale.exemptAmount * rate,
      ivaRate: sale.ivaRate,
      ivaAmountUsd: sale.ivaAmount,
      ivaAmountBs: sale.ivaAmount * rate,
      igtfRate: sale.igtfRate,
      igtfAmountUsd: sale.igtfAmount,
      igtfAmountBs: sale.igtfAmount * rate,
      totalUsd: sale.total,
      totalBs: sale.total * rate,
    },
    payments: (sale.payments || []).map((p) => ({
      method: p.paymentType || "Transferencia / Pago móvil",
      bankName: p.bankName || "Banco Nacional",
      reference: p.reference || "N/A",
      amountUsd: p.amount,
      amountBs: p.amount * rate,
    })),
    legalFooter: {
      resolution: settings.seniatResolution,
      printerProv: settings.printerAuthorization,
      printerRif: settings.digitalPrinterRif || "J-00034567-8",
      auditHash: sale.auditHash || `SENIAT-${sale.invoiceNumber}-${sale.controlNumber}`,
      qrUrl,
    },
  };
}

export function generateSeniatInvoiceHtml(payload: SeniatInvoicePayload, logoUrl?: string): string {
  const escape = (val: unknown) =>
    String(val ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

  const rowsHtml = payload.items
    .map(
      (it) => `
    <tr>
      <td style="text-align: center; width: 40px; font-weight: 600;">${it.line}</td>
      <td>
        <strong>${escape(it.description)}</strong>
        ${it.isExempt ? '<span class="exempt-tag">(E) EXENTO</span>' : ""}
      </td>
      <td style="text-align: center; width: 60px;">${it.quantity}</td>
      <td style="text-align: right; width: 90px;">$ ${it.unitPriceUsd.toFixed(2)}</td>
      <td style="text-align: right; width: 100px; font-weight: 600;">$ ${it.totalPriceUsd.toFixed(2)}</td>
      <td style="text-align: right; width: 130px; font-family: monospace;">Bs. ${it.totalPriceBs.toLocaleString("es-VE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}</td>
    </tr>`
    )
    .join("");

  const paymentsHtml = payload.payments
    .map(
      (p) => `
    <div class="pay-row">
      <span>• <strong>${escape(p.method)}</strong> (${escape(p.bankName)}) - Ref: <span class="mono">${escape(p.reference)}</span></span>
      <span class="mono">$ ${p.amountUsd.toFixed(2)} / Bs. ${p.amountBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
    </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>FACTURA ${escape(payload.invoiceNumber)} - ${escape(payload.emitter.legalName)}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 12mm 15mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10.5px;
      line-height: 1.4;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .invoice-container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
    }
    
    /* ENCABEZADO FISCAL CON BORDES OFICIALES */
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1e1b4b;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .company-block {
      display: flex;
      align-items: center;
      gap: 14px;
      max-width: 58%;
    }
    .company-logo {
      max-height: 58px;
      max-width: 160px;
      object-fit: contain;
    }
    .company-details h1 {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 2px;
      text-transform: uppercase;
      letter-spacing: -0.2px;
    }
    .rif-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      color: #581c87;
      font-family: monospace;
      margin-bottom: 3px;
    }
    .company-address {
      font-size: 9px;
      color: #475569;
      line-height: 1.35;
      margin: 0;
    }

    /* RECUADRO FISCAL SENIAT DEL NRO DE FACTURA */
    .fiscal-meta-box {
      border: 2px solid #581c87;
      border-radius: 8px;
      background: #faf5ff;
      padding: 8px 14px;
      text-align: center;
      min-width: 220px;
    }
    .fiscal-meta-box .doc-type {
      font-size: 14px;
      font-weight: 900;
      color: #581c87;
      letter-spacing: 2px;
      text-transform: uppercase;
      border-bottom: 1px dashed #d8b4fe;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .fiscal-meta-box .num-row {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      padding: 1px 0;
    }
    .fiscal-meta-box .num-row strong {
      font-family: monospace;
      font-size: 11px;
    }

    /* DATOS DEL COMPRADOR Y CONDICIONES */
    .client-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #f8fafc;
      padding: 8px 12px;
      margin-bottom: 14px;
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 12px;
    }
    .client-col h3 {
      font-size: 9px;
      text-transform: uppercase;
      color: #64748b;
      margin: 0 0 4px;
      letter-spacing: 0.8px;
    }
    .client-col strong {
      font-size: 12px;
      color: #0f172a;
      display: block;
      margin-bottom: 2px;
    }
    .client-col p {
      margin: 0;
      font-size: 9.5px;
      color: #334155;
    }
    .bcv-box {
      border-left: 1px solid #e2e8f0;
      padding-left: 12px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .bcv-box .rate-val {
      font-size: 12px;
      font-weight: 800;
      color: #065f46;
      font-family: monospace;
    }

    /* TABLA DE RENGLONES FACTURADOS */
    table.invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 9.5px;
    }
    table.invoice-table th {
      background: #1e1b4b;
      color: #ffffff;
      padding: 6px 8px;
      text-align: left;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8.5px;
      letter-spacing: 0.5px;
      border: 1px solid #1e1b4b;
    }
    table.invoice-table td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    table.invoice-table tr:nth-child(even) td {
      background: #fcfdfe;
    }
    .exempt-tag {
      font-size: 8px;
      background: #fef3c7;
      color: #92400e;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 700;
      margin-left: 6px;
    }

    /* SECCIÓN INFERIOR: TOTALES + QR + LIQUIDACIÓN */
    .bottom-section {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 16px;
      margin-bottom: 14px;
      align-items: start;
    }

    .payments-and-qr {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      background: #f8fafc;
    }
    .payments-and-qr h4 {
      font-size: 9px;
      text-transform: uppercase;
      color: #64748b;
      margin: 0 0 6px;
      letter-spacing: 0.6px;
    }
    .pay-row {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      padding: 2px 0;
      border-bottom: 1px dashed #e2e8f0;
    }
    .mono { font-family: monospace; }

    .qr-container {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
    }
    .qr-code-box {
      width: 68px;
      height: 68px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-code-box img {
      width: 100%;
      height: 100%;
    }
    .qr-text {
      font-size: 8px;
      color: #475569;
      line-height: 1.3;
    }

    /* TABLA RESUMEN DE IMPUESTOS SENIAT */
    .totals-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
    }
    .totals-table td {
      padding: 4px 8px;
      border: 1px solid #e2e8f0;
    }
    .totals-table tr.total-row td {
      background: #1e1b4b;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      padding: 6px 8px;
    }
    .totals-table tr.total-row strong {
      font-size: 13px;
    }

    /* PIE LEGAL OBLIGATORIO SENIAT */
    .legal-footer {
      border-top: 2px solid #581c87;
      padding-top: 8px;
      font-size: 8px;
      color: #64748b;
      text-align: center;
      line-height: 1.45;
    }
    .legal-footer strong {
      color: #1e1b4b;
    }
    .audit-stamp {
      font-family: monospace;
      font-size: 7.5px;
      color: #7c3aed;
      margin-top: 2px;
    }

    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- ENCABEZADO FISCAL -->
    <div class="top-header">
      <div class="company-block">
        ${
          logoUrl
            ? `<img src="${escape(logoUrl)}" alt="Logo" class="company-logo" />`
            : `<div style="font-size: 26px; font-weight: 900; font-style: italic; color: #581c87;">tesorio<span style="color:#10b981;">.</span></div>`
        }
        <div class="company-details">
          <h1>${escape(payload.emitter.legalName)}</h1>
          <div class="rif-badge">RIF: ${escape(payload.emitter.rif)}</div>
          <p class="company-address">${escape(payload.emitter.address)}</p>
          <p class="company-address">Telf: ${escape(payload.emitter.phone)} | Email: ${escape(payload.emitter.email)}</p>
        </div>
      </div>

      <div class="fiscal-meta-box">
        <div class="doc-type">${escape(payload.documentType)}</div>
        <div class="num-row">
          <span>N° DE FACTURA:</span>
          <strong>${escape(payload.invoiceNumber)}</strong>
        </div>
        <div class="num-row">
          <span>N° DE CONTROL:</span>
          <strong>${escape(payload.controlNumber)}</strong>
        </div>
        <div class="num-row">
          <span>FECHA DE EMISIÓN:</span>
          <span class="mono">${escape(payload.issueDate)}</span>
        </div>
        <div class="num-row">
          <span>HORA DE EMISIÓN:</span>
          <span class="mono">${escape(payload.issueTime)}</span>
        </div>
      </div>
    </div>

    <!-- DATOS DEL CLIENTE / RECEPTOR -->
    <div class="client-card">
      <div class="client-col">
        <h3>ADQUIRENTE / RECEPTOR DE LA FACTURA</h3>
        <strong>${escape(payload.client.name)}</strong>
        <p><strong>RIF / C.I.:</strong> <span class="mono" style="font-weight:700; color:#581c87;">${escape(payload.client.rif)}</span></p>
        <p><strong>Domicilio Fiscal:</strong> ${escape(payload.client.address || "Caracas, Venezuela")}</p>
        <p><strong>Correo Electrónico:</strong> ${escape(payload.client.email || "No especificado")}</p>
      </div>
      <div class="bcv-box">
        <span style="font-size: 8px; color: #64748b; text-transform: uppercase;">Tasa Oficial BCV del Día:</span>
        <div class="rate-val">Bs. ${payload.exchangeRateBcv.toLocaleString("es-VE", { minimumFractionDigits: 2 })} / USD</div>
        <span style="font-size: 8px; color: #64748b; margin-top: 4px;">Condición de Venta: CONTADO / PAGADA</span>
      </div>
    </div>

    <!-- DETALLE DE RENGLONES -->
    <table class="invoice-table">
      <thead>
        <tr>
          <th style="text-align: center;">Item</th>
          <th>Descripción del Bien o Servicio</th>
          <th style="text-align: center;">Cant.</th>
          <th style="text-align: right;">Precio ($)</th>
          <th style="text-align: right;">Total ($)</th>
          <th style="text-align: right;">Total Bs. (BCV)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- TOTALES Y LIQUIDACIÓN SENIAT -->
    <div class="bottom-section">
      <div class="payments-and-qr">
        <h4>Formas de Pago y Conciliación Bancaria</h4>
        ${paymentsHtml}

        <div class="qr-container">
          <div class="qr-code-box">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
              payload.legalFooter.qrUrl
            )}" alt="QR SENIAT" />
          </div>
          <div class="qr-text">
            <strong>DOCUMENTO FISCAL ELECTRÓNICO</strong><br />
            Escanea este código QR con el visor del SENIAT para comprobar autenticidad y número de control en línea.
          </div>
        </div>
      </div>

      <div>
        <table class="totals-table">
          <tbody>
            <tr>
              <td><strong>Base Imponible Gravable:</strong></td>
              <td style="text-align: right;" class="mono">$ ${payload.taxSummary.taxableBaseUsd.toFixed(2)}</td>
              <td style="text-align: right; color:#64748b;" class="mono">Bs. ${payload.taxSummary.taxableBaseBs.toLocaleString("es-VE", {
                minimumFractionDigits: 2,
              })}</td>
            </tr>
            <tr>
              <td><strong>IVA (${payload.taxSummary.ivaRate}% Prov. 0071):</strong></td>
              <td style="text-align: right; color:#581c87;" class="mono"><strong>$ ${payload.taxSummary.ivaAmountUsd.toFixed(2)}</strong></td>
              <td style="text-align: right; color:#581c87;" class="mono">Bs. ${payload.taxSummary.ivaAmountBs.toLocaleString("es-VE", {
                minimumFractionDigits: 2,
              })}</td>
            </tr>
            ${
              payload.taxSummary.exemptAmountUsd > 0
                ? `<tr>
                    <td>Monto Exento / Exonerado (E):</td>
                    <td style="text-align: right;" class="mono">$ ${payload.taxSummary.exemptAmountUsd.toFixed(2)}</td>
                    <td style="text-align: right; color:#64748b;" class="mono">Bs. ${payload.taxSummary.exemptAmountBs.toLocaleString("es-VE", {
                      minimumFractionDigits: 2,
                    })}</td>
                  </tr>`
                : ""
            }
            ${
              payload.taxSummary.igtfAmountUsd > 0
                ? `<tr>
                    <td>IGTF Divisas (${payload.taxSummary.igtfRate}%):</td>
                    <td style="text-align: right; color:#b45309;" class="mono">$ ${payload.taxSummary.igtfAmountUsd.toFixed(2)}</td>
                    <td style="text-align: right; color:#b45309;" class="mono">Bs. ${payload.taxSummary.igtfAmountBs.toLocaleString("es-VE", {
                      minimumFractionDigits: 2,
                    })}</td>
                  </tr>`
                : ""
            }
            <tr class="total-row">
              <td>TOTAL FACTURA:</td>
              <td style="text-align: right;" class="mono"><strong>$ ${payload.taxSummary.totalUsd.toFixed(2)}</strong></td>
              <td style="text-align: right; color:#6ee7b7;" class="mono">Bs. ${payload.taxSummary.totalBs.toLocaleString("es-VE", {
                minimumFractionDigits: 2,
              })}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- PIE LEGAL OBLIGATORIO SENIAT PROV. 000102 / 0071 -->
    <div class="legal-footer">
      <div>
        <strong>FACTURA EMITIDA CONFORME A LA PROVIDENCIA ADMINISTRATIVA SENIAT N° SNAT/2024/000102 Y PA SNAT/2011/00071</strong>
      </div>
      <div>
        ${escape(payload.legalFooter.printerProv)} · RIF Imprenta Digital: ${escape(payload.legalFooter.printerRif)}
      </div>
      <div>
        Resolución: ${escape(payload.legalFooter.resolution)}
      </div>
      <div class="audit-stamp">
        Hash Criptográfico de Trazabilidad Auditable: ${escape(payload.legalFooter.auditHash)}
      </div>
    </div>
  </div>

  <script>
    window.onload = () => { setTimeout(() => window.print(), 350); };
  </script>
</body>
</html>`;
}
