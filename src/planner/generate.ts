import type {
  ApiContract,
  ArchBox,
  BoqLine,
  ComponentSpec,
  DeliveryPack,
  Milestone,
  PlannerBrief,
  Slide,
  TestCase,
} from "./types";
import { buildArchitectureViews, buildBrd, buildHld, buildLld, buildPrd, buildSow, deployPhrase, kindLabel } from "./content";
import { brdSchedules, hldSchedules, lldSchedules, prdSchedules, sowSchedules } from "./contentDepth";
import { buildMsa, buildNda } from "./legal";
import { buildInvoices } from "./invoices";
import { buildDiagrams } from "./diagrams";
import { buildWireframes } from "./wireframes";
import { buildInfrastructure } from "./infra";
import { buildEffort } from "./effort";
import { architectureLabel } from "../architecture";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "delivery-pack";
}

function num(v: string, fallback: number) {
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseModules(raw: string) {
  const parts = raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length
    ? parts.slice(0, 12)
    : ["Identity & access", "Core transactions", "Administration", "Notifications", "Reporting & analytics"];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function buildDeliveryPack(brief: PlannerBrief): DeliveryPack {
  const product = brief.productName.trim() || "Untitled solution";
  const client = brief.clientName.trim() || "the Client";
  const vendor = brief.vendorName.trim() || "the Vendor";
  const industry = brief.industry.trim() || "enterprise";
  const modules = parseModules(brief.modules);
  const users = num(brief.users, 500);
  const months = Math.max(3, Math.round(num(brief.durationMonths, 6)));
  const micro = brief.architectureStyle !== "monolith-3tier";
  const archName = architectureLabel(brief.architectureStyle || "microservices");
  const constraints = brief.constraints.trim() || "UAE PDPL alignment, 99.9% availability target, bilingual (EN/AR) UI where public-facing.";
  const briefing =
    brief.briefing.trim() ||
    `${client} requires a ${kindLabel(brief.kind)} to digitize ${industry} operations, covering ${modules.join(", ")}.`;

  const generatedAt = new Date().toISOString();
  const start = brief.startDate || todayIso();

  const executiveSummary = [
    `${vendor} is putting ${product} in front of ${client} as a ${kindLabel(brief.kind)} for ${industry} work, on a ${archName.toLowerCase()} architecture.`,
    `About ${users.toLocaleString()} named users, ${months} months from ${start}, running ${deployPhrase(brief.deployment)}.`,
    `In scope: ${modules.join(", ")}.`,
    briefing,
    `Hard constraints we will design to, not retrofit: ${constraints}`,
  ].join(" ");

  const rfpNarrative = [
    `${vendor} has read the RFP for ${product}. Each must-have is tied to a module, a date on the Gantt, a screen in the wireframes, and a test case. If we cannot meet a clause we mark Partial or Noted and say why.`,
    `Where it runs: ${deployPhrase(brief.deployment)}. Users: ~${users.toLocaleString()}. Start: ${start}. Length: ${months} months. Dev, UAT, production` +
      (brief.deployment === "cloud" ? " across more than one AZ." : ". DR is drawn in the HLD, not left as a slide title."),
    `Stack in one sentence: browser hits a WAF and gateway, services sit behind JWT/RBAC, PostgreSQL holds the record, Redis is cache only, a bus carries events after the same database commit. Logs, backups, and how we ship code are in the SOW.`,
    `Read BRD for who and why, PRD plus wireframes for what people click, HLD/LLD for how it is built, SOW for who does what, BOQ/Gantt for money and time. Effort Excel is man-hours and professional-services costing. BOQ and effort numbers are planning, not a quote.`,
  ];

  const components: ComponentSpec[] = [
    {
      name: "Experience portal",
      layer: "Experience",
      responsibility: `End-user and admin UX for ${product}`,
      tech: "SPA (React) + BFF",
      interfaces: "OIDC login, REST to gateway",
    },
    {
      name: "API gateway / reverse proxy",
      layer: "Edge",
      responsibility: micro ? "Authn, rate limit, routing, request IDs" : "TLS, reverse proxy, routing to the application tier",
      tech: micro ? "Kong / managed API GW" : "Nginx / IIS / HAProxy",
      interfaces: micro ? "OIDC JWT, mTLS to services" : "OIDC JWT to the monolith",
    },
    ...(micro
      ? modules.map((m) => ({
          name: `${m} service`,
          layer: "Domain",
          responsibility: `Business rules and APIs for ${m}`,
          tech: "Spring Boot (or equivalent) on Kubernetes/VMs",
          interfaces: "REST + domain events",
        }))
      : [
          {
            name: "Application tier (monolith)",
            layer: "Application",
            responsibility: `Business rules for ${modules.join(", ")} in one deployable`,
            tech: "Spring Boot / .NET / equivalent on app VMs",
            interfaces: "REST to presentation; JDBC/TLS to PostgreSQL",
          },
        ]),
    {
      name: "Identity adapter",
      layer: "Security",
      responsibility: `Federate ${client} IdP (SAML/OIDC) and local RBAC`,
      tech: "Keycloak / Entra ID / Okta adapter",
      interfaces: "OIDC, SCIM (optional)",
    },
    {
      name: "System of record",
      layer: "Data",
      responsibility: "Transactional persistence",
      tech: "PostgreSQL HA (primary + replicas)",
      interfaces: "TLS, PITR backups",
    },
    {
      name: "Cache & sessions",
      layer: "Data",
      responsibility: "Hot keys, rate-limit counters, session hints",
      tech: "Redis Sentinel/Cluster",
      interfaces: "TLS, ACL",
    },
    {
      name: "Messaging",
      layer: "Integration",
      responsibility: "Async commands and domain events",
      tech: "RabbitMQ or Kafka",
      interfaces: "TLS, publisher confirms / idempotent consumers",
    },
    {
      name: "Complaints handling",
      layer: "Domain",
      responsibility: "Multi-channel intake, SLA clocks, SoD on decision, tracking token",
      tech: micro ? "Spring Boot service or package" : "Application-tier package",
      interfaces: "REST /api/v1/complaints + outbox events",
    },
    {
      name: "Data warehouse",
      layer: "Analytics",
      responsibility: "Star schema from replica CDC; not a second SoR",
      tech: "ClickHouse or equivalent + dbt",
      interfaces: "ETL from replica; SQL to BI tools",
    },
    {
      name: "BI layer",
      layer: "Analytics",
      responsibility: "Apache Superset and/or Power BI on certified datasets",
      tech: "Superset + Power BI gateway/Service",
      interfaces: "OIDC/Entra, RLS, warehouse only",
    },
    {
      name: "Observability stack",
      layer: "Platform",
      responsibility: "Metrics, logs, traces, alerting",
      tech: "Prometheus/Grafana or ELK + tracing",
      interfaces: "OTLP, Alertmanager",
    },
  ];

  const apis: ApiContract[] = [
    { method: "POST", path: "/api/v1/auth/token", purpose: "Exchange IdP assertion / client credentials", auth: "OIDC" },
    { method: "GET", path: "/api/v1/me", purpose: "Current principal and entitlements", auth: "Bearer JWT" },
    ...modules.slice(0, 8).flatMap((m, i) => {
      const slug = slugify(m);
      return [
        { method: "GET", path: `/api/v1/${slug}`, purpose: `List ${m} records with filter/page`, auth: "Bearer JWT + RBAC" },
        { method: "POST", path: `/api/v1/${slug}`, purpose: `Create ${m} record`, auth: "Bearer JWT + RBAC" },
        i < 3
          ? { method: "GET", path: `/api/v1/${slug}/{id}`, purpose: `Get ${m} by id`, auth: "Bearer JWT + RBAC" }
          : null,
      ].filter(Boolean) as ApiContract[];
    }),
    { method: "GET", path: "/api/v1/health", purpose: "Liveness/readiness for load balancer", auth: "Network ACL" },
    { method: "GET", path: "/api/v1/audit", purpose: "Privileged activity query", auth: "Bearer JWT (auditor role)" },
    { method: "POST", path: "/api/v1/complaints", purpose: "Lodge a complaint (any channel)", auth: "Bearer JWT or public + captcha policy" },
    { method: "GET", path: "/api/v1/complaints/{id}", purpose: "Get complaint by id or tracking token", auth: "Bearer JWT + RBAC or tracking token" },
    { method: "POST", path: "/api/v1/complaints/{id}/triage", purpose: "Classify and queue; start/continue SLA clock", auth: "Bearer JWT (officer, not submitter)" },
    { method: "POST", path: "/api/v1/complaints/{id}/decision", purpose: "Record decision and notify via outbox", auth: "Bearer JWT + SoD" },
    { method: "GET", path: "/api/v1/kpis", purpose: "Certified KPI snapshot from warehouse (not OLTP)", auth: "Bearer JWT (analyst)" },
  ];

  const sow = [
    ...buildSow(product, client, vendor, brief, modules, months, users, constraints, briefing),
    ...sowSchedules(product, client, vendor, brief, modules, months, users),
  ];
  const hld = [
    ...buildHld(product, client, vendor, brief, modules, users, constraints, briefing),
    ...hldSchedules(product, client, vendor, brief, modules, users, constraints),
  ];
  const lld = [...buildLld(product, client, brief, modules, components, apis), ...lldSchedules(product, client, modules)];
  const brd = [
    ...buildBrd(product, client, vendor, brief, modules, users, constraints, briefing),
    ...brdSchedules(product, client, vendor, modules, users, constraints),
  ];
  const prd = [...buildPrd(product, client, brief, modules, users), ...prdSchedules(product, client, modules, users)];
  const nda = buildNda(product, client, vendor, brief, generatedAt);
  const msa = buildMsa(product, client, vendor, brief, modules, months, users, constraints, briefing, start);
  const boq = buildBoq(brief, users, modules);
  const infra = buildInfrastructure(brief, product, client, modules, users);
  const effort = buildEffort(brief, modules, months, users, vendor);
  const invoices = buildInvoices(product, client, vendor, slugify(product), start, modules, boq.lines, months);
  rfpNarrative.push(
    `Effort and man-hour costing: ${effort.totalManDays} man-days (${effort.totalHours} hours) including ${Math.round(effort.contingencyPct * 100)}% reserve, planning professional-services cost ${effort.totalCostAed.toLocaleString()} AED. Rate card and FTE by phase are in the Effort Excel. Hardware remains on the BOQ.`
  );

  const milestones = buildMilestones(months, modules, vendor);
  const testCases = buildTests(product, modules, client);
  const diagrams = buildDiagrams(product, modules, brief.deployment, client, brief.architectureStyle || "microservices");
  const architectureViews = buildArchitectureViews(product, client, brief, modules);
  const wireframes = buildWireframes(product, client, modules, industry);
  const architecture = {
    boxes: [] as ArchBox[],
    layers: ["Software", "Network", "Security", "Database"],
    svg: diagrams.find((d) => d.id === "software")?.svg ?? diagrams[0]?.svg ?? "",
  };
  const slides = buildSlides(product, client, vendor, brief, modules, months, users, executiveSummary, effort);
  const placeholders = {
    projectName: product,
    clientName: client,
    vendorName: vendor,
    date: todayIso(),
    industry,
    deployment: deployPhrase(brief.deployment),
    executiveSummary,
    scope: modules.join(", "),
    constraints,
    duration: `${months} months`,
    users: String(users),
    architectureOverview: architectureViews.map((v) => `${v.title}: ${v.summary}`).join("\n\n"),
    nfr: hld.find((s) => /availability|DR/i.test(s.heading))?.body ?? hld[3]?.body ?? "",
    security: architectureViews.find((v) => v.id === "security")?.summary ?? hld[4]?.body ?? "",
    milestones: milestones.map((m) => `${m.name} (W${m.startWeek}–W${m.startWeek + m.durationWeeks - 1})`).join("; "),
    effortHours: String(effort.totalHours),
    effortManDays: String(effort.totalManDays),
    effortCostAed: String(effort.totalCostAed),
    effortSummary: `${effort.totalManDays} man-days / ${effort.totalHours} hours / ${effort.totalCostAed} AED including ${Math.round(effort.contingencyPct * 100)}% reserve (planning).`,
  };

  return {
    brief: { ...brief, productName: product, clientName: client, vendorName: vendor, architectureStyle: brief.architectureStyle || "microservices" },
    generatedAt,
    slug: slugify(product),
    kindLabel: kindLabel(brief.kind),
    moduleList: modules,
    userCount: users,
    months,
    executiveSummary,
    rfpNarrative,
    sow,
    nda,
    msa,
    hld,
    lld,
    brd,
    prd,
    components,
    apis,
    boq,
    infra,
    effort,
    invoices,
    milestones,
    testCases,
    diagrams,
    architectureViews,
    wireframes,
    architecture,
    slides,
    placeholders,
    assumptions: [
      "BOQ and cloud run-rate are planning numbers. Get a quote before you buy iron or sign a cloud commit.",
      "Infrastructure Excel (VM names, vCPU/RAM/disk, IPs, VLANs/subnets, firewall/NSG) is a planning IPAM draft. Confirm before cabling or VPC apply.",
      "Effort and man-hour costing is a planning estimate (utilisation 80%, 10% reserve). Rates are not a bid until the Order Form.",
      "RFP Excel answers are a first pass. A bid manager still owns compliance ticks.",
      "NDA and MSA Word files are counsel drafts. Brackets must be completed; they are not executed by generating this pack.",
      "Invoices are pro forma / draft tax invoices. Complete TRN, PO, IBAN, and FTA sequence before issue. They are not a demand for payment.",
      constraints,
    ],
  };
}

function buildBoq(brief: PlannerBrief, users: number, modules: string[]) {
  const scale = Math.max(1, Math.ceil(users / 500));
  const appHosts = Math.max(3, 2 + scale);
  const dbHosts = brief.deployment === "cloud" ? 0 : 3;
  const lines: BoqLine[] = [];

  const add = (
    item: string,
    category: BoqLine["category"],
    qty: number,
    unit: string,
    unitAed: number,
    capex: boolean,
    notes: string
  ) => {
    if (qty <= 0) return;
    lines.push({ item, category, qty, unit, unitAed, totalAed: qty * unitAed, capex, notes });
  };

  if (brief.deployment !== "cloud") {
    add("Rack servers (dual-socket, 64c / 256 Gi / NVMe)", "compute", appHosts, "node", 68000, true, "App, platform, and hypervisor capacity; N+1.");
    add("Database / data nodes", "compute", dbHosts, "node", 78000, true, "Dedicated PostgreSQL + replica + witness/backup.");
    add("42U rack + PDU pair + contained airflow", "facility", Math.max(1, Math.ceil(appHosts / 8)), "rack", 16100, true, "Includes dual PDU.");
    add("25Gb ToR leaf switch HA pair", "network", 2, "pair", 44000, true, "MLAG/EVPN east-west.");
    add("Next-gen firewall HA pair", "security", 1, "pair", 37000, true, "North-south inspection, VPN, IPS.");
    add("Application delivery / load balancer pair", "network", 1, "pair", 28000, true, "TLS offload, health checks.");
    add("Backup target (NAS/object, 80 TB usable)", "storage", 1, "array", 42000, true, "Isolated VLAN; immutable snapshots if licensed.");
    add("UPS + rack ATS", "facility", 1, "set", 28000, true, "Ride-through for graceful shutdown.");
    add("Hypervisor / OS licenses (3 yr)", "license", appHosts + dbHosts, "host", 4500, true, brief.briefing.includes("VMware") ? "vSphere-class" : "Proxmox/KVM or vSphere as selected.");
    add("RDBMS HA license / support (3 yr)", "license", 1, "lot", 48000, true, "Enterprise features: PITR, backup tooling.");
  } else {
    add(brief.architectureStyle === "monolith-3tier" ? "Production application-tier VMs (reserved capacity)" : "Production Kubernetes node pool (reserved capacity)", "compute", Math.max(4, 3 + scale), "node-mo", 1800, false, brief.architectureStyle === "monolith-3tier" ? "App + presentation VMs. No Kubernetes control-plane charge." : "UAE/GCC region on-demand equivalent, planning rate.");
    add("Managed PostgreSQL Multi-AZ", "storage", 1, "instance-mo", 2200, false, "Includes HA replica.");
    add("Object storage + backup vault", "storage", 1, "lot-mo", 900, false, "Versioning + lifecycle.");
    add("WAF + load balancing + NAT", "network", 1, "lot-mo", 1200, false, "Edge protection.");
    add("Observability & log retention", "services", 1, "lot-mo", 800, false, "Metrics, traces, 30–90 day logs.");
  }

  if (brief.deployment === "hybrid") {
    add("On-prem data-plane servers (sensitive stores)", "compute", 3, "node", 72000, true, "Keeps classified data in customer DC.");
    add("Secure interconnect / VPN concentrator", "network", 1, "pair", 18000, true, "Cloud-to-DC overlay.");
  }

  add("Implementation & integration (professional services)", "services", Math.max(3, modules.length), "sprint", 42000, true, "Design, build, test, cutover per module cluster.");
  add("Training & knowledge transfer", "services", 1, "lot", 18000, true, "Admin + super-user + runbooks.");
  add("Hypercare (30 days)", "support", 1, "lot", 22000, true, "On-call aligned to ${client} business hours.".replace("${client}", brief.clientName || "client"));
  add("Annual maintenance / support (AMC 20% of hardware+license capex)", "support", 1, "year", 0, false, "Computed below.");

  const capexAed = lines.filter((l) => l.capex).reduce((s, l) => s + l.totalAed, 0);
  const amc = lines.find((l) => l.item.startsWith("Annual maintenance"));
  if (amc) {
    const hw = lines.filter((l) => l.capex && (l.category === "compute" || l.category === "storage" || l.category === "network" || l.category === "security" || l.category === "facility" || l.category === "license")).reduce((s, l) => s + l.totalAed, 0);
    amc.unitAed = Math.round(hw * 0.2) || 36000;
    amc.totalAed = amc.unitAed;
  }
  const opexYearAed =
    lines.filter((l) => !l.capex).reduce((s, l) => s + l.totalAed, 0) +
    (brief.deployment === "cloud" ? 0 : 0);

  return { lines, capexAed, opexYearAed };
}

function buildMilestones(months: number, modules: string[], vendor: string): Milestone[] {
  const weeks = months * 4;
  const buildWeeks = Math.max(4, weeks - 8);
  const chunk = Math.max(2, Math.floor(buildWeeks / Math.max(1, Math.ceil(modules.length / 2))));
  const ms: Milestone[] = [
    {
      id: "M0",
      name: "Kickoff & discovery",
      phase: "Initiate",
      startWeek: 1,
      durationWeeks: 2,
      owner: `${vendor} delivery lead`,
      deliverables: ["RAID log", "workshop notes", "refined backlog", "environment request"],
    },
    {
      id: "M1",
      name: "Architecture freeze (HLD/LLD)",
      phase: "Design",
      startWeek: 3,
      durationWeeks: 2,
      owner: "Solution architect",
      deliverables: ["HLD", "LLD", "security design", "environment BOM/BOQ"],
    },
  ];
  let w = 5;
  const pairs: string[][] = [];
  for (let i = 0; i < modules.length; i += 2) pairs.push(modules.slice(i, i + 2));
  pairs.forEach((group, i) => {
    const dur = i === pairs.length - 1 ? Math.max(2, weeks - 4 - w + 1) : chunk;
    ms.push({
      id: `B${i + 1}`,
      name: `Build: ${group.join(" + ")}`,
      phase: "Build",
      startWeek: w,
      durationWeeks: Math.min(dur, Math.max(2, weeks - 4 - w)),
      owner: "Engineering",
      deliverables: group.map((g) => `${g} MVP + APIs + tests`),
    });
    w += chunk;
  });
  ms.push({
    id: "T1",
    name: "SIT / security / NFR",
    phase: "Test",
    startWeek: Math.max(5, weeks - 5),
    durationWeeks: 2,
    owner: "QA + security",
    deliverables: ["SIT report", "VA/PT actions", "NFR evidence"],
  });
  ms.push({
    id: "U1",
    name: "UAT & training",
    phase: "Assure",
    startWeek: Math.max(6, weeks - 3),
    durationWeeks: 2,
    owner: "Client PO + vendor BA",
    deliverables: ["UAT sign-off", "training records", "cutover plan"],
  });
  ms.push({
    id: "G1",
    name: "Go-live & hypercare",
    phase: "Deploy",
    startWeek: weeks,
    durationWeeks: 2,
    owner: "Service introduction",
    deliverables: ["Production release", "hypercare report", "as-built pack"],
  });
  return ms;
}

function buildTests(product: string, modules: string[], client: string): TestCase[] {
  const cases: TestCase[] = [
    {
      id: "TC-SEC-01",
      suite: "Security",
      module: "Identity",
      title: "Un authenticated request to a protected API is rejected",
      preconditions: "Gateway is up; no token presented.",
      steps: "1. GET /api/v1/me without Authorization. 2. Observe status and body.",
      expected: "401 with RFC 7807 error; no stack trace; correlation id present.",
      priority: "P0",
    },
    {
      id: "TC-SEC-02",
      suite: "Security",
      module: "Identity",
      title: "Role cannot access another role’s command",
      preconditions: "Users A (business) and B (admin) exist.",
      steps: "1. Login as A. 2. Call an admin-only endpoint.",
      expected: "403; audit record written.",
      priority: "P0",
    },
    {
      id: "TC-NFR-01",
      suite: "NFR",
      module: "Platform",
      title: "List endpoint p95 under load",
      preconditions: "Perf environment seeded; auth token pool ready.",
      steps: "Run agreed load profile for 15 minutes against a core list API.",
      expected: "p95 < 2s; error rate < 0.1%; no pod crash loops.",
      priority: "P1",
    },
    {
      id: "TC-NFR-02",
      suite: "NFR",
      module: "Data",
      title: "Backup restore drill",
      preconditions: "Backup job completed in last 24h.",
      steps: "Restore latest backup to a isolated instance and verify checksum of a known record.",
      expected: "Restore completes within RTO objective; data matches.",
      priority: "P1",
    },
    {
      id: "TC-UAT-01",
      suite: "UAT",
      module: "Cross-cut",
      title: `${client} sponsor completes an end-to-end happy path on ${product}`,
      preconditions: "UAT environment; training delivered.",
      steps: "Execute the agreed business journey from login to confirmation.",
      expected: "Journey completes; user confirms usability; evidence attached.",
      priority: "P0",
    },
  ];

  modules.forEach((m, idx) => {
    const n = String(idx + 1).padStart(2, "0");
    cases.push(
      {
        id: `TC-FN-${n}A`,
        suite: "Functional",
        module: m,
        title: `Create a ${m} record with valid data`,
        preconditions: "User has create permission.",
        steps: `1. Open ${m}. 2. Create with mandatory fields. 3. Save.`,
        expected: "Record persisted; audit entry; appears in list/search.",
        priority: "P0",
      },
      {
        id: `TC-FN-${n}B`,
        suite: "Functional",
        module: m,
        title: `Validation blocks incomplete ${m} payload`,
        preconditions: "User has create permission.",
        steps: "Submit with a mandatory field blank (UI and API).",
        expected: "400 / inline validation; nothing persisted.",
        priority: "P1",
      },
      {
        id: `TC-IN-${n}`,
        suite: "Integration",
        module: m,
        title: `${m} publishes a domain event consumed downstream`,
        preconditions: "Broker healthy; consumer stub attached.",
        steps: `Change state of a ${m} record that should emit an event.`,
        expected: "Event received once; payload schema valid; retry is idempotent; poison messages isolated.",
        priority: "P1",
      },
      {
        id: `TC-FN-${n}C`,
        suite: "Functional",
        module: m,
        title: `Concurrent update of ${m} is rejected or merged safely`,
        preconditions: "Two officers open the same record (version N).",
        steps: `1. User A saves a change. 2. User B saves on stale version. 3. Observe API and UI.`,
        expected: "409 or merge prompt; no silent overwrite; audit shows both attempts.",
        priority: "P0",
      },
      {
        id: `TC-FN-${n}D`,
        suite: "Functional",
        module: m,
        title: `Unauthorised role cannot list ${m} as empty-success`,
        preconditions: "User has no read permission on the module.",
        steps: "Open UI route and call GET list API.",
        expected: "403 problem+json; UI forbidden state — not an empty table pretending there is no data.",
        priority: "P0",
      }
    );
  });
  cases.push(
    {
      id: "TC-SEC-03",
      suite: "Security",
      module: "Identity",
      title: "IDOR: user cannot fetch another tenant/org record by guessing UUID",
      preconditions: "Two isolated organisations with records.",
      steps: "Authenticate as org A; GET org B resource id.",
      expected: "403/404 without leakage; audit of denied access.",
      priority: "P0",
    },
    {
      id: "TC-SEC-04",
      suite: "Security",
      module: "Gateway",
      title: "Oversize payload is rejected at the edge",
      preconditions: "Gateway body limit configured.",
      steps: "POST a body larger than the documented cap.",
      expected: "413; no service crash; request-id present.",
      priority: "P1",
    },
    {
      id: "TC-NFR-03",
      suite: "NFR",
      module: "Platform",
      title: "Instance/pod loss does not lose committed writes",
      preconditions: "HA topology as HLD.",
      steps: "Kill one app replica during a tagged successful POST; read back by id.",
      expected: "Committed row remains; client may retry with idempotency key without duplicate.",
      priority: "P0",
    },
    {
      id: "TC-UAT-02",
      suite: "UAT",
      module: "Cross-cut",
      title: `${client} officer completes a reject/return path, not only happy path`,
      preconditions: "UAT data with incomplete evidence.",
      steps: "Return the case with a reason; originator sees notification and can resubmit.",
      expected: "State machine matches SOP; reason on audit; user-visible status.",
      priority: "P0",
    },
    {
      id: "TC-IN-IDP",
      suite: "Integration",
      module: "Identity",
      title: "Staff sign-in against Client IdP (OIDC)",
      preconditions: "IdP metadata loaded in test; test user in mapped group.",
      steps: "1. Hit a protected URL. 2. Complete IdP login. 3. Return with code. 4. Call GET /api/v1/me.",
      expected: "Session established; no local password field; /me shows IdP sub and mapped roles.",
      priority: "P0",
    },
    {
      id: "TC-NFR-04",
      suite: "NFR",
      module: "Accessibility",
      title: "Officer queue and create form meet WCAG 2.1 AA on keyboard",
      preconditions: "UAT build; axe or equivalent available.",
      steps: "Tab through queue, open, create, submit without a mouse; run automated scan on those three pages.",
      expected: "Focus visible; no critical axe issues; labels associated; bilingual pages do not clip Arabic.",
      priority: "P1",
    },
    {
      id: "TC-UAT-03",
      suite: "UAT",
      module: "Cross-cut",
      title: "Deemed-acceptance clock: Client records accept or written defects within five working days",
      preconditions: "A deliverable submitted with timestamp (email or ticket).",
      steps: "Confirm PO action within five GST working days; if silent, treat as accepted per SOW.",
      expected: "Written accept, defect list with IDs, or deemed accept recorded in RAID.",
      priority: "P2",
    }
  );
  return cases;
}

function buildSlides(
  product: string,
  client: string,
  vendor: string,
  brief: PlannerBrief,
  modules: string[],
  months: number,
  users: number,
  summary: string,
  effort: DeliveryPack["effort"]
): Slide[] {
  return [
    { kicker: vendor, title: product, bullets: [`For ${client}`, `${months} months · ~${users.toLocaleString()} users · ${brief.deployment}`, modules.slice(0, 4).join(" · ")] },
    { kicker: "The job", title: "What we heard", bullets: [brief.briefing || summary.slice(0, 400), brief.constraints || "PDPL, 99.9% APIs, English and Arabic on public pages"] },
    { kicker: "Day in the life", title: "How work moves", bullets: ["Someone submits. The system checks and stores.", "Integrations fire, or wait on the bus if they are slow.", `${client} staff decide when a human has to.`, "Status lives in the product, not in a side email."] },
    { kicker: "Screens", title: "Wireframes first", bullets: ["Sign-in via your IdP / UAE Pass", "Officer queue with due dates written as text", "Create, detail, admin, public track", "Take SVG to Figma or prompts to Google Stitch"] },
    {
      kicker: "Build",
      title: brief.architectureStyle === "monolith-3tier" ? "Three tiers" : "Four architecture views",
      bullets:
        brief.architectureStyle === "monolith-3tier"
          ? ["Presentation: reverse proxy, static, TLS", "Application: one binary, packages per capability", "Data: PostgreSQL as SoR, Redis is cache", "No Kubernetes control plane in this design"]
          : ["Software: API-first services and OpenAPI", "Network: edge, private app, data with no inbound internet", "Security: IdP federation, vault, audit, PDPL", "Database: PostgreSQL as SoR, outbox, cache is not truth"],
    },
    { kicker: "A write", title: "What UAT will actually do", bullets: ["Log in. Open a record. Save.", "If two people edit, the second gets a conflict, not a silent overwrite.", "If you should not see it, you get 403, not an empty list."] },
    { kicker: "Time", title: `${months} months`, bullets: ["Workshops, then freeze the pictures", "Ship modules in slices", "SIT, security test, UAT", "Go-live and 30 days on the phone"] },
    {
      kicker: "Effort",
      title: "Man-hours and costing",
      bullets: [
        `${effort.totalManDays} man-days (${effort.totalHours} hours) including ${Math.round(effort.contingencyPct * 100)}% reserve`,
        `${effort.totalCostAed.toLocaleString()} AED professional services at planning rates`,
        "Rate card, FTE by phase, and module split sit in the Effort Excel",
        "Hardware and licences stay on the BOQ — not a bid until the Order Form",
      ],
    },
    { kicker: "Close", title: "To start", bullets: [`Confirm ${product} scope`, "NDA then MSA + SOW — drafts are in the pack", "Send the RFP workbook if you want it filled", "Name a product owner on both sides"] },
  ];

}

const KEYWORDS: { test: RegExp; compliance: RfpCompliance; pick: (p: DeliveryPack) => string }[] = [
  { test: /nda\b|non-?disclosure|confidentiality agreement/i, compliance: "Comply", pick: (p) => `${p.brief.vendorName} will sign a mutual NDA before detailed workshops. A draft is in this pack: English, UAE-oriented, three-year survival, PDPL handling, injunctive relief, [brackets] for forum. It does not replace ${p.brief.clientName}’s house NDA if procurement mandates one.` },
  { test: /invoice|invoic|billing|vat\b|trn\b|payment term|accounts payable/i, compliance: "Noted", pick: (p) => `Draft tax invoices follow SOW gates (10/15/40/20/15) plus a pro forma for the implementation total. UAE VAT 5% is shown as planning. Complete TRN, PO and IBAN before issue. ${p.invoices.length} invoice documents are in this pack.` },
  { test: /msa\b|master services|framework agreement|contract terms|liability|indemnit|governing law|jurisdiction|limitation of liab/i, compliance: "Noted", pick: (p) => `A draft Master Services Agreement is included for ${p.brief.productName}: SOW incorporation, IP vesting on payment, PDPL schedule, liability cap at 12 months’ Fees (carve-outs for fraud and PI; 200% for confidentiality/IP indemnity). Forum and caps are for counsel. This is not a signed contract.` },
  { test: /secur|encrypt|iam|sso|saml|oidc|pdpl|gdpr|iso\s*27001|vulnerab|pen.?test/i, compliance: "Comply", pick: (p) => {
    const s = p.hld.find((x) => /security|identity/i.test(x.heading));
    return `${p.brief.vendorName} will federate ${p.brief.productName} to ${p.brief.clientName} sign-in (OIDC, SAML if you still need it, UAE Pass for the public if that is in scope). We keep roles in the product, TLS on the wire, encryption on disks, secrets in a vault, an audit row on privileged changes, scanners in CI, and a pen-test before go-live. ${[s?.body, ...(s?.paragraphs ?? [])].filter(Boolean).join(" ")}`;
  } },
  { test: /vlan|subnet|ipam|\bip\b|virtual machine|\bvms?\b|hostname|firewall policy|nsg\b|security group|addressing plan/i, compliance: "Comply", pick: (p) => `A complete infrastructure workbook ships with this pack: ${p.infra.vms.length} named guests (DEV/UAT/PRD), ${p.infra.vlans.length} VLAN/subnet rows, static IP reservations, VIP/LB, DNS, backup, certificates, and ${p.infra.policies.length} firewall/NSG policies. Naming is ${p.infra.siteCode}-<ENV>-<ROLE>-<NN> on ${p.infra.domain}. Confirm with ${p.brief.clientName} IPAM at architecture freeze.` },
  { test: /architect|integrat|api|interface|esb|kafka|rest/i, compliance: "Comply", pick: (p) => {
    const views = p.architectureViews.map((v) => `${v.title}: ${v.summary}`).join(" ");
    const s = p.hld.find((x) => /software architecture/i.test(x.heading)) ?? p.hld[2];
    const l = p.lld.find((x) => /sequence/i.test(x.heading));
    return `Architecture is documented as seven separate views (software, network, security, database, reporting, BI, complaints handling). ${views} ${[s?.body, ...(s?.paragraphs ?? [])].filter(Boolean).join(" ")} ${[l?.body, ...(l?.numbered ?? []).slice(0, 4).map((n, i) => `${i + 1}. ${n}`)].filter(Boolean).join(" ")}`;
  } },
  { test: /availab|sla|uptime|ha\b|high.?avail|dr\b|disaster|rpo|rto/i, compliance: "Comply", pick: (p) => `Target availability is 99.9% for production APIs. ${p.lld.find((s) => /runtime/i.test(s.heading))?.body} RPO ≤ 15 minutes and RTO ≤ 4 hours are the design objectives unless the RFP specifies stricter figures, in which case we will align during architecture freeze.` },
  { test: /support|warranty|hypercare|l1|l2|l3|helpdesk|maintenance/i, compliance: "Comply", pick: (p) => `The SOW includes 30-day hypercare after go-live. Ongoing L2/L3 support and AMC are priced as a separate annual schedule in the BOQ. Coverage hours default to ${p.brief.clientName} business days (GST) unless 24×7 is contracted.` },
  { test: /train|knowledge|kt\b|documentation|runbook/i, compliance: "Comply", pick: (p) => `${p.brief.vendorName} delivers admin and super-user training, as-built documentation (HLD, LLD, runbooks), and a recorded walkthrough. Knowledge transfer is a gated milestone before hypercare ends.` },
  { test: /timeline|schedule|milestone|duration|go-?live|delivery date/i, compliance: "Comply", pick: (p) => `Proposed calendar is ${p.months} months from kickoff. Phases: discovery, architecture freeze, incremental build of ${p.moduleList.join(", ")}, SIT/security/NFR, UAT, go-live, hypercare. A Gantt is included in this pack.` },
  { test: /effort|man.?hour|man.?day|person.?day|fte\b|rate card|staffing|resource plan|costing/i, compliance: "Comply", pick: (p) => `An effort estimate and man-hour costing workbook is in this pack: ${p.effort.totalManDays} man-days (${p.effort.totalHours} hours) including ${Math.round(p.effort.contingencyPct * 100)}% reserve, planning cost ${p.effort.totalCostAed.toLocaleString()} AED professional services. Rate card, FTE by phase, and module split are in the Effort Excel. Hardware remains on the BOQ. This is not a binding quote.` },
  { test: /price|cost|commercial|payment|penalty|ld\b|liquidated/i, compliance: "Noted", pick: (p) => `Planning commercials: BOQ capex ${p.boq.capexAed.toLocaleString()} AED plus professional-services effort ${p.effort.totalCostAed.toLocaleString()} AED (${p.effort.totalManDays} man-days). This is not a binding quote. Payment milestones can follow SOW gates. LDs, if any, to be mutually agreed.` },
  { test: /architect|integrat|api|interface|esb|kafka|rest/i, compliance: "Comply", pick: (p) => p.brief.architectureStyle === "monolith-3tier" ? `API-first 3-tier monolith: presentation reverse-proxy, one application binary for ${p.moduleList.join(", ")}, PostgreSQL as SoR. OpenAPI is still a design deliverable. ${p.hld[2]?.body}` : `API-first architecture with a gateway, domain services for ${p.moduleList.join(", ")}, and asynchronous events on a message bus. OpenAPI contracts are a design deliverable. ${p.hld[2]?.body}` },
  { test: /data|privacy|pii|retention|backup|residen/i, compliance: "Comply", pick: (p) => `Data is classified; PII is minimised and encrypted. Backup with PITR; restore drills are in the test pack. Residency follows the ${p.brief.deployment} model (${p.placeholders.deployment}). Retention defaults to client policy.` },
  { test: /cloud|aws|azure|gcp|kubernetes|eks|aks|gke/i, compliance: "Comply", pick: (p) => p.brief.architectureStyle === "monolith-3tier" ? `Deployment model selected: ${p.placeholders.deployment}. Runtime is a monolithic 3-tier (presentation / application / data VMs). Kubernetes is not the default. UAE/GCC regions are preferred where cloud is used.` : `Deployment model selected: ${p.placeholders.deployment}. Where cloud is used, UAE/GCC regions are preferred. Kubernetes with multi-AZ (or equivalent on-prem HA) is the default runtime.` },
  { test: /on-?prem|datacent|data centre|rack|hypervisor|vmware|proxmox/i, compliance: "Comply", pick: (p) => `On-premise/hybrid BOQ for ${p.brief.productName} covers dual-socket rack servers, HA switching, firewall, load balancing, backup, and facility power. Hypervisor per ${p.brief.clientName} standard. See the BOQ sheet for quantities.` },
  { test: /test|uat|qa|quality|accept/i, compliance: "Comply", pick: (p) => `A structured test pack (${p.testCases.length} cases spanning functional, integration, security, NFR, and UAT) is generated with this response. P0/P1 defects are closed or waived before go-live.` },
  { test: /team|staff|resource|onshore|offshore|local/i, compliance: "Comply", pick: (p) => `${p.brief.vendorName} staffs a delivery lead, solution architect, engineers, QA, and a part-time security counterpart. Onshore presence for workshops, UAT, and cutover can be arranged for ${p.brief.clientName}.` },
  { test: /experience|reference|similar|credential/i, compliance: "Partial", pick: (p) => `${p.brief.vendorName} will put named ${p.brief.industry || "sector"} references in a bid annex. This file is the technical reply.` },
  { test: /ux|wireframe|figma|stitch|usability|user interface|\bui\b|screen design/i, compliance: "Comply", pick: (p) => `Eight desktop wireframes ship with ${p.brief.productName}: sign-in, queue, list, create, detail, admin, empty vs 403, public track. SVG at 1440×900 drops into Figma. Prompts in the zip paste into Google Stitch (stitch.withgoogle.com), then Send to Figma. We do not log into your Figma from this tool.` },
];

type RfpCompliance = "Comply" | "Partial" | "Noted" | "Exception";

export function answerRfpQuestion(question: string, pack: DeliveryPack): { answer: string; compliance: RfpCompliance } {
  const q = question.replace(/\s+/g, " ").trim();
  if (!q) return { answer: "", compliance: "Noted" };
  for (const k of KEYWORDS) {
    if (k.test.test(q)) {
      return { answer: clip(k.pick(pack), 4000), compliance: k.compliance };
    }
  }
  return {
    compliance: "Comply",
    answer: clip(
      `${pack.brief.vendorName} can meet this for ${pack.brief.productName} at ${pack.brief.clientName}. ${pack.executiveSummary} Modules: ${pack.moduleList.join(", ")}. Pictures are in the HLD; APIs and the write path are in the LLD; screens are in the wireframes (Figma/Stitch pack). Tests sit in the Excel. If this clause costs extra time or money, it goes through change control — we will not absorb it in silence.`,
      4000
    ),
  };
}

function clip(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}
