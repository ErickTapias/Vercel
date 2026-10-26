# Fina · Tu negocio, en orden

Aplicación administrativa de demostración en español, inspirada en la web pública y las demostraciones de Fina. Implementada con Next.js App Router, React, PostgreSQL y Drizzle ORM.

## Funciones conectadas

- Dashboard con ingresos, gastos, utilidad, saldos y productos más vendidos, calculados desde los movimientos guardados.
- Inventario de productos, variaciones, ubicación, stock de seguridad, recetas e ingredientes y servicios.
- Importación Excel/CSV con vista previa, plantilla y actualización por SKU. Exportación Excel.
- Punto de venta con carrito, canales de precio, cliente opcional, cargos extra, pagos divididos, cálculo de vuelto y ventas a crédito.
- Ventas atómicas: validación y descuento de stock, consumo de ingredientes, actualización de cuentas, registro de comisiones y cuentas por cobrar.
- Recibos, cotizaciones y reportes imprimibles; el diálogo de impresión permite guardar como PDF.
- Cuentas USD/VES, tasa de cambio manual, transferencias, movimientos, gastos fijos y variables, cuentas pendientes y cobros/pagos.
- Mesas con pedidos guardados y registro de apertura/cierre de caja.
- Clientes, historial, ticket promedio, segmentos y borradores de campañas con destinatarios exportables.
- Estadísticas, estado de resultados, capital estimado, configuración y registro de perfiles/permisos del equipo.
- Navegación adaptable, búsqueda global, notificaciones de stock y vencimientos, y guías contextuales.

## Alcance del entorno de demostración

Es un espacio de trabajo compartido con datos de ejemplo persistentes. No incluye autenticación, aislamiento entre empresas ni autorización de usuarios. Los permisos del equipo se almacenan como configuración, pero no crean cuentas ni credenciales de acceso. No debe publicarse con información real sin implementar esas capas.

Las campañas se guardan como borradores; no se simula el envío de SMS. No se conectan bancos, servicios de correo o proveedores de mensajería. Los saldos se llevan mediante registros administrativos y no sincronizan con una entidad bancaria. La tasa de cambio es manual. Los recibos no son facturas fiscales.

Los reportes de inventario indican existencias actuales y ventas del período; no reconstruyen un stock histórico. Los pedidos de mesas no reservan ni descuentan existencias hasta confirmar la venta.

## Datos y ejecución

La conexión utiliza `DATABASE_URL`. Las tablas se definen en `src/db/schema.ts`; los datos iniciales se crean una sola vez, bajo un bloqueo transaccional. Las operaciones de negocio están en `/api/manage` y los datos del espacio en `/api/data`.

Para validar: generar tipos de Next, ejecutar TypeScript sin emisión y compilar con el script `build`. Para probar un servidor ya iniciado, ejecutar `node tests/smoke.cjs`. El destino predeterminado es `http://localhost:3000`; se puede cambiar con `BASE_URL`.

Las pruebas de navegador necesitan Chromium de Playwright y sus dependencias de sistema. El smoke test crea movimientos de demostración: un producto, una venta con dos métodos de pago, un gasto, una importación, una venta de receta y una venta a crédito con su cobro. Los archivos generados se guardan en `artifacts/`.


## Módulo de Gestión de Nómina y Recibos de Pago (integración no destructiva)

Implementado como extensión independiente: **ninguna tabla existente fue alterada** y la lógica de facturación no se modificó.

### FASE 1 · Base de datos (solo tablas nuevas)
- `tesorio_payroll_config` — parámetros legales configurables (UT, salario mínimo, IVSS 4% con tope de 5 salarios mínimos, FAOV 1%, INCES 0,5%, cestaticket, provisiones, tramos de ISLR Art. 143 y cargas patronales informativas).
- `tesorio_employees` — empleado, fecha de ingreso, cargo, tipo de salario (mensual, quincenal, por hora o por pieza) y régimen de seguridad social. Relación opcional mediante `company_id`.
- `tesorio_payroll_periods` — períodos de pago y fechas de corte.
- `tesorio_payroll_transactions` — detalle de asignaciones, deducciones, provisiones, bruto, deducciones totales y neto.
- `tesorio_payroll_receipts` — log de recibos con hash de integridad SHA-256, copia del recibo, ruta de respaldo y registro de envío por correo.

### FASE 2 · Motor de cálculo
`src/lib/payroll-calculator.ts` expone la clase independiente `PayrollCalculatorService.calculate(empleado, periodo, extras)`.
- Asignaciones: salario base (por hora/pieza si corresponde), horas extras con recargo del 50% (LOTTT Art. 87), bonificación y cestaticket.
- Deducciones del trabajador: IVSS 4% (tope de 5 salarios mínimos, Ley del Seguro Social Art. 27), FAOV 1%, INCES 0,5% y retención de ISLR según Art. 143 de la LISLR (escalera en Unidades Tributarias).
- Provisiones patronales: prestaciones (2,5 días/mes, LOTTT Art. 142), vacacional (15 días/año), antigüedad después de 3 años (LOTTT Art. 148) o régimen de fondo.
- Respuesta en JSON aislado, sin acceso a tablas ajenas.

### FASE 3 · Recibos y automatización
- `buildPayrollReceiptHtml()` genera el recibo en tamaño carta con datos de empresa y empleado, asignaciones, deducciones, provisiones, neto en Bs. con equivalencia referencial en divisas, espacios de firma y notas legales.
- Evento `payroll.markPaid`: sólo al cambiar la transacción a **Pagado** se registra el envío del recibo por correo al empleado, se guarda la copia del recibo en `public/backups/nomina/<recibo>.html` como respaldo de la empresa y se marca la fecha/hora de envío en `tesorio_payroll_receipts`.
- Hash SHA-256 de integridad por recibo para trazabilidad de auditoría.

