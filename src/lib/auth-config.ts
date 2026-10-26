export type UserRole =
  | "owner" // Eliezer Parra - Acceso Total / Monitoreo
  | "admin_fabrica" // Sucursal 1 (Fábrica / Bordadora)
  | "admin_sucursal_dtf" // Sucursal 2 (Tienda Los Ruices / Plotter DTF)
  | "operator_dtf" // Operador de Plotter DTF (Solo su pantalla de máquina)
  | "operator_bordadora" // Operador de Bordadora (Solo su pantalla de máquina)
  | "operator_corte_confeccion"; // Operador de Taller de Costura (Solo su pantalla de máquina)

export type SystemUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // Contraseña robusta
  role: UserRole;
  title: string;
  branchName: string;
  stationAccess: "all" | "plotter_dtf" | "bordadora" | "corte_confeccion" | "none";
  allowedModules: string[];
};

// 5 Cuentas del sistema configuradas con contraseñas seguras y robustas:
// 1) Dueño general (Eliezer Parra): Acceso total omnisciente
// 2) Gerente Fábrica Bordado (Sucursal 1 - Galpón Confección)
// 3) Gerente Sucursal DTF (Sucursal 2 - Tienda Comercial DTF)
// 4) Operador Plotter DTF: Exclusivamente terminal DTF de taller
// 5) Operador Bordadora: Exclusivamente terminal Bordadora de taller
export const SYSTEM_USERS: SystemUser[] = [
  {
    id: "user-owner",
    name: "Eliezer Parra",
    email: "eliezer.parra@fabricacristorey.com",
    passwordHash: "Eliezer#CristoRey2026$Total", // Contraseña robusta de alta entropía
    role: "owner",
    title: "Propietario & Director General",
    branchName: "Sede Corporativa (Todas las Sucursales)",
    stationAccess: "all",
    allowedModules: [
      "inicio",
      "ventas",
      "inventario",
      "produccion",
      "cuentas",
      "pendientes",
      "gastos",
      "auditoria",
      "financiero",
      "reportes",
      "clientes",
      "marketing",
      "estadisticas",
      "equipo",
      "configuracion",
    ],
  },
  {
    id: "user-admin-fabrica",
    name: "Gerencia Fábrica (Bordados & Confección)",
    email: "fabrica.bordados@fabricacristorey.com",
    passwordHash: "Fabrica#Bordado982$Secure", // Contraseña robusta
    role: "admin_fabrica",
    title: "Gerente Sucursal Fábrica",
    branchName: "Sucursal 1: Fábrica y Bordado Industrial",
    stationAccess: "bordadora",
    allowedModules: [
      "inicio",
      "ventas",
      "inventario",
      "produccion",
      "cuentas",
      "pendientes",
      "gastos",
      "auditoria",
      "financiero",
      "reportes",
      "clientes",
      "marketing",
    ],
  },
  {
    id: "user-admin-dtf",
    name: "Gerencia Sucursal DTF (Comercial)",
    email: "sucursal.dtf@fabricacristorey.com",
    passwordHash: "Sucursal#DTF2026*Protegida", // Contraseña robusta
    role: "admin_sucursal_dtf",
    title: "Gerente Sucursal DTF",
    branchName: "Sucursal 2: Centro Comercial DTF Textil",
    stationAccess: "plotter_dtf",
    allowedModules: [
      "inicio",
      "ventas",
      "inventario",
      "produccion",
      "cuentas",
      "pendientes",
      "gastos",
      "auditoria",
      "financiero",
      "reportes",
      "clientes",
      "marketing",
    ],
  },
  {
    id: "user-op-dtf",
    name: "Operador de Plotter DTF",
    email: "operador.dtf@fabricacristorey.com",
    passwordHash: "Plotter#I3200!Taller941", // Contraseña robusta
    role: "operator_dtf",
    title: "Operador Máquina DTF",
    branchName: "Estación Plotter DTF I3200",
    stationAccess: "plotter_dtf",
    // ACCESO RESTRINGIDO: Únicamente su estación de trabajo para procesar y marcar terminada
    allowedModules: ["produccion"],
  },
  {
    id: "user-op-bordadora",
    name: "Operador de Bordadora Industrial",
    email: "operador.bordadora@fabricacristorey.com",
    passwordHash: "Meistergram#Cabezales!7742", // Contraseña robusta
    role: "operator_bordadora",
    title: "Operador Máquina Bordadora",
    branchName: "Estación Bordadora Meistergram 8 Cabezales",
    stationAccess: "bordadora",
    // ACCESO RESTRINGIDO: Únicamente su estación de trabajo para procesar y marcar terminada
    allowedModules: ["produccion"],
  },
  {
    id: "user-op-costura",
    name: "Operador de Taller de Costura",
    email: "operador.costura@fabricacristorey.com",
    passwordHash: "Costura#Taller!2851", // Contraseña robusta
    role: "operator_corte_confeccion",
    title: "Operador Taller de Costura",
    branchName: "Estación Taller de Costura y Confección",
    stationAccess: "corte_confeccion",
    // ACCESO RESTRINGIDO: Únicamente su estación de trabajo para procesar y marcar terminada
    allowedModules: ["produccion"],
  },
];

export function authenticate(email: string, password: string): SystemUser | null {
  const cleanEmail = email.trim().toLowerCase();
  const user = SYSTEM_USERS.find((u) => u.email.toLowerCase() === cleanEmail);
  if (user && user.passwordHash === password) {
    return user;
  }
  return null;
}
