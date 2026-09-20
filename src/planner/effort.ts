import type { EffortLine, EffortPlan, EffortRole, PlannerBrief } from "./types";

const HOURS_PER_DAY = 8;
const UTILISATION = 0.8;
const CONTINGENCY = 0.1;

function round(n: number, d = 1) {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

function money(n: number) {
  return Math.round(n);
}

export function buildEffort(
  brief: PlannerBrief,
  modules: string[],
  months: number,
  users: number,
  vendor: string
): EffortPlan {
  const calendarWeeks = months * 4;
  const userScale = Math.min(2, Math.max(0.7, users / 500));
  const modScale = Math.min(2.2, Math.max(0.85, 0.7 + modules.length * 0.18));
  const buildWeeks = Math.max(4, calendarWeeks - 10);
  const micro = brief.architectureStyle !== "monolith-3tier";
  const overrides = brief.rateCard ?? {};
  const rate = (id: string) => {
    const n = Number(overrides[id]);
    const fallback: Record<string, number> = { DL: 450, SA: 550, SE: 380, EN: 280, QA: 250, BA: 320, DO: 360, SEC: 500, UX: 300 };
    return Math.max(1, Math.round(Number.isFinite(n) && n > 0 ? n : fallback[id] ?? 300));
  };
  const phases = [
    { id: "M0", name: "Discovery / initiate", weeks: 2 },
    { id: "M1", name: "Architecture freeze", weeks: 2 },
    { id: "BLD", name: "Build increments", weeks: buildWeeks },
    { id: "TST", name: "SIT / security / NFR", weeks: 2 },
    { id: "UAT", name: "UAT and training", weeks: 2 },
    { id: "GL", name: "Go-live and hypercare", weeks: 2 },
  ];

  const roles: EffortRole[] = [
    { id: "DL", role: "Delivery lead", discipline: "Management", aedPerHour: rate("DL"), aedPerDay: rate("DL") * HOURS_PER_DAY, notes: "Steering, RAID, commercial. GST business hours." },
    { id: "SA", role: "Solution architect", discipline: "Architecture", aedPerHour: rate("SA"), aedPerDay: rate("SA") * HOURS_PER_DAY, notes: "HLD/LLD freeze, ADRs, reviews." },
    { id: "SE", role: "Senior engineer", discipline: "Engineering", aedPerHour: rate("SE"), aedPerDay: rate("SE") * HOURS_PER_DAY, notes: micro ? "Design authority on services and data." : "Design authority on the monolith and data model." },
    { id: "EN", role: "Engineer", discipline: "Engineering", aedPerHour: rate("EN"), aedPerDay: rate("EN") * HOURS_PER_DAY, notes: micro ? "Implementation, APIs, tests in code." : "Full-stack implementation in one application binary." },
    { id: "QA", role: "QA engineer", discipline: "Quality", aedPerHour: rate("QA"), aedPerDay: rate("QA") * HOURS_PER_DAY, notes: "Functional, integration, UAT support." },
    { id: "BA", role: "Business analyst", discipline: "Analysis", aedPerHour: rate("BA"), aedPerDay: rate("BA") * HOURS_PER_DAY, notes: "Workshops, backlog, UAT scripts." },
    { id: "DO", role: "DevOps / platform", discipline: "Platform", aedPerHour: rate("DO"), aedPerDay: rate("DO") * HOURS_PER_DAY, notes: micro ? "CI, environments, Kubernetes, IaC." : "CI, environments, VMs, reverse proxy, systemd/IIS. Not Kubernetes." },
    { id: "SEC", role: "Security engineer", discipline: "Security", aedPerHour: rate("SEC"), aedPerDay: rate("SEC") * HOURS_PER_DAY, notes: "RBAC, threat model, VA/PT liaison." },
    { id: "UX", role: "UX / UI", discipline: "Experience", aedPerHour: rate("UX"), aedPerDay: rate("UX") * HOURS_PER_DAY, notes: "Wireframes to Figma, bilingual UI." },
  ];

  const fteOf = (roleId: string, phaseId: string) => {
    const map: Record<string, Record<string, number>> = micro
      ? {
          DL: { M0: 0.5, M1: 0.5, BLD: 0.4, TST: 0.4, UAT: 0.5, GL: 0.6 },
          SA: { M0: 0.8, M1: 1, BLD: 0.3, TST: 0.25, UAT: 0.15, GL: 0.1 },
          SE: { M0: 0.3, M1: 0.6, BLD: 1.4 * modScale, TST: 0.8, UAT: 0.4, GL: 0.3 },
          EN: { M0: 0.2, M1: 0.4, BLD: 2.1 * modScale * userScale, TST: 1.1, UAT: 0.5, GL: 0.4 },
          QA: { M0: 0.2, M1: 0.4, BLD: 1.0 * modScale, TST: 1.6, UAT: 1.2, GL: 0.4 },
          BA: { M0: 1, M1: 0.8, BLD: 0.55, TST: 0.4, UAT: 1, GL: 0.3 },
          DO: { M0: 0.3, M1: 0.7, BLD: 0.5 * userScale, TST: 0.7, UAT: 0.3, GL: 0.8 },
          SEC: { M0: 0.2, M1: 0.5, BLD: 0.2, TST: 0.8, UAT: 0.2, GL: 0.15 },
          UX: { M0: 0.6, M1: 0.9, BLD: 0.35, TST: 0.15, UAT: 0.25, GL: 0.1 },
        }
      : {
          DL: { M0: 0.5, M1: 0.4, BLD: 0.35, TST: 0.35, UAT: 0.45, GL: 0.55 },
          SA: { M0: 0.7, M1: 0.9, BLD: 0.25, TST: 0.2, UAT: 0.1, GL: 0.1 },
          SE: { M0: 0.4, M1: 0.7, BLD: 1.1 * modScale, TST: 0.6, UAT: 0.35, GL: 0.25 },
          EN: { M0: 0.2, M1: 0.3, BLD: 1.35 * modScale * userScale, TST: 0.8, UAT: 0.4, GL: 0.3 },
          QA: { M0: 0.2, M1: 0.3, BLD: 0.8 * modScale, TST: 1.4, UAT: 1.1, GL: 0.35 },
          BA: { M0: 1, M1: 0.8, BLD: 0.5, TST: 0.35, UAT: 1, GL: 0.3 },
          DO: { M0: 0.25, M1: 0.45, BLD: 0.28 * userScale, TST: 0.4, UAT: 0.25, GL: 0.5 },
          SEC: { M0: 0.2, M1: 0.4, BLD: 0.15, TST: 0.7, UAT: 0.2, GL: 0.15 },
          UX: { M0: 0.6, M1: 0.8, BLD: 0.3, TST: 0.15, UAT: 0.25, GL: 0.1 },
        };
    return round(map[roleId]?.[phaseId] ?? 0, 2);
  };

  const lines: EffortLine[] = [];
  for (const ph of phases) {
    for (const r of roles) {
      const fte = fteOf(r.id, ph.id);
      if (fte <= 0) continue;
      const manDays = round(ph.weeks * 5 * fte * UTILISATION, 1);
      const hours = round(manDays * HOURS_PER_DAY, 1);
      lines.push({
        phaseId: ph.id,
        phase: ph.name,
        weeks: ph.weeks,
        roleId: r.id,
        role: r.role,
        fte,
        utilisation: UTILISATION,
        manDays,
        hours,
        aedPerHour: r.aedPerHour,
        costAed: money(hours * r.aedPerHour),
      });
    }
  }

  const hours = round(lines.reduce((s, l) => s + l.hours, 0), 1);
  const manDays = round(lines.reduce((s, l) => s + l.manDays, 0), 1);
  const costAed = money(lines.reduce((s, l) => s + l.costAed, 0));
  const contingencyHours = round(hours * CONTINGENCY, 1);
  const avgRate = hours ? costAed / hours : 0;
  const contingencyAed = money(contingencyHours * avgRate);

  const byPhase = phases.map((ph) => {
    const set = lines.filter((l) => l.phaseId === ph.id);
    return {
      phaseId: ph.id,
      phase: ph.name,
      weeks: ph.weeks,
      hours: round(set.reduce((s, l) => s + l.hours, 0), 1),
      manDays: round(set.reduce((s, l) => s + l.manDays, 0), 1),
      costAed: money(set.reduce((s, l) => s + l.costAed, 0)),
    };
  });

  const byRole = roles.map((r) => {
    const set = lines.filter((l) => l.roleId === r.id);
    const h = round(set.reduce((s, l) => s + l.hours, 0), 1);
    const md = round(set.reduce((s, l) => s + l.manDays, 0), 1);
    const weeksOn = set.reduce((s, l) => s + l.weeks, 0) || 1;
    return {
      role: r.role,
      hours: h,
      manDays: md,
      costAed: money(set.reduce((s, l) => s + l.costAed, 0)),
      avgFte: round(set.reduce((s, l) => s + l.fte * l.weeks, 0) / weeksOn, 2),
    };
  });

  const buildHours = lines.filter((l) => l.phaseId === "BLD").reduce((s, l) => s + l.hours, 0);
  const crossCut = 0.15;
  const perMod = modules.length ? (buildHours * (1 - crossCut)) / modules.length : 0;
  const byModule = [
    ...modules.map((m) => ({
      module: m,
      hours: round(perMod, 1),
      manDays: round(perMod / HOURS_PER_DAY, 1),
      costAed: money((perMod / (buildHours || 1)) * lines.filter((l) => l.phaseId === "BLD").reduce((s, l) => s + l.costAed, 0)),
      sharePct: round((100 * (1 - crossCut)) / Math.max(modules.length, 1), 1),
    })),
    {
      module: "Cross-cutting (identity, audit, CI, UX kernel)",
      hours: round(buildHours * crossCut, 1),
      manDays: round((buildHours * crossCut) / HOURS_PER_DAY, 1),
      costAed: money(crossCut * lines.filter((l) => l.phaseId === "BLD").reduce((s, l) => s + l.costAed, 0)),
      sharePct: round(100 * crossCut, 1),
    },
  ];

  return {
    hoursPerDay: HOURS_PER_DAY,
    utilisation: UTILISATION,
    contingencyPct: CONTINGENCY,
    calendarMonths: months,
    calendarWeeks,
    roles,
    lines,
    byPhase,
    byModule,
    byRole,
    hours,
    manDays,
    costAed,
    contingencyHours,
    contingencyAed,
    totalHours: round(hours + contingencyHours, 1),
    totalManDays: round(manDays + contingencyHours / HOURS_PER_DAY, 1),
    totalCostAed: money(costAed + contingencyAed),
    assumptions: [
      `Planning class (AACE 4/5). ${vendor} rates are UAE 2026 list-planning, not a bid. Confirm in Schedule 1 / Order Form.`,
      `Man-day = ${HOURS_PER_DAY} hours. Utilisation ${Math.round(UTILISATION * 100)}% (meetings, leave, Client wait). Do not book 100% FTE as productive hours.`,
      `${months} months ≈ ${calendarWeeks} weeks. Build is ${buildWeeks} weeks after 2+2 discovery/architecture and 2+2+2 test/UAT/hypercare.`,
      `Team scales with ${modules.length} capabilities and ~${users.toLocaleString()} named users (scale ${round(userScale, 2)} × module ${round(modScale, 2)}). Architecture: ${micro ? "microservices" : "monolithic 3-tier"}. Deployment: ${brief.deployment}.`,
      `${Math.round(CONTINGENCY * 100)}% management reserve on hours. Change requests consume reserve first, then CR.`,
      "Hardware, licences, and cloud run-rate stay on the BOQ. This sheet is professional-services effort only.",
      "Onshore workshop/UAT weeks may attract travel — not in these hours unless added by CR.",
    ],
  };
}

export function repriceEffort(plan: EffortPlan, rates: Record<string, number>): EffortPlan {
  const roles = plan.roles.map((r) => {
    const aedPerHour = Math.max(1, Math.round(Number(rates[r.id] ?? r.aedPerHour)));
    return { ...r, aedPerHour, aedPerDay: aedPerHour * plan.hoursPerDay };
  });
  const rateOf = (id: string) => roles.find((x) => x.id === id)?.aedPerHour ?? 0;
  const lines = plan.lines.map((l) => {
    const aedPerHour = rateOf(l.roleId);
    return { ...l, aedPerHour, costAed: money(l.hours * aedPerHour) };
  });
  const hours = round(lines.reduce((s, l) => s + l.hours, 0), 1);
  const manDays = round(lines.reduce((s, l) => s + l.manDays, 0), 1);
  const costAed = money(lines.reduce((s, l) => s + l.costAed, 0));
  const avgRate = hours ? costAed / hours : 0;
  const contingencyAed = money(plan.contingencyHours * avgRate);
  const byPhase = plan.byPhase.map((p) => {
    const set = lines.filter((l) => l.phaseId === p.phaseId);
    return { ...p, costAed: money(set.reduce((s, l) => s + l.costAed, 0)) };
  });
  const byRole = plan.byRole.map((r) => {
    const set = lines.filter((l) => l.role === r.role);
    return { ...r, costAed: money(set.reduce((s, l) => s + l.costAed, 0)) };
  });
  const buildCost = lines.filter((l) => l.phaseId === "BLD").reduce((s, l) => s + l.costAed, 0);
  const byModule = plan.byModule.map((m) => ({
    ...m,
    costAed: money((m.sharePct / 100) * buildCost),
  }));
  return {
    ...plan,
    roles,
    lines,
    byPhase,
    byRole,
    byModule,
    hours,
    manDays,
    costAed,
    contingencyAed,
    totalHours: round(hours + plan.contingencyHours, 1),
    totalManDays: round(manDays + plan.contingencyHours / plan.hoursPerDay, 1),
    totalCostAed: money(costAed + contingencyAed),
  };
}

export function flattenEffort(plan: EffortPlan) {
  return [
    `Effort ${plan.totalManDays} man-days / ${plan.totalHours} hours / ${plan.totalCostAed} AED including ${plan.contingencyPct * 100}% reserve.`,
    ...plan.byPhase.map((p) => `${p.phase}: ${p.hours} h, ${p.manDays} d, ${p.costAed} AED`),
    ...plan.byRole.map((r) => `${r.role}: ${r.hours} h, ${r.costAed} AED`),
    ...plan.assumptions,
  ].join("\n");
}

export function effortSheetMatrices(plan: EffortPlan): { name: string; rows: (string | number)[][] }[] {
  return [
    {
      name: "Effort-cover",
      rows: [
        ["Effort estimation and man-hour costing — planning"],
        ["Calendar", `${plan.calendarMonths} months / ${plan.calendarWeeks} weeks`],
        ["Hours per man-day", plan.hoursPerDay],
        ["Utilisation", `${Math.round(plan.utilisation * 100)}%`],
        ["Contingency", `${Math.round(plan.contingencyPct * 100)}%`],
        ["Hours (base)", plan.hours],
        ["Man-days (base)", plan.manDays],
        ["AED (base)", plan.costAed],
        ["Hours including reserve", plan.totalHours],
        ["Man-days including reserve", plan.totalManDays],
        ["AED including reserve", plan.totalCostAed],
        ["Class", "Not a quote. Not a PO. Confirm rates in the Order Form."],
      ],
    },
    {
      name: "Rate-card",
      rows: [
        ["Role", "Discipline", "AED / hour", "AED / man-day (8h)", "Notes"],
        ...plan.roles.map((r) => [r.role, r.discipline, r.aedPerHour, r.aedPerDay, r.notes]),
      ],
    },
    {
      name: "Effort-by-phase",
      rows: [
        ["Phase", "Weeks", "Man-days", "Hours", "Cost AED"],
        ...plan.byPhase.map((p) => [p.phase, p.weeks, p.manDays, p.hours, p.costAed]),
        ["Base total", plan.calendarWeeks, plan.manDays, plan.hours, plan.costAed],
        ["Management reserve", "", round(plan.contingencyHours / plan.hoursPerDay, 1), plan.contingencyHours, plan.contingencyAed],
        ["Grand total", "", plan.totalManDays, plan.totalHours, plan.totalCostAed],
      ],
    },
    {
      name: "FTE-by-phase",
      rows: [
        ["Phase", "Role", "FTE", "Utilisation", "Man-days", "Hours", "AED/h", "Cost AED"],
        ...plan.lines.map((l) => [l.phase, l.role, l.fte, l.utilisation, l.manDays, l.hours, l.aedPerHour, l.costAed]),
      ],
    },
    {
      name: "Effort-by-role",
      rows: [
        ["Role", "Avg FTE (weighted)", "Man-days", "Hours", "Cost AED"],
        ...plan.byRole.map((r) => [r.role, r.avgFte, r.manDays, r.hours, r.costAed]),
      ],
    },
    {
      name: "Effort-by-module",
      rows: [
        ["Module / bucket", "Share of build %", "Hours (build)", "Man-days", "Cost AED"],
        ...plan.byModule.map((m) => [m.module, m.sharePct, m.hours, m.manDays, m.costAed]),
        [],
        ["Note", "Build hours only. Discovery, architecture, SIT, UAT, hypercare sit on Effort-by-phase."],
      ],
    },
    {
      name: "Man-hour-costing",
      rows: [
        ["Phase", "Role", "Hours", "Rate AED/h", "Amount AED"],
        ...plan.lines.map((l) => [l.phase, l.role, l.hours, l.aedPerHour, l.costAed]),
        ["Management reserve", "Blended", plan.contingencyHours, money(plan.contingencyHours ? plan.contingencyAed / plan.contingencyHours : 0), plan.contingencyAed],
        ["TOTAL", "", plan.totalHours, "", plan.totalCostAed],
      ],
    },
    {
      name: "Effort-assumptions",
      rows: [["Assumption"], ...plan.assumptions.map((a) => [a])],
    },
  ];
}
