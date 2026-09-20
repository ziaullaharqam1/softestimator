import { buildLivePriceBook } from "../server/livePrices.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  res.setHeader("Content-Type", "application/json");
  try {
    const book = await buildLivePriceBook();
    res.status(200).end(JSON.stringify(book));
  } catch (err) {
    res.status(500).end(
      JSON.stringify({ live: false, warnings: [String(err?.message || err)] })
    );
  }
}

export const config = {
  maxDuration: 60,
};
