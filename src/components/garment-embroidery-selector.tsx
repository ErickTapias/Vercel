"use client";
import React, { useState, useRef, useEffect } from "react";
import { Check, X, Move, Plus, Trash2, Edit3, Sparkles } from "lucide-react";

export type GarmentType = "franela" | "camisa" | "pantalon" | "gorra" | "chaqueta" | "sueter";

// Resuelve el tipo de silueta a partir del texto libre de la prenda (ej. "Chemises piqué azul marino")
export function resolveGarmentType(raw?: string | null): GarmentType {
  const t = (raw || "").toLowerCase();
  if (/gorra|sombrero|capucha|beanie/.test(t)) return "gorra";
  if (/pantal[oó]n|jean|cargo|pant|falda|overol/.test(t)) return "pantalon";
  if (/chaqueta|jacket|buzo|casaca|cortaviento|blazer/.test(t)) return "chaqueta";
  if (/su[eé]ter|sweater|hoodie|sudadera|pol[oó]|pijama/.test(t)) return "sueter";
  if (/camisa|chemise|oxford|blusa|shirt|eject/.test(t)) return "camisa";
  return "franela";
}

export type LogoMarker = {
  id: string;
  label: string;
  side: "frente" | "espalda";
  x: number; // porcentaje 0-100 en el lienzo
  y: number; // porcentaje 0-100 en el lienzo
  size: string;
  logoDescription: string;
  colors: string;
  technique: "Bordado" | "DTF" | "Estampado" | "Costura";
  notes?: string;
};

export type CroquisData = {
  garmentType: GarmentType;
  noEmbroidery: boolean;
  markers: LogoMarker[];
};

// Puntos predefinidos sugeridos para inicio rápido
const SUGGESTED_SPOTS: Record<GarmentType, { frente: Array<{ label: string; x: number; y: number; size: string }>; espalda: Array<{ label: string; x: number; y: number; size: string }> }> = {
  franela: {
    frente: [
      { label: "Pecho Izquierdo (Corazón)", x: 62, y: 32, size: "9x9 cm" },
      { label: "Pecho Derecho", x: 38, y: 32, size: "9x9 cm" },
      { label: "Centro de Pecho", x: 50, y: 36, size: "22x14 cm" },
      { label: "Manga Izquierda", x: 80, y: 30, size: "6x6 cm" },
      { label: "Manga Derecha", x: 20, y: 30, size: "6x6 cm" },
    ],
    espalda: [
      { label: "Espalda Cuello / Nuca", x: 50, y: 20, size: "6x4 cm" },
      { label: "Espalda Superior en Arco", x: 50, y: 32, size: "26x10 cm" },
      { label: "Espalda Completa", x: 50, y: 48, size: "28x22 cm" },
    ],
  },
  camisa: {
    frente: [
      { label: "Bolsillo / Pecho Izquierdo", x: 63, y: 34, size: "8x8 cm" },
      { label: "Pecho Derecho", x: 37, y: 34, size: "8x8 cm" },
      { label: "Puntas de Cuello", x: 50, y: 16, size: "3x3 cm" },
      { label: "Manga Derecha", x: 18, y: 35, size: "6x4 cm" },
      { label: "Manga Izquierda", x: 82, y: 35, size: "6x4 cm" },
    ],
    espalda: [
      { label: "Canesú / Nuca", x: 50, y: 22, size: "7x5 cm" },
      { label: "Espalda Superior", x: 50, y: 36, size: "25x10 cm" },
    ],
  },
  pantalon: {
    frente: [
      { label: "Bolsillo Delantero Izq.", x: 62, y: 26, size: "7x7 cm" },
      { label: "Bolsillo Delantero Der.", x: 38, y: 26, size: "7x7 cm" },
      { label: "Bolsillo Cargo / Muslo", x: 66, y: 48, size: "9x9 cm" },
    ],
    espalda: [
      { label: "Bolsillo Trasero Izq.", x: 60, y: 30, size: "7x6 cm" },
      { label: "Bolsillo Trasero Der.", x: 40, y: 30, size: "7x6 cm" },
    ],
  },
  gorra: {
    frente: [
      { label: "Frente Central de Corona", x: 50, y: 36, size: "12x5.5 cm" },
      { label: "Lateral Izquierdo", x: 74, y: 44, size: "5x4 cm" },
      { label: "Lateral Derecho", x: 26, y: 44, size: "5x4 cm" },
    ],
    espalda: [
      { label: "Arco Sobre Broche", x: 50, y: 35, size: "8x2.5 cm" },
    ],
  },
  chaqueta: {
    frente: [
      { label: "Pecho Izquierdo", x: 62, y: 32, size: "9x9 cm" },
      { label: "Pecho Derecho", x: 38, y: 32, size: "9x9 cm" },
      { label: "Manga Izquierda", x: 82, y: 36, size: "7x7 cm" },
    ],
    espalda: [
      { label: "Espalda Superior", x: 50, y: 30, size: "26x14 cm" },
      { label: "Espalda Central", x: 50, y: 48, size: "28x25 cm" },
    ],
  },
  sueter: {
    frente: [
      { label: "Pecho Izquierdo", x: 62, y: 34, size: "9x9 cm" },
      { label: "Pecho Completo", x: 50, y: 38, size: "22x14 cm" },
      { label: "Manga Derecha", x: 20, y: 36, size: "6x6 cm" },
    ],
    espalda: [
      { label: "Nuca / Debajo de Capucha", x: 50, y: 24, size: "7x5 cm" },
      { label: "Espalda Completa", x: 50, y: 46, size: "28x22 cm" },
    ],
  },
};

