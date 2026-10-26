import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./polish.css";

export const metadata: Metadata = {
  title: "Tesorio · Sistema de Gestión",
  description: "Sistema administrativo",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}