import { architectureLabel, type ArchitectureStyle } from "../architecture";
import { estimateCapacity } from "../engine/estimate";
import { priceOnPrem } from "../engine/onprem";
import { priceK8sClouds, priceVmClouds } from "../engine/pricing";
import type { CapacityPlan, CloudBill, LivePriceBook, OnPremBill, PlannerInputs } from "../engine/types";
import { buildVmFleet } from "../engine/vmFleet";
import {
  CLOUDS,
  DR_UPLIFT,
  FILTERS,
  HOSTINGS,
  MANAGED,
  SHORT,
  TARGET_LABEL,
  option,
  serviceName,
  type FilterKey,
  type Hosting,
  type Selections,
  type SlideSection,
  type Target,
} from "./catalog";
import { architectureSvg } from "./diagram";

// ---------------------------------------------------------------- deck model

export type Block =
  | { kind: "bullets"; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][]; total?: string[]; widths?: number[] }
  | { kind: "kpis"; items: { label: string; value: string; sub?: string }[] }
  | { kind: "images"; items: Screenshot[] }
  | { kind: "diagram"; svg: string; w: number; h: number }
  | { kind: "bars"; items: { label: string; value: number; highlight?: boolean }[] }
  | { kind: "cols"; left: Block[]; right: Block[] }
  | { kind: "note"; text: string };

export interface Slide {
  kicker: string;
  title: string;
  blocks: Block[];
}

export interface Screenshot {
  name: string;
  caption: string;
  dataUrl: string;
  w: number;
  h: number;
}

export interface DeckInput {
  architecture: ArchitectureStyle;
  hosting: Target;
  selections: Selections;
  sections: Record<SlideSection, boolean>;
  projectName: string;
  clientName: string;
  vendorName: string;
  description: string;
  screenshots: Screenshot[];
  tps: number;
  services: number;
  users: number;
  durationMonths: number;
  startDate: string;
  haLevel: "standard" | "strict";
  book: LivePriceBook;
}

export interface Deck {
  title: string;
  subtitle: string;
  meta: string;
  footer: string;
  slides: Slide[];
  costs: Costs;
  /** Hosting used for KPIs, roadmap and BoQ (the cheapest cloud when comparing all). */
  reference: Hosting;
}

// ---------------------------------------------------------------- formatting

