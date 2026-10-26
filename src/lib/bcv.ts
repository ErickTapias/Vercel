export type BcvRateResult = {
  rate: number;
  euroRate?: number;
  dateStr?: string;
  source: "live" | "fallback";
  updatedAt: string;
};

export async function fetchBcvRate(): Promise<BcvRateResult> {
  const now = new Date().toISOString();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch("https://www.bcv.org.ve/", {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`BCV returned status ${res.status}`);
    }

    const html = await res.text();

    // Regex para buscar el bloque id="dolar"
    // <div id="dolar" ... <strong class="strong-tb">887,30200000</strong>
    const dolarMatch = html.match(/id=["']dolar["'][\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/i);
    const euroMatch = html.match(/id=["']euro["'][\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/i);

    if (dolarMatch && dolarMatch[1]) {
      const rawText = dolarMatch[1].trim().replace(/\./g, "").replace(",", ".");
      const parsedRate = parseFloat(rawText);

      let parsedEuro: number | undefined = undefined;
      if (euroMatch && euroMatch[1]) {
        const rawEuro = euroMatch[1].trim().replace(/\./g, "").replace(",", ".");
        const eVal = parseFloat(rawEuro);
        if (!isNaN(eVal) && eVal > 0) parsedEuro = Math.round(eVal * 100) / 100;
      }

      if (!isNaN(parsedRate) && parsedRate > 0) {
        return {
          rate: Math.round(parsedRate * 100) / 100,
          euroRate: parsedEuro,
          source: "live",
          updatedAt: now,
        };
      }
    }
    throw new Error("No se pudo extraer la tasa del HTML del BCV");
  } catch (err) {
    console.warn("Fallo al consultar BCV en vivo:", (err as Error).message);
    return {
      rate: 887.30, // Tasa actual real del BCV verificada
      euroRate: 994.04,
      source: "fallback",
      updatedAt: now,
    };
  }
}
