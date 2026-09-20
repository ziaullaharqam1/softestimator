import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const AWS_REGION = "me-central-1";
const AZURE_REGION = "uaenorth";
const GCP_REGION = "me-central1";
const TTL_MS = 60 * 60 * 1000;
const CACHE = path.join(os.tmpdir(), "softestimator-price-cache");

const AWS_SKUS = [
  "m6i.large", "m6i.xlarge", "m6i.2xlarge", "m6i.4xlarge", "m6i.8xlarge",
  "r6i.large", "r6i.xlarge", "r6i.2xlarge", "r6i.4xlarge", "r6i.8xlarge",
  "c6i.large", "c6i.xlarge", "c6i.2xlarge", "c6i.4xlarge",
  "t3.small", "t3.medium", "t3.large",
];
const AZURE_SKUS = [
  "Standard_D2s_v5", "Standard_D4s_v5", "Standard_D8s_v5", "Standard_D16s_v5", "Standard_D32s_v5",
  "Standard_E2s_v5", "Standard_E4s_v5", "Standard_E8s_v5", "Standard_E16s_v5", "Standard_E32s_v5",
  "Standard_F2s_v2", "Standard_F4s_v2", "Standard_F8s_v2", "Standard_F16s_v2",
  "Standard_B1ms", "Standard_B2s", "Standard_B2ms",
];
const GCP_SKUS = [
  "n2-standard-2", "n2-standard-4", "n2-standard-8", "n2-standard-16", "n2-standard-32",
  "n2-highmem-2", "n2-highmem-4", "n2-highmem-8", "n2-highmem-16", "n2-highmem-32",
  "n2-highcpu-2", "n2-highcpu-4", "n2-highcpu-8", "n2-highcpu-16",
  "e2-small", "e2-medium", "e2-standard-2",
];

let memoryCache = { at: 0, book: null };

async function ensureCacheDir() {
  await fs.mkdir(CACHE, { recursive: true });
}

async function readJsonCache(name, ttl = TTL_MS) {
  try {
    const p = path.join(CACHE, name);
    const st = await fs.stat(p);
    if (Date.now() - st.mtimeMs > ttl) return null;
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return null;
  }
}

async function writeJsonCache(name, data) {
  await ensureCacheDir();
  await fs.writeFile(path.join(CACHE, name), JSON.stringify(data));
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "SoftEstimator/1.0" } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "SoftEstimator/1.0" } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function onDemandUsd(terms, skuId) {
  const t = terms?.OnDemand?.[skuId];
  if (!t) return null;
  for (const od of Object.values(t)) {
    for (const pd of Object.values(od.priceDimensions || {})) {
      const usd = Number(pd.pricePerUnit?.USD);
      if (Number.isFinite(usd) && usd > 0) return usd;
    }
  }
  return null;
}

function linuxSharedScore(attr) {
  if (attr.operatingSystem !== "Linux") return -1;
  if (attr.tenancy && attr.tenancy !== "Shared") return -1;
  if (attr.preInstalledSw && attr.preInstalledSw !== "NA") return -1;
  if (attr.capacitystatus && attr.capacitystatus !== "Used") return -1;
  let s = 0;
  if (attr.operation === "RunInstances") s += 5;
  if (String(attr.productFamily || "").includes("Compute Instance")) s += 3;
  if (attr.currentGeneration === "Yes") s += 1;
  return s;
}

async function loadAwsSeed() {
  const url = new URL("./aws-seed.json", import.meta.url);
  return JSON.parse(await fs.readFile(url, "utf8"));
}