export function GarmentSilhouette({ garment }: { garment: GarmentType }) {
  return (
    <svg viewBox="0 0 200 200" className="w-48 h-48 sm:w-52 sm:h-52 text-purple-200/90 dark:text-purple-900/30 select-none pointer-events-none">
      {garment === "franela" && (
        <path
          d="M60 20 L80 35 Q100 45 120 35 L140 20 L185 48 L165 80 L145 70 L145 180 L55 180 L55 70 L35 80 L15 48 Z"
          fill="currentColor"
          stroke="#7c3aed"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
      {garment === "camisa" && (
        <path
          d="M60 20 L80 30 L100 20 L120 30 L140 20 L185 50 L165 82 L145 72 L145 180 L55 180 L55 72 L35 82 L15 50 Z"
          fill="currentColor"
          stroke="#7c3aed"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
      {garment === "pantalon" && (
        <path
          d="M40 25 L160 25 L155 85 L145 185 L108 185 L100 90 L92 185 L55 185 L45 85 Z"
          fill="currentColor"
          stroke="#7c3aed"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
      {garment === "gorra" && (
        <path
          d="M30 110 C30 50 170 50 170 110 C185 115 195 130 180 145 C150 155 110 155 30 135 Z"
          fill="currentColor"
          stroke="#7c3aed"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
      {garment === "chaqueta" && (
        <path
          d="M55 20 L85 40 L115 40 L145 20 L190 55 L168 95 L150 85 L150 185 L50 185 L50 85 L32 95 L10 55 Z"
          fill="currentColor"
          stroke="#7c3aed"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
      {garment === "sueter" && (
        <path
          d="M58 25 Q100 10 142 25 L190 52 L170 88 L148 78 L148 182 L52 182 L52 78 L30 88 L10 52 Z"
          fill="currentColor"
          stroke="#7c3aed"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

// Visualizador estático del croquis para que el operador vea en grande la ubicación exacta
export function GarmentCroquisViewer({
  croquisData,
  defaultGarment = "franela",
  placementText = "",
}: {
  croquisData?: { garmentType: string; points: Array<any> } | null;
  defaultGarment?: string;
  placementText?: string;
}) {
  const garment = resolveGarmentType(croquisData?.garmentType || defaultGarment);
  const [view, setView] = useState<"frente" | "espalda">("frente");

  const rawPoints = (croquisData?.points || []).filter(Boolean);
  const points = rawPoints.filter((p) => (p.side || "frente") === view);

  // Fallback: si la orden no tiene croquis guardado, derivar el punto desde el texto de ubicación
  const fallbackPoints =
    rawPoints.length === 0 && placementText && !placementText.includes("SIN BORDADO")
      ? placementText.split(",").map((chunk, idx) => {
          const label = chunk.trim();
          const isBack = /espalda|atr[aá]s|nuca/i.test(label);
          return {
            id: `fallback-${idx}`,
            label,
            side: isBack ? "espalda" : "frente",
            x: /izquier/i.test(label) ? 63 : /derech/i.test(label) ? 37 : 50,
            y: /espalda|atr[aá]s/i.test(label) ? 38 : /cuello|nuca/i.test(label) ? 22 : 33,
            size: (label.match(/(\d+\s*[x×]\s*\d+\s*cm)/i) || [])[1] || "10x10 cm",
            technique: "Bordado / Estampado",
          };
        })
      : [];
  const visiblePoints = rawPoints.length ? points : fallbackPoints.filter((p) => p.side === view);

  return (
    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <Sparkles size={14} className="text-purple-600" /> Croquis Técnico de la Prenda
        </span>
        <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setView("frente")}
            className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all ${
              view === "frente" ? "bg-purple-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            FRENTE
          </button>
          <button
            type="button"
            onClick={() => setView("espalda")}
            className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all ${
              view === "espalda" ? "bg-purple-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            ATRÁS
          </button>
        </div>
      </div>

      <div className="relative w-full max-w-xs mx-auto h-56 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
        <GarmentSilhouette garment={garment} />

        <span className="absolute top-2 left-2 text-[9px] font-extrabold uppercase bg-white/90 dark:bg-slate-900/90 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded shadow-2xs">
          VISTA: {view.toUpperCase()}
        </span>

        {visiblePoints.map((pt, idx) => (
          <div
            key={pt.id || idx}
            style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
          >
            <div className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center border-2 border-white shadow-md animate-pulse">
              {idx + 1}
            </div>
            {/* Tooltip flotante con detalles del logo */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-[9.5px] rounded-lg shadow-xl z-30 pointer-events-none">
              <strong className="block text-purple-300 font-bold">{pt.label}</strong>
              <div>Tamaño: {pt.size}</div>
              {pt.logoDescription && <div>Logo: {pt.logoDescription}</div>}
              {pt.colors && <div>Colores: {pt.colors}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Lista detallada de logos en esta prenda */}
      {visiblePoints.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
            Especificación de Cada Logo / Aplicación:
          </span>
          {visiblePoints.map((pt, idx) => (
            <div
              key={idx}
              className="p-2 rounded bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs flex items-start gap-2"
            >
              <span className="w-4 h-4 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <strong className="text-purple-950 dark:text-purple-200">{pt.label}</strong>
                  <span className="text-[9.5px] bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded font-mono text-purple-700 border">
                    {pt.side.toUpperCase()}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  <strong>Tamaño:</strong> {pt.size || "10x10 cm"} · <strong>Técnica:</strong> {pt.technique || "Bordado"}
                </div>
                {pt.logoDescription && (
                  <div className="text-[10px] text-slate-500">
                    <strong>Arte/Logo:</strong> {pt.logoDescription}
                  </div>
                )}
                {pt.colors && (
                  <div className="text-[10px] text-slate-500">
                    <strong>Colores/Hilos:</strong> {pt.colors}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        placementText && (
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-2 rounded">
            <strong>Ubicación registrada:</strong> {placementText}
          </div>
        )
      )}
    </div>
  );
}

// Selector Interactivo Avanzado con Arrastre Libre (Drag & Drop) y Características Detalladas por Logo
export function InteractiveGarmentSelector({
  initialData,
  onChange,
}: {
  initialData?: {
    garmentType?: string;
    noEmbroidery?: boolean;
    markers?: LogoMarker[];
  } | null;
  onChange: (data: {
    croquisData: CroquisData;
    placementText: string;
    dimensionsText: string;
    noEmbroidery: boolean;
  }) => void;
}) {
  const [garment, setGarment] = useState<GarmentType>((initialData?.garmentType as GarmentType) || "franela");
  const [view, setView] = useState<"frente" | "espalda">("frente");
  const [noEmbroidery, setNoEmbroidery] = useState<boolean>(Boolean(initialData?.noEmbroidery));
  const [markers, setMarkers] = useState<LogoMarker[]>(
    initialData?.markers && initialData.markers.length > 0
      ? initialData.markers
      : [
          {
            id: "marker-1",
            label: "Pecho Izquierdo (Corazón)",
            side: "frente",
            x: 62,
            y: 32,
            size: "10x10 cm",
            logoDescription: "Escudo / Logo Principal",
            colors: "Hilos Madeira / CMYK + Blanco",
            technique: "Bordado",
          },
        ]
  );

  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(markers[0]?.id || null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const draggingIdRef = useRef<string | null>(null);

  const activeMarker = markers.find((m) => m.id === activeMarkerId) || null;

  // Emitir cambios hacia el formulario padre
  const notifyChange = (updatedMarkers: LogoMarker[], isNoEmb: boolean, gType: GarmentType) => {
    const placementText = isNoEmb
      ? "SIN BORDADO (Prenda Lisa)"
      : updatedMarkers
          .map((m) => `${m.label} (${m.side === "frente" ? "Frente" : "Espalda"} - ${m.size})`)
          .join(", ") || "Ubicación personalizada";

    const dimensionsText = isNoEmb
      ? "N/A"
      : updatedMarkers.map((m) => `${m.size} [${m.label}]`).join(" | ") || "Estándar";

    onChange({
      croquisData: {
        garmentType: gType,
        noEmbroidery: isNoEmb,
        markers: updatedMarkers,
      },
      placementText,
      dimensionsText,
      noEmbroidery: isNoEmb,
    });
  };

  const handleToggleNoEmbroidery = () => {
    const nextVal = !noEmbroidery;
    setNoEmbroidery(nextVal);
    if (nextVal) {
      notifyChange([], true, garment);
    } else {
      const defaultM: LogoMarker = {
        id: `marker-${Date.now()}`,
        label: "Pecho Izquierdo (Corazón)",
        side: "frente",
        x: 62,
        y: 32,
        size: "10x10 cm",
        logoDescription: "Logo Principal",
        colors: "CMYK + Blanco / Hilos",
        technique: "Bordado",
      };
      setMarkers([defaultM]);
      setActiveMarkerId(defaultM.id);
      notifyChange([defaultM], false, garment);
    }
  };

  const handleGarmentChange = (g: GarmentType) => {
    setGarment(g);
    notifyChange(markers, noEmbroidery, g);
  };

  // Agregar un nuevo punto / logo libre en el centro o al hacer clic
  const handleAddMarkerAt = (x: number, y: number, labelName = "Nuevo Logo") => {
    if (noEmbroidery) setNoEmbroidery(false);
    const newId = `marker-${Date.now()}`;
    const newMarker: LogoMarker = {
      id: newId,
      label: labelName,
      side: view,
      x: Math.max(10, Math.min(90, Math.round(x))),
      y: Math.max(10, Math.min(90, Math.round(y))),
      size: "10x10 cm",
      logoDescription: `Logo #${markers.length + 1}`,
      colors: "CMYK + Base Blanca",
      technique: "Bordado",
    };
    const updated = [...markers, newMarker];
    setMarkers(updated);
    setActiveMarkerId(newId);
    notifyChange(updated, false, garment);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) return;
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    handleAddMarkerAt(x, y, `Posición #${markers.length + 1}`);
  };

  // Manejadores de arrastre libre del marcador con el ratón o touch
  const handleMouseDownOnMarker = (e: React.MouseEvent, markerId: string) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    draggingIdRef.current = markerId;
    setActiveMarkerId(markerId);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !canvasRef.current || !draggingIdRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = Math.max(5, Math.min(95, ((moveEvent.clientX - rect.left) / rect.width) * 100));
      const newY = Math.max(5, Math.min(95, ((moveEvent.clientY - rect.top) / rect.height) * 100));

      setMarkers((prev) =>
        prev.map((m) => (m.id === draggingIdRef.current ? { ...m, x: Math.round(newX), y: Math.round(newY) } : m))
      );
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      // Notificar cambio
      setMarkers((finalMarkers) => {
        notifyChange(finalMarkers, noEmbroidery, garment);
        return finalMarkers;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleRemoveMarker = (id: string) => {
    const updated = markers.filter((m) => m.id !== id);
    setMarkers(updated);
    if (activeMarkerId === id) {
      setActiveMarkerId(updated[0]?.id || null);
    }
    notifyChange(updated, noEmbroidery, garment);
  };

  const handleUpdateActiveMarker = (fields: Partial<LogoMarker>) => {
    if (!activeMarkerId) return;
    const updated = markers.map((m) => (m.id === activeMarkerId ? { ...m, ...fields } : m));
    setMarkers(updated);
    notifyChange(updated, noEmbroidery, garment);
  };

  const currentViewMarkers = markers.filter((m) => m.side === view);
  const suggested = SUGGESTED_SPOTS[garment]?.[view] || [];

  return (
    <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-xl space-y-3">
      {/* Cabecera y botón para omitir bordado */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Move size={14} className="text-purple-600" /> Croquis Interactivo con Arrastre Libre y Especificación de Logos
          </span>
          <small className="text-[10px] text-slate-500">
            Haz clic en cualquier punto de la prenda para colocar un logo o arrastra el marcador con el ratón a la posición exacta.
          </small>
        </div>

        <button
          type="button"
          onClick={handleToggleNoEmbroidery}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
            noEmbroidery
              ? "bg-amber-500 text-white border-amber-600 shadow-xs"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 hover:border-amber-400"
          }`}
        >
          {noEmbroidery && <Check size={13} />}
          <span>{noEmbroidery ? "✓ Esta prenda NO lleva bordado" : "Picar si NO lleva bordado"}</span>
        </button>
      </div>

      {!noEmbroidery && (
        <>
          {/* Selector de Tipo de Prenda */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mr-1">Prenda:</span>
            {(
              [
                { id: "franela", label: "👕 Franela / Chemise" },
                { id: "camisa", label: "👔 Camisa Ejecutiva" },
                { id: "pantalon", label: "👖 Pantalón / Táctico" },
                { id: "gorra", label: "🧢 Gorra" },
                { id: "chaqueta", label: "🧥 Chaqueta / Overol" },
                { id: "sueter", label: "🥼 Suéter / Buzo" },
              ] as const
            ).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => handleGarmentChange(g.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                  garment === g.id
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                    : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Selector de Vista FRENTE vs ATRÁS */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-purple-900 dark:text-purple-300">Vista de prenda:</span>
              <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setView("frente")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    view === "frente" ? "bg-purple-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  FRENTE
                </button>
                <button
                  type="button"
                  onClick={() => setView("espalda")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    view === "espalda" ? "bg-purple-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  ATRÁS (ESPALDA)
                </button>
              </div>
            </div>

            <span className="text-[11px] text-purple-700 dark:text-purple-300 font-mono">
              {currentViewMarkers.length} logo(s) en {view}
            </span>
          </div>

          {/* Barra de Formas y Proporciones Rápidas de Logo */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/80 rounded-lg">
            <span className="text-[10px] font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wide">
              Tamaño &amp; Forma Proporcional:
            </span>
            <div className="flex flex-wrap gap-1">
              {[
                { label: "🔘 Pequeño / Escudo (8x8 cm)", size: "8x8 cm" },
                { label: "⬛ Estándar Pecho (10x10 cm)", size: "10x10 cm" },
                { label: "📏 Horizontal (14x6 cm)", size: "14x6 cm" },
                { label: "🌈 Espalda Arco (26x10 cm)", size: "26x10 cm" },
                { label: "📦 Espalda Completa (28x22 cm)", size: "28x22 cm" },
              ].map((fmt) => (
                <button
                  key={fmt.size}
                  type="button"
                  onClick={() => {
                    if (activeMarkerId) {
                      handleUpdateActiveMarker({ size: fmt.size });
                    } else if (markers.length > 0) {
                      handleUpdateActiveMarker({ size: fmt.size });
                    }
                  }}
                  className="px-2 py-0.5 rounded text-[9.5px] font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-purple-400 hover:text-purple-700 transition-all"
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lienzo Interactivo con Arrastre Libre (Drag and Drop) - Proporción equilibrada y nítida */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            <div className="md:col-span-7">
              <div
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="relative w-full h-64 sm:h-72 bg-gradient-to-b from-slate-100 to-purple-50/50 dark:from-slate-950 dark:to-purple-950/20 border-2 border-purple-300 dark:border-purple-800 rounded-xl overflow-hidden shadow-inner flex items-center justify-center cursor-crosshair select-none"
              >
                <GarmentSilhouette garment={garment} />

                <span className="absolute top-2 left-2 text-[9.5px] font-extrabold uppercase bg-white/95 dark:bg-slate-900/95 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded shadow-2xs pointer-events-none">
                  VISTA: {view.toUpperCase()} · Clic para añadir o arrastra para mover
                </span>

                {/* Marcadores arrastrables libres con proporción adecuada */}
                {currentViewMarkers.map((marker, idx) => {
                  const isActive = marker.id === activeMarkerId;
                  return (
                    <div
                      key={marker.id}
                      onMouseDown={(e) => handleMouseDownOnMarker(e, marker.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMarkerId(marker.id);
                      }}
                      style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-20 transition-transform ${
                        isActive ? "scale-110" : "hover:scale-105"
                      }`}
                    >
                      <div
                        className={`px-2 py-0.5 rounded-full text-white font-extrabold text-[9.5px] flex items-center gap-1 shadow-md border ${
                          isActive
                            ? "bg-purple-600 border-white ring-2 ring-purple-300 animate-pulse"
                            : "bg-indigo-600 border-white"
                        }`}
                      >
                        <Move size={9} />
                        <span>#{idx + 1} ({marker.size})</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Puntos sugeridos rápidos */}
              <div className="flex flex-wrap gap-1 mt-2 items-center">
                <span className="text-[10px] text-slate-500 font-semibold mr-1">Sugeridos:</span>
                {suggested.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddMarkerAt(s.x, s.y, s.label)}
                    className="text-[10px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded hover:border-purple-400 hover:text-purple-700"
                  >
                    + {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Panel de Características Específicas del Logo Seleccionado */}
            <div className="md:col-span-5 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <Edit3 size={13} className="text-purple-600" />
                  {activeMarker ? `Características del Logo (${activeMarker.side.toUpperCase()})` : "Selecciona un Logo"}
                </span>
                {activeMarker && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMarker(activeMarker.id)}
                    className="text-[10px] text-red-600 hover:underline flex items-center gap-0.5"
                  >
                    <Trash2 size={12} /> Eliminar punto
                  </button>
                )}
              </div>

              {activeMarker ? (
                <div className="space-y-2 text-xs">
                  <label className="text-[11px] block">
                    Nombre / Identificador de la Posición:
                    <input
                      value={activeMarker.label}
                      onChange={(e) => handleUpdateActiveMarker({ label: e.target.value })}
                      placeholder="Ej. Pecho Izquierdo o Manga"
                      className="mt-0.5 text-xs py-1 px-2 border rounded w-full"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] block">
                      Dimensiones Exactas:
                      <input
                        value={activeMarker.size}
                        onChange={(e) => handleUpdateActiveMarker({ size: e.target.value })}
                        placeholder="Ej. 10x10 cm"
                        className="mt-0.5 text-xs py-1 px-2 border rounded w-full"
                      />
                    </label>
                    <label className="text-[11px] block">
                      Técnica:
                      <select
                        value={activeMarker.technique}
                        onChange={(e) => handleUpdateActiveMarker({ technique: e.target.value as any })}
                        className="mt-0.5 text-xs py-1 px-2 border rounded w-full"
                      >
                        <option value="Bordado">Bordado</option>
                        <option value="DTF">Impresión DTF</option>
                        <option value="Estampado">Estampado Térmico</option>
                        <option value="Costura">Costura / Parche</option>
                      </select>
                    </label>
                  </div>

                  <label className="text-[11px] block">
                    Nombre del Logo / Archivo Asociado:
                    <input
                      value={activeMarker.logoDescription}
                      onChange={(e) => handleUpdateActiveMarker({ logoDescription: e.target.value })}
                      placeholder="Ej. Escudo_Colegio_Pecho.dst"
                      className="mt-0.5 text-xs py-1 px-2 border rounded w-full"
                    />
                  </label>

                  <label className="text-[11px] block">
                    Colores / Tintas / Hilos de este logo:
                    <input
                      value={activeMarker.colors}
                      onChange={(e) => handleUpdateActiveMarker({ colors: e.target.value })}
                      placeholder="Ej. Azul Marino #1042, Blanco, Dorado"
                      className="mt-0.5 text-xs py-1 px-2 border rounded w-full"
                    />
                  </label>

                  <div className="text-[10px] text-slate-400 font-mono bg-slate-50 dark:bg-slate-900 p-1.5 rounded">
                    Coordenadas exactas en prenda: X: {activeMarker.x}% | Y: {activeMarker.y}%
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Haz clic sobre la silueta de la prenda o añade un punto sugerido para configurar sus especificaciones.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {noEmbroidery && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
          <Check size={16} className="text-amber-600 flex-shrink-0" />
          <span>
            <strong>Prenda lisa sin bordado ni estampado:</strong> El operario sabe que no debe aplicar gráficos en esta orden.
          </span>
        </div>
      )}
    </div>
  );
}
