"use client";
import { createContext, useContext } from "react";
import type { AppData, Module, CartItem } from "@/lib/types";

export type Period = "today" | "week" | "month" | "all" | "custom";
export type DialogState = { type: string; entity?: unknown } | null;
export type MutationResult = { ok: boolean; sale?: AppData["sales"][number]; count?: number };

export type AppUser = {
  id?: string;
  name: string;
  email: string;
  role: string;
  title?: string;
  branchName?: string;
  stationAccess?: "all" | "plotter_dtf" | "bordadora" | "none" | string;
  allowedModules?: string[];
};

export type AppContextType = {
  data: AppData;
  module: Module;
  navigate: (module: Module, tab?: string) => void;
  tab: string;
  setTab: (tab: string) => void;
  period: Period;
  setPeriod: (period: Period) => void;
  customDates: { start: string; end: string };
  setCustomDates: (dates: { start: string; end: string }) => void;
  currency: "USD" | "VES";
  setCurrency: (currency: "USD" | "VES") => void;
  money: (amount: number) => string;
  open: (type: string, entity?: unknown) => void;
  close: () => void;
  mutate: (action: string, data: unknown, message?: string) => Promise<MutationResult>;
  refresh: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
  cart: CartItem[];
  setCart: (items: CartItem[]) => void;
  channel: string;
  setChannel: (channel: string) => void;
  tableId: number | null;
  setTableId: (id: number | null) => void;
  // Tema Día / Noche
  theme: "light" | "dark";
  toggleTheme: () => void;
  // Login / Auth
  isAuthenticated: boolean;
  currentUser: AppUser | null;
  loginUser: (user: AppUser) => void;
  logoutUser: () => void;
};

export const AppContext = createContext<AppContextType | null>(null);
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("Tesorio provider missing");
  return ctx;
}
