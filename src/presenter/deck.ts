import { architectureLabel, type ArchitectureStyle } from "../architecture";
import { estimateCapacity } from "../engine/estimate";
import { priceOnPrem } from "../engine/onprem";
import { priceK8sClouds, priceVmClouds } from "../engine/pricing";
import type { CapacityPlan, CloudBill, LivePriceBook, OnPremBill, PlannerInputs } from "../engine/types";
import { buildVmFleet } from "../engine/vmFleet";
import { DR_UPLIFT, FILTERS, HOSTING_LABEL, option, serviceName, type FilterKey, type Hosting, type Selections, type SlideSection } from "./catalog";
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
  hosting: Hosting;
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
}

// ---------------------------------------------------------------- formatting

export const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-US")}`;
const aedShort = (n: number) => (Math.abs(n) >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(2)}M` : aed(n));
const HOSTINGS: Hosting[] = ["aws", "azure", "gcp", "onprem"];
const SHORT: Record<Hosting, string> = { aws: "AWS", azure: "Azure", gcp: "GCP", onprem: "On-premise" };

function addMonths(iso: string, months: number) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}
const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// ---------------------------------------------------------------- costs

const RATES = { PM: 2200, Architect: 2800, Backend: 1800, Frontend: 1500, Mobile: 1700, QA: 1200, DevOps: 1900, UX: 1500 } as const;
type Role = keyof typeof RATES;
const AI_SEAT_USD: Record<string, number> = { cursor: 40, "claude-code": 150, copilot: 19 };
const COMMON_AED = 15000 * 0.18 + 15 * 7 * 3.6725 + 0.5 * 24000; // SMS OTP, zero-trust seats, 0.5 FTE DevOps

export interface Costs {
  plan: CapacityPlan;
  bills: CloudBill[];
  onprem: OnPremBill;
  licences: { label: string; note: string; aed: number }[];
  licenceAed: number;
  drUplift: number;
  commonAed: number;
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

function plannerInputs(d: DeckInput): PlannerInputs {
  const s = d.selections;
  return {
    architectureStyle: d.architecture,
    tps: Math.max(1, d.tps),
    springBootServices: Math.max(1, d.services),
    messaging: s.messaging === "kafka" ? "kafka" : "rabbitmq",
    observability: s.observability === "elk" ? "elk" : "prometheus",
    visualization: "grafana",
    includeKonga: s.apiGateway === "kong",
    includeLonghorn: d.hosting === "onprem",
    includeArgoCd: d.architecture === "microservices",
    includeJenkins: s.cicd === "jenkins",
    includeCicdPipeline: false,
    includeHarbor: d.hosting === "onprem",
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

function teamFor(d: DeckInput) {
  const s = d.selections;
  const fte: Partial<Record<Role, number>> = {
    PM: 0.5,
    Architect: 0.5,
    Backend: Math.max(2, Math.ceil(d.services / 4)),
    Frontend: s.frontend === "none" ? 0 : 1,
    Mobile: s.mobile === "none" ? 0 : s.mobile === "native" ? 2 : 1.5,
    QA: 1,
    DevOps: d.architecture === "microservices" || d.hosting === "onprem" ? 1 : 0.5,
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

export function computeCosts(d: DeckInput): Costs {
  const pi = plannerInputs(d);
  const plan = estimateCapacity(pi);
  // The engine always models a broker; drop it from the VM fleet when the filters say no messaging.
  const fleet = buildVmFleet(plan).filter((v) => d.selections.messaging !== "none" || !/rabbit|kafka/i.test(v.name));
  const bills = d.architecture === "microservices" ? priceK8sClouds(plan, d.book) : priceVmClouds(plan, fleet, d.book);
  const onprem = priceOnPrem(plan, pi);

  const licences = (Object.keys(d.selections) as FilterKey[])
    .filter((k) => k !== "aiTooling")
    .map((k) => option(k, d.selections[k as Exclude<FilterKey, "aiTooling">]))
    .filter((o): o is NonNullable<typeof o> => !!o?.licenceAedMonth)
    .map((o) => ({ label: o.label, note: o.licenceNote ?? "", aed: o.licenceAedMonth ?? 0 }));
  const licenceAed = licences.reduce((a, l) => a + l.aed, 0);
  const drUplift = DR_UPLIFT[d.selections.dr] ?? 0;

  const platform = {
    aws: bills[0].totalAed,
    azure: bills[1].totalAed,
    gcp: bills[2].totalAed,
    onprem: onprem.monthlyOpexAed,
  } as Record<Hosting, number>;
  const monthly = {} as Record<Hosting, number>;
  const oneTimeInfra = {} as Record<Hosting, number>;
  const tco3 = {} as Record<Hosting, number>;
  for (const h of HOSTINGS) {
    monthly[h] = Math.round(platform[h] * (1 + drUplift) + licenceAed + COMMON_AED);
    oneTimeInfra[h] = h === "onprem" ? Math.round(onprem.capexAed * (1 + drUplift)) : 0;
    tco3[h] = oneTimeInfra[h] + monthly[h] * 36;
  }

  const team = teamFor(d);
  const labourAed = team.reduce((a, t) => a + t.aed, 0);
  const contingencyAed = Math.round(labourAed * 0.1);
  const devs = team.filter((t) => ["Backend", "Frontend", "Mobile", "DevOps"].includes(t.role)).reduce((a, t) => a + Math.ceil(t.fte), 0);
  const seatUsd = d.selections.aiTooling.reduce((a, id) => a + (AI_SEAT_USD[id] ?? 0), 0);
  const toolingAed = Math.round(seatUsd * devs * d.book.usdAed * Math.max(2, d.durationMonths));
  const deliveryAed = labourAed + contingencyAed + toolingAed;

  const phases = buildPhases(d, monthly[d.hosting], labourAed + contingencyAed + toolingAed);
  return { plan, bills, onprem, licences, licenceAed, drUplift, commonAed: Math.round(COMMON_AED), monthly, platform, oneTimeInfra, tco3, team, labourAed, contingencyAed, toolingAed, deliveryAed, phases };
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

const labelOf = (k: FilterKey, id: string) => option(k, id)?.label ?? id;
const clip = (t: string, n: number) => (t.length <= n ? t : `${t.slice(0, t.lastIndexOf(" ", n)).replace(/[.,;:]$/, "")}…`);

// ---------------------------------------------------------------- slides

export function buildDeck(d: DeckInput): Deck {
  const c = computeCosts(d);
  const s = d.selections;
  const H = d.hosting;
  const arch = architectureLabel(d.architecture);
  const target = HOSTING_LABEL[H];
  const bill = H === "onprem" ? null : c.bills[HOSTINGS.indexOf(H)];
  const goLive = c.phases[2]?.end ?? addMonths(d.startDate, d.durationMonths);
  const cheapestCloud = (["aws", "azure", "gcp"] as Hosting[]).reduce((a, b) => (c.monthly[a] <= c.monthly[b] ? a : b));
  const slides: Slide[] = [];
  const on = (k: SlideSection) => d.sections[k];
  const assumptions: string[] = [
    `Pricing: ${d.book.live ? "live" : "cached"} list prices${d.book.fetchedAt ? ` fetched ${d.book.fetchedAt.slice(0, 10)}` : ""}, USD 1 = AED ${d.book.usdAed}, on-demand, excl. 5% VAT.`,
    `Sizing: ${d.tps.toLocaleString()} peak TPS, ${d.services} ${d.architecture === "microservices" ? "services" : "application modules"}, ${d.users.toLocaleString()} users, HA ${d.haLevel}. Same engine as the Cost estimator tab.`,
    "Data tier is sized as self-hosted nodes in the capacity engine; switching to the managed services named on the stack slide changes cost by roughly ±15%.",
    `DR uplift ${Math.round(c.drUplift * 100)}% of platform cost (${labelOf("dr", s.dr)}).`,
    ...(s.messaging === "none" && d.architecture === "microservices" ? ["Messaging set to None: the cluster sizing still reserves a small broker in the data pool for async jobs."] : []),
    `Common run cost ${aed(c.commonAed)}/month: SMS OTP (15k), zero-trust access (15 seats), 0.5 FTE DevOps.`,
    "Delivery day rates (AED): PM 2,200 · Architect 2,800 · Backend 1,800 · Mobile 1,700 · Frontend 1,500 · QA 1,200 · DevOps 1,900 · UX 1,500; 21 days/month; 10% contingency.",
  ];

  if (on("summary")) {
    slides.push({
      kicker: "Overview",
      title: "Executive summary",
      blocks: [
        { kind: "kpis", items: [
          { label: "Target hosting", value: SHORT[H], sub: target },
          { label: "Monthly run cost", value: aed(c.monthly[H]), sub: "platform + DR + licences + common" },
          { label: "One-time delivery", value: aedShort(c.deliveryAed + c.oneTimeInfra[H]), sub: `${d.durationMonths} months, ${c.team.reduce((a, t) => a + t.days, 0).toLocaleString()} man-days` },
          { label: "Go-live", value: fmtDate(goLive), sub: "end of Harden & launch" },
        ] },
        { kind: "cols",
          left: [{ kind: "bullets", items: [
            `${arch} platform${s.mobile !== "none" ? ` with ${labelOf("mobile", s.mobile)} mobile apps` : ""}${s.frontend !== "none" ? ` and a ${labelOf("frontend", s.frontend)} web/admin portal` : ""}.`,
            `Backend on ${labelOf("backend", s.backend)}; ${labelOf("sqlDb", s.sqlDb)} as system of record${s.noSql !== "none" ? `, ${labelOf("noSql", s.noSql)} for high-volume data` : ""}.`,
            `Clouds range ${aed(Math.min(c.monthly.aws, c.monthly.azure, c.monthly.gcp))}–${aed(Math.max(c.monthly.aws, c.monthly.azure, c.monthly.gcp))}/month; cheapest is ${SHORT[cheapestCloud]}.`,
          ] }],
          right: [{ kind: "bullets", items: [
            `3-year hosting TCO on ${SHORT[H]}: ${aedShort(c.tco3[H])}.`,
            `On-premise 3-year TCO: ${aedShort(c.tco3.onprem)} incl. ${aed(c.oneTimeInfra.onprem)} hardware.`,
            c.licenceAed ? `Commercial licences add ${aed(c.licenceAed)}/month (${c.licences.map((l) => l.label).join(", ")}).` : "Open-source / cloud-native choices: no extra licence cost.",
          ] }],
        },
      ],
    });
  }

  if (on("scope") && d.description.trim()) {
    const parts = d.description
      .split(/\n+|(?<=[.!?])\s+(?=[A-Z])/)
      .map((t) => t.trim().replace(/^[-•*]\s*/, ""))
      .filter(Boolean);
    const chunks: string[][] = [];
    for (let i = 0; i < parts.length; i += 9) chunks.push(parts.slice(i, i + 9));
    chunks.forEach((items, i) => slides.push({ kicker: "Scope", title: chunks.length > 1 ? `Scope as described (${i + 1}/${chunks.length})` : "Scope as described", blocks: [{ kind: "bullets", items }] }));
  }

  if (on("screens") && d.screenshots.length) {
    for (let i = 0; i < d.screenshots.length; i += 2) {
      slides.push({ kicker: "Screens submitted", title: `Application screens${d.screenshots.length > 2 ? ` (${i / 2 + 1}/${Math.ceil(d.screenshots.length / 2)})` : ""}`, blocks: [{ kind: "images", items: d.screenshots.slice(i, i + 2) }] });
    }
  }

  if (on("stack")) {
    const others = HOSTINGS.filter((h) => h !== H);
    const rowsFor = (sections: string[]) =>
      FILTERS.filter((g) => sections.includes(g.section)).map((g) => {
        if (g.multi) {
          const v = s.aiTooling.map((id) => labelOf("aiTooling", id)).join(", ") || "None";
          return [g.label, v, v, ...others.map(() => "")];
        }
        const id = s[g.id as Exclude<FilterKey, "aiTooling">];
        return [g.label, labelOf(g.id, id), id === "none" ? "—" : serviceName(g.id, id, H), ...others.map((h) => (id === "none" ? "—" : serviceName(g.id, id, h)))];
      });
    const headers = ["Layer", "Choice", `On ${SHORT[H]}`, ...others.map((h) => SHORT[h])];
    const widths = [2.0, 2.2, 2.4, 2.0, 2.0, 2.0];
    slides.push({ kicker: "Technology stack", title: `Application and data (${arch})`, blocks: [{ kind: "table", headers, rows: rowsFor(["Application", "Data"]), widths }] });
    slides.push({ kicker: "Technology stack", title: "Network, platform and delivery", blocks: [{ kind: "table", headers, rows: rowsFor(["Network & edge", "Platform & operations", "Delivery"]), widths }] });
  }

  if (on("architecture")) {
    const svg = architectureSvg(d.architecture, H, s);
    slides.push({ kicker: "Solution", title: `Target architecture: ${arch} on ${SHORT[H]}`, blocks: [svg, { kind: "note", text: "Generated from the selected filters. Service names follow the target hosting; equivalents are on the stack slides." }] });
  }

  if (on("sizing")) {
    const nodes = c.plan.nodes.filter((n) => n.count > 0).map((n) => [n.role, String(n.count), String(n.vcpu), `${n.memoryGi} GB`, `${n.osDiskGi + n.dataDiskGi} GB`, clip(n.notes, 70)]);
    const inst = bill
      ? bill.instances.map((i) => [i.purpose, i.sku, String(i.qty), i.vcpu ? `${i.vcpu} / ${i.memoryGi} GB` : "managed"])
      : c.onprem.vmInventory.slice(0, 10).map((v) => [v.purpose, v.name, String(v.count), `${v.vcpu} / ${v.memoryGi} GB`]);
    slides.push({
      kicker: "Platform sizing",
      title: `Resource sizing at ${d.tps.toLocaleString()} TPS`,
      blocks: [
        { kind: "kpis", items: [
          { label: d.architecture === "microservices" ? "Pods" : "App instances", value: String(d.architecture === "microservices" ? c.plan.totalPods : c.plan.totalAppReplicas) },
          { label: "VMs / nodes", value: String(c.plan.vmCount) },
          { label: "CPU request", value: `${Math.round(c.plan.clusterCpuRequest)} vCPU` },
          { label: "Persistent storage", value: `${Math.round(c.plan.persistentStorageGi).toLocaleString()} GB` },
        ] },
        { kind: "cols",
          left: [{ kind: "table", headers: ["Node pool", "Count", "vCPU", "RAM", "Disk", "Notes"], rows: nodes, widths: [1.2, 0.6, 0.6, 0.8, 0.8, 2.0] }],
          right: [{ kind: "table", headers: bill ? ["Purpose", `${SHORT[H]} SKU`, "Qty", "vCPU / RAM"] : ["Purpose", "VM", "Qty", "vCPU / RAM"], rows: inst, widths: [2.2, 1.6, 0.6, 1.2] }],
        },
      ],
    });
  }

  if (on("costs")) {
    slides.push({
      kicker: "Cost comparison",
      title: "Monthly run cost by hosting option (AED)",
      blocks: [{ kind: "cols",
        left: [{ kind: "bars", items: HOSTINGS.map((h) => ({ label: SHORT[h], value: c.monthly[h], highlight: h === H })) }, { kind: "note", text: "Highlighted bar = target hosting. On-premise excludes hardware capex (shown in the table)." }],
        right: [{ kind: "table", headers: ["Option", "Platform", "DR", "Licences", "Common", "Monthly", "One-time infra", "3-yr TCO"],
          rows: HOSTINGS.map((h) => [SHORT[h], aed(c.platform[h]), aed(c.platform[h] * c.drUplift), aed(c.licenceAed), aed(c.commonAed), aed(c.monthly[h]), aed(c.oneTimeInfra[h]), aedShort(c.tco3[h])]),
          widths: [0.9, 0.85, 0.7, 0.75, 0.75, 0.85, 0.85, 0.85] }],
      }],
    });
  }

  if (on("roadmap")) {
    slides.push({
      kicker: "Roadmap",
      title: `Delivery roadmap: ${fmtDate(addMonths(d.startDate, 0))} to ${fmtDate(c.phases[c.phases.length - 1].end)}`,
      blocks: [
        { kind: "table", headers: ["Phase", "Window", "Milestones", "Delivery", "Infra", "Phase total"],
          rows: c.phases.map((p) => [p.name, `${fmtDate(p.start)} – ${fmtDate(p.end)}`, p.milestones.join(" · "), aed(p.labourAed), aed(p.infraAed), aed(p.totalAed)]),
          total: ["Total", "", "", aed(c.phases.reduce((a, p) => a + p.labourAed, 0)), aed(c.phases.reduce((a, p) => a + p.infraAed, 0)), aed(c.phases.reduce((a, p) => a + p.totalAed, 0))],
          widths: [1.4, 2.2, 5.0, 1.2, 1.1, 1.2] },
        { kind: "note", text: "Delivery = labour + 10% contingency + AI tooling, split by phase share. Infra ramps from 20% (non-prod) to 100% of run cost after launch." },
      ],
    });
  }

  if (on("security")) {
    const idp = serviceName("identity", s.identity, H);
    const vault = serviceName("secrets", s.secrets, H);
    const waf = s.cdnWaf === "none" ? "WAF on the load balancer" : serviceName("cdnWaf", s.cdnWaf, H);
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
          `Encryption at rest (customer-managed keys) for ${labelOf("sqlDb", s.sqlDb)}${s.noSql !== "none" ? ` and ${labelOf("noSql", s.noSql)}` : ""}.`,
          "SAST, DAST, dependency and image scanning in CI; third-party VAPT before go-live.",
        ] }],
      }],
    });
  }

  if (on("boq")) {
    const lines: string[][] = bill
      ? bill.lines.map((l) => [l.category, l.sku, l.qty ? String(l.qty) : "1", aed(l.aedMonth * (1 + c.drUplift))])
      : c.onprem.lines.filter((l) => l.aedMonth > 0).map((l) => [l.category, l.sku, String(l.qty), aed(l.aedMonth * (1 + c.drUplift))]);
    c.licences.forEach((l) => lines.push(["licence", `${l.label} — ${l.note}`, "1", aed(l.aed)]));
    lines.push(["common", "SMS OTP, zero-trust access, 0.5 FTE DevOps", "1", aed(c.commonAed)]);
    const shown = lines.slice(0, 14);
    const rest = lines.slice(14);
    if (rest.length) shown.push(["other", `${rest.length} further lines`, "", aed(rest.reduce((a, r) => a + Number(r[3].replace(/[^0-9]/g, "")), 0))]);
    slides.push({
      kicker: "Commercials",
      title: `Bill of quantities (${SHORT[H]})`,
      blocks: [{ kind: "cols",
        left: [{ kind: "table", headers: ["Type", "Line (incl. DR uplift)", "Qty", "AED/mo"], rows: shown, total: ["", "Total recurring", "", aed(c.monthly[H])], widths: [0.9, 3.4, 0.5, 1.1] }],
        right: [{ kind: "table", headers: ["One-time", "AED"], rows: [
          ...c.team.map((t) => [`${t.role} (${t.days.toLocaleString()} days)`, aed(t.aed)]),
          ["Contingency 10%", aed(c.contingencyAed)],
          [`AI coding tools (${s.aiTooling.map((id) => labelOf("aiTooling", id)).join(", ") || "none"})`, aed(c.toolingAed)],
          ...(c.oneTimeInfra[H] ? [["Hardware capex", aed(c.oneTimeInfra[H])]] : []),
        ], total: ["Total one-time", aed(c.deliveryAed + c.oneTimeInfra[H])], widths: [3.6, 1.4] }],
      }],
    });
  }

  if (on("assumptions")) {
    slides.push({
      kicker: "Basis of estimate",
      title: "Assumptions and next steps",
      blocks: [{ kind: "cols",
        left: [{ kind: "bullets", items: assumptions }],
        right: [{ kind: "bullets", items: [
          "Confirm volumes, features and screens; any change re-runs this deck.",
          "Confirm data-residency rules (UAE-only DR favours Azure UAE North + UAE Central).",
          "Validate managed-service prices in the provider calculator.",
          `Kick-off ${fmtDate(addMonths(d.startDate, 0))}; go-live target ${fmtDate(goLive)}.`,
          ...c.plan.assumptions.slice(0, 2),
        ] }],
      }],
    });
  }

  const name = d.projectName.trim() || "Platform";
  return {
    title: `${name}: cost estimation & solution`,
    subtitle: `${arch} · ${target}${d.clientName.trim() ? ` · prepared for ${d.clientName.trim()}` : ""}`,
    meta: `Prices ${d.book.fetchedAt ? d.book.fetchedAt.slice(0, 10) : "cached"} · USD 1 = AED ${d.book.usdAed} · excl. VAT`,
    footer: `${name} · ${d.vendorName.trim() || "SoftEstimator"}`,
    slides,
    costs: c,
  };
}
