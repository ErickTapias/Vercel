"use client";
import { PaymentConciliationPanel } from "@/components/payment-conciliation-panel";

/** RUTA NUEVA · /operations/contingency (facturación por contingencia SENIAT). */
export default function ContingencyPage() {
  return <PaymentConciliationPanel mode="contingency" />;
}