### FASE 4 · Interfaz
- Módulo **Gestión de Nómina y Recibos** en el menú lateral (oculto para los operarios de máquina).
- Pestañas: empleados (alta/edición, procesar nómina), nómina procesada (vista previa del recibo) y recibos/respaldos (impresión y descarga PDF).
- Estilos encapsulados bajo el contenedor `.payroll-scope` con prefijo `.payroll-`, por lo que no compiten con los estilos actuales del sistema.

### FASE 5 · Guía de integración segura
1. Tablas nuevas: `npm run schema:db` no es necesario; las tablas se crean con el SQL de `src/db/schema.ts` + `psql` (ver notas de despliegue) sin tocar tablas existentes.
2. Ruta API independiente: `POST /api/payroll` con acciones `employee.save`, `employee.remove`, `period.save`, `payroll.preview`, `payroll.process`, `payroll.markPaid` y `payroll.update`.
3. Hook de pago: la única acción que dispara correo y respaldo es `payroll.markPaid`; no interfiere con ventas, inventario ni facturación.
4. UI: componente autocontenido `src/components/payroll-panel.tsx` montado únicamente en el módulo `nomina`.
5. Tipos: extensiones en `src/lib/types.ts` (agregados), sin cambios destructivos en tipos previos.
6. Configuración legal editable en `tesorio_payroll_config` (UT, tramos ISLR, cestaticket, provisiones), recomendable revisarla con el contador de la empresa ante cambios de ley.


## Módulos de Contingencia, Conciliación de Pagos y Trazabilidad Legal (extensión no destructiva)

Implementados bajo restricción crítica: **no se modificó ninguna tabla, ruta, controlador, lógica fiscal/laboral ni CSS existente**.
Principio aplicado: **datos fiscales inmutables** (montos, IVA, RIF, N° de control, fechas de emisión) frente a **datos operativos flexibles** (referencias de Pago Móvil, fechas de cobro, conciliación) auditados por separado.

### FASE 1 · Tablas nuevas (SQL independiente)
Creadas en `src/db/schema-operations.ts` y aplicadas sin tocar tablas previas:
- `tesorio_legal_references` (módulo, ley, artículo, descripción, vigencia).
- `tesorio_contingency_invoices` (número manual, fecha, cliente, montos, estado de sincronización, código de autorización).
- `tesorio_compliance_logs` (acción, referencia, ley aplicada, actor, detalles y hash SHA-256).
- `tesorio_invoice_payments` (factura, método, referencia de pago, banco, monto, fecha, estado) — tabla flexible de conciliación.
- `tesorio_payment_audit_logs` (pago, campo, valor anterior/posterior, responsable, motivo y fecha).
Las referencias sembradas citan **Providencia SNAT/2026/00093 Art. 7 y 15**, **Providencia SNAT/2015/0049 Art. 3**, principios de control interno y **Código de Comercio Art. 38**.

### FASE 2 · Módulo de contingencia y pagos (`src/modules/operations/`)
- `ContingencyAndPaymentsController.ts`: expone `invoice.search`, `reconciliation.summary`, `payment.add/update/delete`, `audit.list`, `contingency.list/create/sync`, `legal.references`, `compliance.logs`.
- `PaymentReconciliationService.ts`: búsqueda de facturas en **solo lectura**, alta/edición/baja de referencias de pago con auditoría automática, resumen de conciliación (aplicado vs. saldo pendiente) y sincronización de contingencias con la imprenta digital homologada.

### FASE 3 · Trazabilidad legal (`src/modules/compliance/`)
- `LegalReferenceService.getReference(module, action)` devuelve la ley/artículo aplicable.
- `LegalReferenceService.logFiscalCompliance(action, reference)` registra la acción fiscal con hash SHA-256 en `compliance_logs` (solo acciones inmutables citan ley; los cambios de pago operativo quedan en `payment_audit_logs` sin cita fiscal).

### FASE 4 · Event Listeners nuevos
- `InvoiceCreatedListener` → trazabilidad legal de facturas digitales (Art. 7) y de contingencia (Art. 15).
- `PaymentUpdatedListener` → auditoría de cambios en referencias de pago (valor anterior y posterior).
Ningún listener existente fue modificado.

### FASE 5 · UI aislada y rutas nuevas
- Panel `src/components/payment-conciliation-panel.tsx` con namespace BEM propio `.operations-panel__*`.
- CSS exclusivo `src/app/operations/operations-panel.css`, importado únicamente en el layout de `/operations`.
- Rutas nuevas: **`/operations`**, **`/operations/conciliation`** y **`/operations/contingency`** (las rutas existentes no fueron alteradas).

### FASE 6 · Guía de integración paso a paso
1. **Carpetas nuevas**: `src/db/schema-operations.ts`, `src/modules/operations/`, `src/modules/compliance/` (con `listeners/`) y `src/app/operations/`. Ninguna carpeta existente fue editada.
2. **Registro de rutas**: las páginas de `/operations/*` se registran por convención de archivos de Next.js; la API propia queda en `src/app/api/operations/route.ts`. Las rutas previas siguen intactas.
3. **Listeners**: se registran como instancias propias dentro de los servicios nuevos; no interceptan eventos existentes.
4. **Migraciones**: las tablas se crean con SQL independiente (ver FASE 1); no se ejecutan migraciones sobre tablas existentes.
5. **Acceso en producción**: abrir `/operations/conciliation` y `/operations/contingency` desde el navegador o enlazarlos desde tu portal interno sin tocar el dashboard actual.
