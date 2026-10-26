import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./polish.css";

export const metadata: Metadata = {
  title: "Tesorio · Sistema de Gestión y Facturación Fiscal SENIAT",
  description: "Plataforma administrativa y contable para empresas venezolanas. Facturación digital conforme a la Providencia 0071 / PA 102, inventario, servicio DTF y libros auditables.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}