import { config } from "./config.js";

export interface FxRate {
  jpyToTwd: number;
  source: string;
  updatedAt: string;
}

const TTL_MS = 60 * 60 * 1000;
let cache: { rate: FxRate; fetchedAt: number } | undefined;

/** JPY→TWD rate from open.er-api.com (free, no key), cached for 1 hour. */
export async function getJpyTwd(): Promise<FxRate> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.rate;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/JPY", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { result: string; rates: Record<string, number>; time_last_update_utc: string };
    const twd = body.rates?.TWD;
    if (body.result !== "success" || !twd) throw new Error("bad response");
    const rate = { jpyToTwd: twd, source: "open.er-api.com", updatedAt: body.time_last_update_utc };
    cache = { rate, fetchedAt: Date.now() };
    return rate;
  } catch (err) {
    console.warn("[fx] fetch failed, using fallback:", (err as Error).message);
    return cache?.rate ?? { jpyToTwd: config.fallbackJpyTwd, source: "fallback", updatedAt: "N/A" };
  }
}

export const fmtJpy = (n: number) => `¥${Math.round(n).toLocaleString("en-US")}`;
export const fmtTwd = (n: number) => `NT$${Math.round(n).toLocaleString("en-US")}`;

const YEN = /(?:[¥￥]\s?([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s?(?:円|日圓|日幣|JPY))/g;
const MODEL_TWD = /\s*(?:[（(]\s*≈?\s*NT\$\s*[\d,.]+\s*[）)]|(?:≈|\/|／)\s*NT\$\s*[\d,.]+)/g;

/**
 * Small models get currency math wrong. Drop any NT$ figures the model wrote
 * next to yen amounts and append ones computed from the real rate.
 */
export function annotateTwd(text: string, jpyToTwd: number): string {
  return text.replace(MODEL_TWD, "").replace(YEN, (m, a, b) => {
    const jpy = Number((a ?? b).replace(/,/g, ""));
    return Number.isFinite(jpy) && jpy > 0 ? `${m}（≈ ${fmtTwd(jpy * jpyToTwd)}）` : m;
  });
}