async function awsAncillaryLive(base) {
  const out = { ...base, aws: { ...base.aws } };
  try {
    const eks = await fetchJson(
      `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEKS/current/${AWS_REGION}/index.json`
    );
    for (const [id, product] of Object.entries(eks.products || {})) {
      const usage = product.attributes?.usagetype || "";
      if (usage.includes("AmazonEKS-Hours:perCluster")) {
        const usd = onDemandUsd(eks.terms, id);
        if (usd) out.awsEksHour = usd;
      }
    }
    if (eks.publicationDate) out.publicationDate = eks.publicationDate;
  } catch {
    /* keep seed */
  }
  try {
    const vpc = await fetchJson(
      `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonVPC/current/${AWS_REGION}/index.json`
    );
    for (const [id, product] of Object.entries(vpc.products || {})) {
      const usage = product.attributes?.usagetype || "";
      const family = product.productFamily || product.attributes?.productFamily || "";
      if (/NAT Gateway/i.test(family) && /NatGateway-Hours/i.test(usage)) {
        const usd = onDemandUsd(vpc.terms, id);
        if (usd) out.awsNatHour = usd;
      }
    }
  } catch {
    /* keep seed */
  }
  try {
    const xfer = await fetchJson(
      `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSDataTransfer/current/${AWS_REGION}/index.json`
    );
    for (const [id, product] of Object.entries(xfer.products || {})) {
      const family = product.productFamily || product.attributes?.productFamily || "";
      const usage = product.attributes?.usagetype || "";
      const usd = onDemandUsd(xfer.terms, id);
      if (!usd || usd >= 0.5) continue;
      if (/Data Transfer/i.test(family) && /DataTransfer-Out-Bytes/i.test(usage)) {
        out.awsEgressGb = usd;
      }
    }
  } catch {
    /* keep seed */
  }
  return out;
}

async function awsComputeAndStorage() {
  const cached = await readJsonCache("aws-ec2-extracted.json");
  if (cached) return awsAncillaryLive(cached);

  // Vercel cannot parse the ~125MB EC2 offer in a serverless function.
  if (process.env.VERCEL) {
    return awsAncillaryLive(await loadAwsSeed());
  }

  const idx = await fetchJson("https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/region_index.json");
  const rel = idx.regions?.[AWS_REGION]?.currentVersionUrl;
  if (!rel) throw new Error("AWS region index missing me-central-1");
  const offer = await fetchJson(`https://pricing.us-east-1.amazonaws.com${rel}`);
  const wanted = new Set(AWS_SKUS);
  const best = {};
  for (const [id, product] of Object.entries(offer.products || {})) {
    const attr = product.attributes || {};
    const type = attr.instanceType;
    if (!wanted.has(type)) continue;
    const score = linuxSharedScore(attr);
    if (score < 0) continue;
    const usd = onDemandUsd(offer.terms, id);
    if (!usd) continue;
    const prev = best[type];
    if (!prev || score > prev.score || (score === prev.score && usd < prev.usd)) {
      best[type] = { usd, score };
    }
  }
  const aws = Object.fromEntries(Object.entries(best).map(([k, v]) => [k, v.usd]));

  let awsGp3GbMonth = 0.096;
  let awsNatHour = 0.052;
  let awsEgressGb = 0.09;
  for (const [id, product] of Object.entries(offer.products || {})) {
    const attr = product.attributes || {};
    const usd = onDemandUsd(offer.terms, id);
    if (!usd) continue;
    const usage = attr.usagetype || "";
    const family = product.productFamily || attr.productFamily || "";
    if (attr.volumeApiName === "gp3" && /VolumeUsage\.gp3/i.test(usage) && usd < 1) {
      awsGp3GbMonth = usd;
    }
    if (/NAT Gateway/i.test(family) && /NatGateway-Hours/i.test(usage)) {
      awsNatHour = usd;
    }
    if (/Data Transfer/i.test(family) && /DataTransfer-Out-Bytes/i.test(usage) && usd < 0.5) {
      awsEgressGb = usd;
    }
  }

  const eks = await fetchJson(`https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEKS/current/${AWS_REGION}/index.json`);
  let awsEksHour = 0.1;
  for (const [id, product] of Object.entries(eks.products || {})) {
    const usage = product.attributes?.usagetype || "";
    if (usage.includes("AmazonEKS-Hours:perCluster")) {
      const usd = onDemandUsd(eks.terms, id);
      if (usd) awsEksHour = usd;
    }
  }

  const extracted = {
    aws,
    awsGp3GbMonth,
    awsNatHour,
    awsEgressGb,
    awsEksHour,
    publicationDate: offer.publicationDate || eks.publicationDate,
  };
  await writeJsonCache("aws-ec2-extracted.json", extracted);
  return extracted;
}

