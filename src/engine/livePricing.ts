import type { LivePriceBook } from "./types";

export const FALLBACK_RATES: LivePriceBook = {
  fetchedAt: "",
  live: false,
  usdAed: 3.6725,
  aws: {},
  azure: {},
  gcp: {},
  awsGp3GbMonth: 0.096,
  azurePremiumGbMonth: 0.132,
  gcpSsdGbMonth: 0.187,
  awsEksHour: 0.1,
  azureAksSlaHour: 0.1,
  gcpGkeHour: 0.1,
  awsEgressGb: 0.09,
  azureEgressGb: 0.087,
  gcpEgressGb: 0.12,
  awsNatHour: 0.052,
  sources: [],
  warnings: ["Using built-in list prices until live feeds are fetched."],
};

export async function fetchLivePriceBook(): Promise<LivePriceBook> {
  try {
    const res = await fetch("/api/live-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) throw new Error(`live prices HTTP ${res.status}`);
    const data = (await res.json()) as LivePriceBook;
    return { ...FALLBACK_RATES, ...data, live: Boolean(data.live) };
  } catch (err) {
    return {
      ...FALLBACK_RATES,
      fetchedAt: new Date().toISOString(),
      warnings: [`Live price feed unavailable (${err instanceof Error ? err.message : "error"}). Showing last built-in rates.`],
    };
  }
}
