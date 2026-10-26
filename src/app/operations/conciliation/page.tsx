"use client";
import { PaymentConciliationPanel } from "@/components/payment-conciliation-panel";

/** RUTA NUEVA · /operations/conciliation (conciliación de pagos operativos). */
export default function ConciliationPage() {
  return <PaymentConciliationPanel mode="conciliation" />;
}