async function azureRetail(filter) {
  const url = `https://prices.azure.com/api/retail/prices?currencyCode=USD&$filter=${encodeURIComponent(filter)}`;
  const data = await fetchJson(url);
  return data.Items || [];
}

async function azurePrices() {
  const azure = {};
  const warnings = [];
  await Promise.all(
    AZURE_SKUS.map(async (sku) => {
      try {
        const items = await azureRetail(
          `armRegionName eq '${AZURE_REGION}' and armSkuName eq '${sku}' and priceType eq 'Consumption'`
        );
        const linux = items.filter(
          (i) =>
            !/windows/i.test(i.productName || "") &&
            !/spot|low priority/i.test(i.meterName || "") &&
            /hour/i.test(i.unitOfMeasure || "")
        );
        const hit = linux.sort((a, b) => a.unitPrice - b.unitPrice)[0];
        if (hit) azure[sku] = hit.unitPrice;
      } catch (e) {
        warnings.push(`Azure ${sku}: ${e.message}`);
      }
    })
  );

  let azurePremiumGbMonth = 0.132;
  try {
    const disks = await azureRetail(
      `armRegionName eq '${AZURE_REGION}' and priceType eq 'Consumption' and meterName eq 'P30 LRS Disk' and productName eq 'Premium SSD Managed Disks'`
    );
    if (disks[0]?.unitPrice) azurePremiumGbMonth = disks[0].unitPrice / 1024;
  } catch (e) {
    warnings.push(`Azure disk: ${e.message}`);
  }

  let azureAksSlaHour = 0.1;
  try {
    const aks = await azureRetail(
      `armRegionName eq '${AZURE_REGION}' and priceType eq 'Consumption' and meterName eq 'Standard Uptime SLA'`
    );
    if (aks[0]?.unitPrice) azureAksSlaHour = aks[0].unitPrice;
  } catch (e) {
    warnings.push(`Azure AKS: ${e.message}`);
  }

  let azureEgressGb = 0.087;
  try {
    const bw = await azureRetail(
      `armRegionName eq '${AZURE_REGION}' and priceType eq 'Consumption' and meterName eq 'Standard Data Transfer Out' and serviceName eq 'Bandwidth'`
    );
    const hit = bw.find((i) => i.unitPrice > 0 && i.unitPrice < 1) || bw[0];
    if (hit?.unitPrice) azureEgressGb = hit.unitPrice;
  } catch {
    /* keep fallback */
  }

  return { azure, azurePremiumGbMonth, azureAksSlaHour, azureEgressGb, warnings };
}

function ymlHour(text, sku, region) {
  const start = text.indexOf(`\n    ${sku}:\n      cost:\n`);
  if (start < 0) return null;
  const slice = text.slice(start, start + 12000);
  const m = slice.match(new RegExp(`\\n        ${region}:\\n          hour: ([0-9.]+)`));
  return m ? Number(m[1]) : null;
}

function ymlMonth(text, heading, region) {
  const start = text.indexOf(`\n    ${heading}:\n`);
  if (start < 0) return null;
  const slice = text.slice(start, start + 8000);
  const m = slice.match(new RegExp(`\\n        ${region}:\\n          month: ([0-9.]+)`));
  return m ? Number(m[1]) : null;
}

async function gcpPrices() {
  const cached = await readJsonCache("gcp-extracted.json");
  if (cached) return cached;
  const text = await fetchText(
    "https://raw.githubusercontent.com/Cyclenerd/google-cloud-pricing-cost-calculator/master/pricing.yml"
  );
  const gcp = {};
  for (const sku of GCP_SKUS) {
    const hour = ymlHour(text, sku, GCP_REGION);
    if (hour) gcp[sku] = hour;
  }
  const gcpSsdGbMonth = ymlMonth(text, "ssd", GCP_REGION) || 0.187;
  const extracted = { gcp, gcpSsdGbMonth };
  await writeJsonCache("gcp-extracted.json", extracted);
  return extracted;
}