export const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-US")}`;
const aedShort = (n: number) => (Math.abs(n) >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(2)}M` : aed(n));

function addMonths(iso: string, months: number) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}
const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const labelOf = (k: FilterKey, id: string) => option(k, id)?.label ?? id;
const clip = (t: string, n: number) => (t.length <= n ? t : `${t.slice(0, t.lastIndexOf(" ", n)).replace(/[.,;:]$/, "")}…`);
const isManaged = (h: Hosting) => MANAGED.includes(h);

// ---------------------------------------------------------------- costs

const RATES = { PM: 2200, Architect: 2800, Backend: 1800, Frontend: 1500, Mobile: 1700, QA: 1200, DevOps: 1900, UX: 1500 } as const;
type Role = keyof typeof RATES;
const AI_SEAT_USD: Record<string, number> = { cursor: 40, "claude-code": 150, copilot: 19 };
const OPS_FTE_AED = 24000;
const COMMON_BASE_AED = 15000 * 0.18 + 15 * 7 * 3.6725; // SMS OTP (15k) + zero-trust access (15 seats)
const OPS_FTE: Record<Hosting, number> = { aws: 0.5, azure: 0.5, gcp: 0.5, onprem: 0.5, vercel: 0.25, lovable: 0.25 };

/** Supabase / Neon compute add-on by peak load (USD/month). */
const DB_TIERS: [number, string, number][] = [
  [50, "Small", 15],
  [150, "Medium", 60],
  [300, "Large", 110],
  [600, "XL", 210],
  [1200, "2XL", 410],
  [2500, "4XL", 960],
  [Infinity, "8XL", 1870],
];

export interface CostLine {
  label: string;
  note: string;
  aed: number;
}

export interface Costs {
  plan: CapacityPlan;
  onpremPlan: CapacityPlan;
  bills: CloudBill[];
  onprem: OnPremBill;
  managedLines: Record<"vercel" | "lovable", CostLine[]>;
  fit: Record<Hosting, string[]>;
  licences: CostLine[];
  licenceAed: number;
  drUplift: number;
  common: Record<Hosting, number>;
  monthly: Record<Hosting, number>;
  platform: Record<Hosting, number>;
  oneTimeInfra: Record<Hosting, number>;
  tco3: Record<Hosting, number>;
  team: { role: Role; fte: number; days: number; aed: number }[];
  labourAed: number;
  contingencyAed: number;
  toolingAed: number;
  deliveryAed: number;
  phases: Phase[];
}

export interface Phase {
  name: string;
  start: Date;
  end: Date;
  months: number;
  share: number;
  infraFactor: number;
  milestones: string[];
  labourAed: number;
  infraAed: number;
  totalAed: number;
}

/** Engine inputs. On-premise adds its own storage (Longhorn) and registry (Harbor); clouds use managed equivalents. */
function plannerInputs(d: DeckInput, onprem: boolean): PlannerInputs {
  const s = d.selections;
  return {
    architectureStyle: d.architecture,
    tps: Math.max(1, d.tps),
    springBootServices: Math.max(1, d.services),
    messaging: s.messaging === "kafka" ? "kafka" : "rabbitmq",
    observability: s.observability === "elk" ? "elk" : "prometheus",
    visualization: "grafana",
    includeKonga: s.apiGateway === "kong",
    includeLonghorn: onprem,
    includeArgoCd: d.architecture === "microservices",
    includeJenkins: s.cicd === "jenkins",
    includeCicdPipeline: false,
    includeHarbor: onprem,
    includeSuperset: false,
    includePowerBi: false,
    avgPayloadKb: 4,
    writeRatio: 0.35,
    logRetentionDays: 14,
    dataRetentionDays: 30,
    haLevel: d.haLevel,
    hypervisor: "proxmox",
  };
}

function managedPlatform(h: "vercel" | "lovable", d: DeckInput): CostLine[] {
  const s = d.selections;
  const fx = d.book.usdAed;
  const usd = (label: string, note: string, v: number): CostLine => ({ label, note, aed: Math.round(v * fx) });
  const tier = DB_TIERS.find(([max]) => d.tps <= max) ?? DB_TIERS[DB_TIERS.length - 1];
  const db = h === "vercel" ? "Neon / Supabase" : "Supabase";
  const lines: CostLine[] =
    h === "vercel"
      ? [usd("Vercel Pro", "5 seats × USD 20", 100), usd("Vercel usage", `functions, bandwidth, edge requests at ${d.tps} TPS`, 50 + d.tps * 1.2)]
      : [usd("Lovable Business", "3 builder seats × USD 50", 150), usd("Lovable Cloud hosting usage", `at ${d.tps} TPS`, 25 + d.tps * 0.8)];
  if (s.sqlDb !== "none" || s.noSql !== "none") {
    lines.push(usd(`${db} Team plan`, "SOC 2, SSO, 14-day PITR", 599));
    lines.push(usd(`${db} compute (${tier[1]})`, `sized for ≤${Number.isFinite(tier[0]) ? tier[0] : "2500+"} TPS`, tier[2]));
    lines.push(usd("Point-in-time recovery add-on", "7-day PITR", 100));
  }
  if (s.cache !== "none") lines.push(usd("Upstash Redis", "Pro", 50));
  if (s.search !== "none") lines.push(usd(h === "vercel" ? "Algolia / Upstash Search" : "Search (Postgres FTS)", "", h === "vercel" ? 100 : 0));
  if (s.messaging !== "none") lines.push(usd(h === "vercel" ? "Upstash QStash / Inngest" : "Supabase Queues", "", h === "vercel" ? 30 : 0));
  if (s.objectStorage !== "none") lines.push(usd(h === "vercel" ? "Vercel Blob" : "Supabase Storage", "2 TB", 2048 * 0.023));
  if (s.email !== "none") lines.push(usd("Resend", "100k emails", 35));
  return lines.filter((l) => l.aed > 0);
}

function fitWarnings(h: Hosting, d: DeckInput): string[] {
  const s = d.selections;
  const w: string[] = [];
  if (h === "gcp") w.push("No GCP region in the UAE (Doha / Dammam); check data-residency rules.");
  if (h === "aws" && s.dr !== "backup") w.push("AWS DR region (Bahrain) is outside the UAE.");
  if (!isManaged(h)) return w;
  const name = h === "vercel" ? "Vercel" : "Lovable";
  if (!["node-nest", "python-fastapi"].includes(s.backend)) w.push(`${name} runs TypeScript/Node${h === "vercel" ? " and Python" : ""} functions only; ${labelOf("backend", s.backend)} services need separate hosting (not costed).`);
  if (d.architecture === "microservices") w.push("Microservices become serverless functions: no long-running containers, brokers or service mesh.");
  if (s.mobile !== "none") w.push(h === "lovable" ? "Lovable builds web apps; native mobile apps need a separate build pipeline." : "Mobile apps are built and shipped separately; Vercel hosts their APIs.");
  if (["sqlserver", "oracle", "mysql"].includes(s.sqlDb) && h === "lovable") w.push(`${labelOf("sqlDb", s.sqlDb)} is not available on Lovable (Supabase is Postgres only).`);
  if (["sqlserver", "oracle"].includes(s.sqlDb) && h === "vercel") w.push(`${labelOf("sqlDb", s.sqlDb)} must be hosted outside Vercel.`);
  if (s.apiGateway === "kong" || s.loadBalancer === "f5") w.push("Kong / F5 cannot be placed in front of the platform; the vendor edge replaces them.");
  w.push("Database region is outside the UAE; weak fit for regulated data.");
  return w;
}

function teamFor(d: DeckInput, ref: Hosting) {
  const s = d.selections;
  const fte: Partial<Record<Role, number>> = {
    PM: 0.5,
    Architect: 0.5,
    Backend: Math.max(2, Math.ceil(d.services / 4)),
    Frontend: s.frontend === "none" ? 0 : 1,
    Mobile: s.mobile === "none" ? 0 : s.mobile === "native" ? 2 : 1.5,
    QA: 1,
    DevOps: isManaged(ref) ? 0.25 : d.architecture === "microservices" || ref === "onprem" ? 1 : 0.5,
    UX: s.frontend === "none" && s.mobile === "none" ? 0 : 0.5,
  };
  const months = Math.max(2, d.durationMonths);
  return (Object.keys(RATES) as Role[])
    .filter((r) => (fte[r] ?? 0) > 0)
    .map((role) => {
      const f = fte[role] ?? 0;
      const days = Math.round(f * 21 * months);
      return { role, fte: f, days, aed: days * RATES[role] };
    });
}

export function computeCosts(d: DeckInput): Costs & { reference: Hosting } {
  const pi = plannerInputs(d, false);
  const plan = estimateCapacity(pi);
  const piOnprem = plannerInputs(d, true);
  const onpremPlan = estimateCapacity(piOnprem);
  // The engine always models a broker; drop it from the VM fleet when the filters say no messaging.
  const fleet = buildVmFleet(plan).filter((v) => d.selections.messaging !== "none" || !/rabbit|kafka/i.test(v.name));
  const bills = d.architecture === "microservices" ? priceK8sClouds(plan, d.book) : priceVmClouds(plan, fleet, d.book);
  const onprem = priceOnPrem(onpremPlan, piOnprem);
  const managedLines = { vercel: managedPlatform("vercel", d), lovable: managedPlatform("lovable", d) };

  const licences = (Object.keys(d.selections) as FilterKey[])
    .filter((k) => k !== "aiTooling")
    .map((k) => option(k, d.selections[k as Exclude<FilterKey, "aiTooling">]))
    .filter((o): o is NonNullable<typeof o> => !!o?.licenceAedMonth)
    .map((o) => ({ label: o.label, note: o.licenceNote ?? "", aed: o.licenceAedMonth ?? 0 }));
  const licenceAed = licences.reduce((a, l) => a + l.aed, 0);
  const drUplift = DR_UPLIFT[d.selections.dr] ?? 0;

  const sum = (ls: CostLine[]) => ls.reduce((a, l) => a + l.aed, 0);
  const platform: Record<Hosting, number> = {
    aws: bills[0].totalAed,
    azure: bills[1].totalAed,
    gcp: bills[2].totalAed,
    onprem: onprem.monthlyOpexAed,
    vercel: sum(managedLines.vercel),
    lovable: sum(managedLines.lovable),
  };
  const monthly = {} as Record<Hosting, number>;
  const common = {} as Record<Hosting, number>;
  const oneTimeInfra = {} as Record<Hosting, number>;
  const tco3 = {} as Record<Hosting, number>;
  const fit = {} as Record<Hosting, string[]>;
  for (const h of HOSTINGS) {
    common[h] = Math.round(COMMON_BASE_AED + OPS_FTE[h] * OPS_FTE_AED);
    monthly[h] = Math.round(platform[h] * (1 + drUplift) + licenceAed + common[h]);
    oneTimeInfra[h] = h === "onprem" ? Math.round(onprem.capexAed * (1 + drUplift)) : 0;
    tco3[h] = oneTimeInfra[h] + monthly[h] * 36;
    fit[h] = fitWarnings(h, d);
  }
  const reference: Hosting = d.hosting === "all" ? CLOUDS.reduce((a, b) => (monthly[a] <= monthly[b] ? a : b)) : d.hosting;

  const team = teamFor(d, reference);
  const labourAed = team.reduce((a, t) => a + t.aed, 0);
  const contingencyAed = Math.round(labourAed * 0.1);
  const devs = team.filter((t) => ["Backend", "Frontend", "Mobile", "DevOps"].includes(t.role)).reduce((a, t) => a + Math.ceil(t.fte), 0);
  const seatUsd = d.selections.aiTooling.reduce((a, id) => a + (AI_SEAT_USD[id] ?? 0), 0);
  const toolingAed = Math.round(seatUsd * devs * d.book.usdAed * Math.max(2, d.durationMonths));
  const deliveryAed = labourAed + contingencyAed + toolingAed;
  const phases = buildPhases(d, monthly[reference], deliveryAed);

  return { plan, onpremPlan, bills, onprem, managedLines, fit, licences, licenceAed, drUplift, common, monthly, platform, oneTimeInfra, tco3, team, labourAed, contingencyAed, toolingAed, deliveryAed, phases, reference };
}

function buildPhases(d: DeckInput, monthlyRun: number, deliveryAed: number): Phase[] {
  const s = d.selections;
  const total = Math.max(2, d.durationMonths);
  const mobile = s.mobile !== "none";
  const web = s.frontend !== "none";
  const defs = [
    { name: "Foundation", share: 0.2, infraFactor: 0.2, milestones: ["Discovery, BRD and UX sign-off", `Landing zone, ${labelOf("cicd", s.cicd)}, IAM and zero-trust baseline`, `${labelOf("sqlDb", s.sqlDb)} schema v1 and core services`] },
    { name: "Build", share: 0.45, infraFactor: 0.5, milestones: [web ? "Admin portal feature-complete" : "Core APIs feature-complete", mobile ? "Mobile apps in TestFlight / Play internal testing" : "Integration testing complete", "Production environment provisioned"] },
    { name: "Harden & launch", share: 0.2, infraFactor: 1, milestones: ["UAT sign-off and VAPT findings closed", `DR test passed (${labelOf("dr", s.dr)})`, mobile ? "Go-live: store release + admin live" : "Go-live"] },
    { name: "Operate & optimise", share: 0.15, infraFactor: 1, milestones: ["Hypercare exit", "v1.1 release", "Reserved-capacity purchase and handover"] },
  ];
  let cursor = 0;
  let allocated = 0;
  return defs.map((p, i) => {
    const months = i === defs.length - 1 ? Math.max(1, total - cursor) : Math.max(1, Math.round(total * p.share));
    const start = addMonths(d.startDate, cursor);
    cursor += months;
    const end = addMonths(d.startDate, cursor);
    end.setDate(end.getDate() - 1);
    const labour = i === defs.length - 1 ? deliveryAed - allocated : Math.round(deliveryAed * p.share);
    allocated += labour;
    const infra = Math.round(monthlyRun * months * p.infraFactor);
    return { ...p, start, end, months, labourAed: labour, infraAed: infra, totalAed: labour + infra };
  });
}

// ---------------------------------------------------------------- slides

export function buildDeck(d: DeckInput): Deck {
  const c = computeCosts(d);
  const s = d.selections;
  const all = d.hosting === "all";
  const H = c.reference;
  const arch = architectureLabel(d.architecture);
  const bill = CLOUDS.includes(H) ? c.bills[CLOUDS.indexOf(H)] : null;
  const goLive = c.phases[2]?.end ?? addMonths(d.startDate, d.durationMonths);
  const cheapest = HOSTINGS.reduce((a, b) => (c.monthly[a] <= c.monthly[b] ? a : b));
  const cloudMin = Math.min(...CLOUDS.map((h) => c.monthly[h]));
  const cloudMax = Math.max(...CLOUDS.map((h) => c.monthly[h]));
  const slides: Slide[] = [];
  const on = (k: SlideSection) => d.sections[k];
  const where = all ? `${SHORT[H]} (lowest-cost cloud)` : SHORT[H];

  const assumptions: string[] = [
    `Pricing: ${d.book.live ? "live" : "cached"} list prices${d.book.fetchedAt ? ` fetched ${d.book.fetchedAt.slice(0, 10)}` : ""}, USD 1 = AED ${d.book.usdAed}, on-demand, excl. 5% VAT.`,
    `Sizing: ${d.tps.toLocaleString()} peak TPS, ${d.services} ${d.architecture === "microservices" ? "services" : "application modules"}, ${d.users.toLocaleString()} users, HA ${d.haLevel}. Same engine as the Cost estimator tab.`,
    "Cloud data tier is sized as self-hosted nodes; switching to the managed services named on the stack slides changes cost by roughly ±15%.",
    "Vercel / Lovable: published plan prices, usage scaled by TPS; Supabase/Neon compute tier picked by TPS.",
    `DR uplift ${Math.round(c.drUplift * 100)}% of platform cost (${labelOf("dr", s.dr)}).`,
    `Common run cost: SMS OTP (15k), zero-trust access (15 seats), DevOps 0.5 FTE (0.25 FTE on Vercel / Lovable).`,
    ...(s.messaging === "none" && d.architecture === "microservices" ? ["Messaging set to None: cluster sizing still reserves a small broker in the data pool for async jobs."] : []),
    "Delivery day rates (AED): PM 2,200 · Architect 2,800 · Backend 1,800 · Mobile 1,700 · Frontend 1,500 · QA 1,200 · DevOps 1,900 · UX 1,500; 21 days/month; 10% contingency.",
  ];

  // Executive summary
  if (on("summary")) {
    slides.push({
      kicker: "Overview",
      title: all ? "Executive summary: all hosting options" : "Executive summary",
      blocks: [
        { kind: "kpis", items: all
          ? [
              { label: "Options compared", value: String(HOSTINGS.length), sub: "3 clouds, on-premise, Vercel, Lovable" },
              { label: "Lowest monthly", value: aed(c.monthly[cheapest]), sub: SHORT[cheapest] },
              { label: "Cloud range", value: `AED ${(cloudMin / 1000).toFixed(1)}k–${(cloudMax / 1000).toFixed(1)}k`, sub: "AWS / Azure / GCP per month" },
              { label: "Go-live", value: fmtDate(goLive), sub: "end of Harden & launch" },
            ]
          : [
              { label: "Target hosting", value: SHORT[H], sub: TARGET_LABEL[H] },
              { label: "Monthly run cost", value: aed(c.monthly[H]), sub: "platform + DR + licences + common" },
              { label: "One-time delivery", value: aedShort(c.deliveryAed + c.oneTimeInfra[H]), sub: `${d.durationMonths} months, ${c.team.reduce((a, t) => a + t.days, 0).toLocaleString()} man-days` },
              { label: "Go-live", value: fmtDate(goLive), sub: "end of Harden & launch" },
            ] },
        { kind: "cols",
          left: [{ kind: "bullets", items: [
            `${arch} platform${s.mobile !== "none" ? ` with ${labelOf("mobile", s.mobile)} mobile apps` : ""}${s.frontend !== "none" ? ` and a ${labelOf("frontend", s.frontend)} web/admin portal` : ""}.`,
            `Backend on ${labelOf("backend", s.backend)}; ${labelOf("sqlDb", s.sqlDb)} as system of record${s.noSql !== "none" ? `, ${labelOf("noSql", s.noSql)} for high-volume data` : ""}.`,
            `Clouds range ${aed(cloudMin)}–${aed(cloudMax)}/month; on-premise ${aed(c.monthly.onprem)}/month + ${aed(c.oneTimeInfra.onprem)} hardware.`,
            `Managed platforms: Vercel ${aed(c.monthly.vercel)}/month, Lovable ${aed(c.monthly.lovable)}/month.`,
          ] }],
          right: [{ kind: "bullets", items: all
            ? [
                `3-year hosting TCO: ${HOSTINGS.map((h) => `${SHORT[h]} ${aedShort(c.tco3[h])}`).join(" · ")}.`,
                `Roadmap and BoQ use ${where}.`,
                `Vercel / Lovable fit: ${c.fit.vercel.length + c.fit.lovable.length} caveats for this stack (see comparison).`,
              ]
            : [
                `3-year hosting TCO on ${SHORT[H]}: ${aedShort(c.tco3[H])}.`,
                c.licenceAed ? `Commercial licences add ${aed(c.licenceAed)}/month (${c.licences.map((l) => l.label).join(", ")}).` : "Open-source / cloud-native choices: no extra licence cost.",
                ...(c.fit[H].length ? [`Fit caveats on ${SHORT[H]}: ${c.fit[H].slice(0, 2).join(" ")}`] : [`No platform-fit caveats for this stack on ${SHORT[H]}.`]),
              ] }],
        },
      ],
    });
  }

  // Scope from description
  if (on("scope") && d.description.trim()) {
    const parts = d.description
      .split(/\n+|(?<=[.!?])\s+(?=[A-Z])/)
      .map((t) => t.trim().replace(/^[-•*]\s*/, ""))
      .filter(Boolean);
    const chunks: string[][] = [];
    for (let i = 0; i < parts.length; i += 9) chunks.push(parts.slice(i, i + 9));
    chunks.forEach((items, i) => slides.push({ kicker: "Scope", title: chunks.length > 1 ? `Scope as described (${i + 1}/${chunks.length})` : "Scope as described", blocks: [{ kind: "bullets", items }] }));
  }

  // Screenshots
  if (on("screens") && d.screenshots.length) {
    for (let i = 0; i < d.screenshots.length; i += 2) {
      slides.push({ kicker: "Screens submitted", title: `Application screens${d.screenshots.length > 2 ? ` (${i / 2 + 1}/${Math.ceil(d.screenshots.length / 2)})` : ""}`, blocks: [{ kind: "images", items: d.screenshots.slice(i, i + 2) }] });
    }
  }

  // Technology stack
  if (on("stack")) {
    const cols: Hosting[] = all ? HOSTINGS : [H, ...HOSTINGS.filter((h) => h !== H)];
    const rowsFor = (sections: string[]) =>
      FILTERS.filter((g) => sections.includes(g.section)).map((g) => {
        if (g.multi) {
          const v = s.aiTooling.map((id) => labelOf("aiTooling", id)).join(", ") || "None";
          return [g.label, v, ...cols.map(() => "same")];
        }
        const id = s[g.id as Exclude<FilterKey, "aiTooling">];
        return [g.label, labelOf(g.id, id), ...cols.map((h) => (id === "none" ? "—" : serviceName(g.id, id, h)))];
      });
    const headers = ["Layer", "Choice", ...cols.map((h, i) => (!all && i === 0 ? `On ${SHORT[h]} (target)` : SHORT[h]))];
    const widths = [1.5, 1.6, ...cols.map(() => 1.5)];
    slides.push({ kicker: "Technology stack", title: `Application and data (${arch})`, blocks: [{ kind: "table", headers, rows: rowsFor(["Application", "Data"]), widths }] });
    slides.push({ kicker: "Technology stack", title: "Network, platform and delivery", blocks: [{ kind: "table", headers, rows: rowsFor(["Network & edge", "Platform & operations", "Delivery"]), widths }] });
  }

  // Architecture
  if (on("architecture")) {
    const dh = all ? "generic" : H;
    slides.push({
      kicker: "Solution",
      title: all ? `Target architecture: ${arch} (provider-neutral)` : `Target architecture: ${arch} on ${SHORT[H]}`,
      blocks: [architectureSvg(d.architecture, dh, s), { kind: "note", text: all ? "Provider-neutral view; each option's service names are on the stack slides." : "Generated from the selected filters. Service names follow the target hosting; equivalents are on the stack slides." }],
    });
  }

  // Sizing
  if (on("sizing")) {
    if (isManaged(H)) {
      const lines = c.managedLines[H as "vercel" | "lovable"];
      slides.push({
        kicker: "Platform sizing",
        title: `${SHORT[H]} plan and tiers at ${d.tps.toLocaleString()} TPS`,
        blocks: [{ kind: "cols",
          left: [{ kind: "table", headers: ["Service", "Basis", "AED/mo"], rows: lines.map((l) => [l.label, l.note, aed(l.aed)]), total: ["Platform total", "", aed(c.platform[H])], widths: [2.2, 2.6, 1.1] }],
          right: [{ kind: "bullets", items: c.fit[H] }],
        }],
      });
    } else {
      const sized = H === "onprem" ? c.onpremPlan : c.plan;
      const nodes = sized.nodes.filter((n) => n.count > 0).map((n) => [n.role, String(n.count), String(n.vcpu), `${n.memoryGi} GB`, `${n.osDiskGi + n.dataDiskGi} GB`, clip(n.notes, 70)]);
      const inst = bill
        ? bill.instances.map((i) => [i.purpose, i.sku, String(i.qty), i.vcpu ? `${i.vcpu} / ${i.memoryGi} GB` : "managed"])
        : c.onprem.vmInventory.slice(0, 10).map((v) => [v.purpose, v.name, String(v.count), `${v.vcpu} / ${v.memoryGi} GB`]);
      slides.push({
        kicker: "Platform sizing",
        title: `Resource sizing at ${d.tps.toLocaleString()} TPS${all ? ` (${SHORT[H]} SKUs)` : ""}`,
        blocks: [
          { kind: "kpis", items: [
            { label: d.architecture === "microservices" ? "Pods" : "App instances", value: String(d.architecture === "microservices" ? sized.totalPods : sized.totalAppReplicas) },
            { label: "VMs / nodes", value: String(sized.vmCount) },
            { label: "CPU request", value: `${Math.round(sized.clusterCpuRequest)} vCPU` },
            { label: "Persistent storage", value: `${Math.round(sized.persistentStorageGi).toLocaleString()} GB` },
          ] },
          { kind: "cols",
            left: [{ kind: "table", headers: ["Node pool", "Count", "vCPU", "RAM", "Disk", "Notes"], rows: nodes, widths: [1.2, 0.6, 0.6, 0.8, 0.8, 2.0] }],
            right: [{ kind: "table", headers: bill ? ["Purpose", `${SHORT[H]} SKU`, "Qty", "vCPU / RAM"] : ["Purpose", "VM", "Qty", "vCPU / RAM"], rows: inst, widths: [2.2, 1.6, 0.6, 1.2] }],
          },
        ],
      });
    }
  }

  // Cost comparison (always all six options)
  if (on("costs")) {
    slides.push({
      kicker: "Cost comparison",
      title: "Monthly run cost by hosting option (AED)",
      blocks: [{ kind: "cols",
        left: [{ kind: "bars", items: HOSTINGS.map((h) => ({ label: SHORT[h], value: c.monthly[h], highlight: all ? h === cheapest : h === H })) }, { kind: "note", text: `${all ? "Highlighted = lowest monthly cost." : "Highlighted = target hosting."} On-premise excludes hardware capex (in the table).` }],
        right: [{ kind: "table", headers: ["Option", "Platform", "DR", "Licences", "Common", "Monthly", "One-time infra", "3-yr TCO"],
          rows: HOSTINGS.map((h) => [SHORT[h], aed(c.platform[h]), aed(c.platform[h] * c.drUplift), aed(c.licenceAed), aed(c.common[h]), aed(c.monthly[h]), aed(c.oneTimeInfra[h]), aedShort(c.tco3[h])]),
          widths: [0.9, 0.85, 0.7, 0.75, 0.75, 0.85, 0.85, 0.85] }],
      }],
    });
    const fitRows = HOSTINGS.map((h) => [SHORT[h], c.fit[h].length ? c.fit[h].join(" ") : "Runs this stack as selected."]);
    slides.push({
      kicker: "Comparison",
      title: "Fit for this stack: cloud vs on-premise vs managed platforms",
      blocks: [
        { kind: "table", headers: ["Option", "Scalability", "Control", "Ops overhead", "Data residency"], rows: [
          ["AWS / Azure / GCP", "Autoscaling nodes and pods, minutes", "Full: network, OS, DB tuning", "0.5 FTE DevOps", "AWS & Azure in UAE; GCP in Doha"],
          ["On-premise servers", "Bound by hardware; weeks to expand", "Total, incl. hardware", "0.5 FTE + hardware lifecycle", "UAE (own DC)"],
          ["Vercel / Lovable", "Automatic for web; limited for long-running backend", "Low: vendor runtime", "0.25 FTE", "Database outside UAE"],
        ], widths: [1.6, 2.4, 2.0, 1.6, 2.0] },
        { kind: "table", headers: ["Option", "Caveats for the selected stack"], rows: fitRows, widths: [1.2, 8.8] },
      ],
    });
  }

  // Roadmap
  if (on("roadmap")) {
    slides.push({
      kicker: "Roadmap",
      title: `Delivery roadmap: ${fmtDate(addMonths(d.startDate, 0))} to ${fmtDate(c.phases[c.phases.length - 1].end)}`,
      blocks: [
        { kind: "table", headers: ["Phase", "Window", "Milestones", "Delivery", "Infra", "Phase total"],
          rows: c.phases.map((p) => [p.name, `${fmtDate(p.start)} – ${fmtDate(p.end)}`, p.milestones.join(" · "), aed(p.labourAed), aed(p.infraAed), aed(p.totalAed)]),
          total: ["Total", "", "", aed(c.phases.reduce((a, p) => a + p.labourAed, 0)), aed(c.phases.reduce((a, p) => a + p.infraAed, 0)), aed(c.phases.reduce((a, p) => a + p.totalAed, 0))],
          widths: [1.4, 2.2, 5.0, 1.2, 1.1, 1.2] },
        { kind: "note", text: `Delivery = labour + 10% contingency + AI tooling, split by phase share. Infra (${where}) ramps from 20% to 100% of run cost after launch.` },
      ],
    });
  }

  // Security
  if (on("security")) {
    const idp = serviceName("identity", s.identity, all ? "generic" : H);
    const vault = serviceName("secrets", s.secrets, all ? "generic" : H);
    const waf = s.cdnWaf === "none" ? "WAF on the load balancer" : serviceName("cdnWaf", s.cdnWaf, all ? "generic" : H);
    slides.push({
      kicker: "Security",
      title: "Zero-trust, secrets and controls",
      blocks: [{ kind: "cols",
        left: [{ kind: "bullets", items: [
          `Identity: ${idp} with SSO and phishing-resistant MFA; just-in-time admin elevation.`,
          "Admin tools behind an identity-aware proxy; no public admin URLs, no shared VPN.",
          d.architecture === "microservices" ? "Workload identity + mTLS between services; default-deny network policies." : "Tier-to-tier security groups; app tier reachable only from the load balancer.",
          `Edge: ${waf}; DDoS protection; TLS 1.2+.`,
        ] }],
        right: [{ kind: "bullets", items: [
          `Secrets and keys in ${vault}; rotation 30–90 days; nothing in Git or images.`,
          "Passwords: Argon2id, breached-password check, OTP / passkeys for users.",
          `Encryption at rest (customer-managed keys where offered) for ${labelOf("sqlDb", s.sqlDb)}${s.noSql !== "none" ? ` and ${labelOf("noSql", s.noSql)}` : ""}.`,
          "SAST, DAST, dependency and image scanning in CI; third-party VAPT before go-live.",
        ] }],
      }],
    });
  }

  // BoQ
  if (on("boq")) {
    const oneTime = {
      kind: "table" as const,
      headers: ["One-time", "AED"],
      rows: [
        ...c.team.map((t) => [`${t.role} (${t.days.toLocaleString()} days)`, aed(t.aed)]),
        ["Contingency 10%", aed(c.contingencyAed)],
        [`AI coding tools (${s.aiTooling.map((id) => labelOf("aiTooling", id)).join(", ") || "none"})`, aed(c.toolingAed)],
        ...(c.oneTimeInfra[H] ? [["Hardware capex", aed(c.oneTimeInfra[H])]] : []),
      ],
      total: ["Total one-time", aed(c.deliveryAed + c.oneTimeInfra[H])],
      widths: [3.6, 1.4],
    };
    let recurring: Block;
    if (all) {
      recurring = { kind: "table", headers: ["Option", "Monthly", "Annual", "One-time infra", "3-yr TCO"], rows: HOSTINGS.map((h) => [SHORT[h], aed(c.monthly[h]), aed(c.monthly[h] * 12), aed(c.oneTimeInfra[h]), aed(c.tco3[h])]), widths: [1.2, 1.1, 1.2, 1.1, 1.2] };
    } else {
      const lines: string[][] = isManaged(H)
        ? c.managedLines[H as "vercel" | "lovable"].map((l) => ["platform", l.note ? `${l.label} — ${l.note}` : l.label, "1", aed(l.aed * (1 + c.drUplift))])
        : bill
          ? bill.lines.map((l) => [l.category, l.sku, l.qty ? String(l.qty) : "1", aed(l.aedMonth * (1 + c.drUplift))])
          : c.onprem.lines.filter((l) => l.aedMonth > 0).map((l) => [l.category, l.sku, String(l.qty), aed(l.aedMonth * (1 + c.drUplift))]);
      c.licences.forEach((l) => lines.push(["licence", `${l.label} — ${l.note}`, "1", aed(l.aed)]));
      lines.push(["common", `SMS OTP, zero-trust access, ${OPS_FTE[H]} FTE DevOps`, "1", aed(c.common[H])]);
      const shown = lines.slice(0, 14);
      const rest = lines.slice(14);
      if (rest.length) shown.push(["other", `${rest.length} further lines`, "", aed(rest.reduce((a, r) => a + Number(r[3].replace(/[^0-9]/g, "")), 0))]);
      recurring = { kind: "table", headers: ["Type", "Line (incl. DR uplift)", "Qty", "AED/mo"], rows: shown, total: ["", "Total recurring", "", aed(c.monthly[H])], widths: [0.9, 3.4, 0.5, 1.1] };
    }
    slides.push({
      kicker: "Commercials",
      title: all ? `Bill of quantities: all options (delivery on ${SHORT[H]})` : `Bill of quantities (${SHORT[H]})`,
      blocks: [{ kind: "cols", left: [recurring], right: [oneTime] }],
    });
  }

  // Assumptions
  if (on("assumptions")) {
    slides.push({
      kicker: "Basis of estimate",
      title: "Assumptions and next steps",
      blocks: [{ kind: "cols",
        left: [{ kind: "bullets", items: assumptions }],
        right: [{ kind: "bullets", items: [
          "Confirm volumes, features and screens; any change re-runs this deck.",
          "Confirm data-residency rules (UAE-only DR favours Azure UAE North + UAE Central or on-premise).",
          "Validate managed-service and platform prices in the provider calculators.",
          `Kick-off ${fmtDate(addMonths(d.startDate, 0))}; go-live target ${fmtDate(goLive)}.`,
          ...c.plan.assumptions.slice(0, 2),
        ] }],
      }],
    });
  }

  const name = d.projectName.trim() || "Platform";
  return {
    title: `${name}: cost estimation & solution`,
    subtitle: `${arch} · ${all ? TARGET_LABEL.all : TARGET_LABEL[H]}${d.clientName.trim() ? ` · prepared for ${d.clientName.trim()}` : ""}`,
    meta: `Prices ${d.book.fetchedAt ? d.book.fetchedAt.slice(0, 10) : "cached"} · USD 1 = AED ${d.book.usdAed} · excl. VAT`,
    footer: `${name} · ${d.vendorName.trim() || "SoftEstimator"}`,
    slides,
    costs: c,
    reference: H,
  };
}