async function fxUsdAed() {
  const data = await fetchJson("https://open.er-api.com/v6/latest/USD");
  const rate = Number(data?.rates?.AED);
  if (!Number.isFinite(rate) || rate < 2 || rate > 5) throw new Error("unexpected AED FX");
  return rate;
}

export async function buildLivePriceBook() {
  if (memoryCache.book && Date.now() - memoryCache.at < 5 * 60 * 1000) {
    return memoryCache.book;
  }
  const warnings = [];
  const sources = [];
  let usdAed = 3.6725;
  let aws = {};
  let azure = {};
  let gcp = {};
  let awsGp3GbMonth = 0.096;
  let azurePremiumGbMonth = 0.132;
  let gcpSsdGbMonth = 0.187;
  let awsEksHour = 0.1;
  let azureAksSlaHour = 0.1;
  let gcpGkeHour = 0.1;
  let awsEgressGb = 0.09;
  let azureEgressGb = 0.087;
  let gcpEgressGb = 0.12;
  let awsNatHour = 0.052;
  let liveParts = 0;

  const jobs = await Promise.allSettled([fxUsdAed(), awsComputeAndStorage(), azurePrices(), gcpPrices()]);

  if (jobs[0].status === "fulfilled") {
    usdAed = jobs[0].value;
    liveParts += 1;
    sources.push("open.er-api.com USD/AED");
  } else warnings.push(`FX: ${jobs[0].reason?.message || jobs[0].reason}`);

  if (jobs[1].status === "fulfilled") {
    const a = jobs[1].value;
    aws = a.aws;
    awsGp3GbMonth = a.awsGp3GbMonth;
    awsNatHour = a.awsNatHour;
    awsEgressGb = a.awsEgressGb;
    awsEksHour = a.awsEksHour;
    liveParts += 1;
    sources.push(`AWS Price List ${AWS_REGION} ${a.publicationDate || ""}`.trim());
  } else warnings.push(`AWS: ${jobs[1].reason?.message || jobs[1].reason}`);

  if (jobs[2].status === "fulfilled") {
    azure = jobs[2].value.azure;
    azurePremiumGbMonth = jobs[2].value.azurePremiumGbMonth;
    azureAksSlaHour = jobs[2].value.azureAksSlaHour;
    azureEgressGb = jobs[2].value.azureEgressGb;
    warnings.push(...(jobs[2].value.warnings || []));
    liveParts += 1;
    sources.push(`Azure Retail Prices ${AZURE_REGION}`);
  } else warnings.push(`Azure: ${jobs[2].reason?.message || jobs[2].reason}`);

  if (jobs[3].status === "fulfilled") {
    gcp = jobs[3].value.gcp;
    gcpSsdGbMonth = jobs[3].value.gcpSsdGbMonth;
    liveParts += 1;
    sources.push(`GCP public SKU catalog (${GCP_REGION})`);
  } else warnings.push(`GCP: ${jobs[3].reason?.message || jobs[3].reason}`);

  const book = {
    fetchedAt: new Date().toISOString(),
    live: liveParts > 0,
    usdAed,
    aws,
    azure,
    gcp,
    awsGp3GbMonth,
    azurePremiumGbMonth,
    gcpSsdGbMonth,
    awsEksHour,
    azureAksSlaHour,
    gcpGkeHour,
    awsEgressGb,
    azureEgressGb,
    gcpEgressGb,
    awsNatHour,
    sources,
    warnings: warnings.filter(Boolean),
  };
  memoryCache = { at: Date.now(), book };
  return book;
}

function attach(server) {
  server.middlewares.use(async (req, res, next) => {
    if (!req.url?.startsWith("/api/live-prices")) return next();
    try {
      const book = await buildLivePriceBook();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(book));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ live: false, warnings: [String(err)] }));
    }
  });
}

export function livePricesPlugin() {
  return {
    name: "softestimator-live-prices",
    configureServer(server) {
      attach(server);
    },
    configurePreviewServer(server) {
      attach(server);
    },
  };
}
