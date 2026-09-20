import type { PlannerInputs, PodSpec } from "./types";

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const ceil = Math.ceil;
const max = Math.max;

function pod(
  name: string,
  role: string,
  count: number,
  cpuReq: number,
  cpuLim: number,
  memReq: number,
  memLim: number,
  storageGi: number,
  notes: string
): PodSpec {
  return {
    name,
    role,
    count,
    cpuRequest: cpuReq,
    cpuLimit: cpuLim,
    memoryGiRequest: memReq,
    memoryGiLimit: memLim,
    storageGi,
    notes,
  };
}

export interface ReportingVm {
  name: string;
  tier: "warehouse" | "bi" | "etl" | "gateway";
  role: string;
  count: number;
  vcpu: number;
  ramGi: number;
  diskGi: number;
  notes: string;
}

export interface ReportingEffort {
  role: string;
  fte: number;
  hoursPerMonth: number;
  aedPerHour: number;
  costAedMonth: number;
  notes: string;
}

export interface ReportingKpi {
  name: string;
  grain: string;
  source: string;
  owner: string;
}

export interface ReportingPlan {
  tools: ("superset" | "powerbi")[];
  summary: string;
  warehouseGi: number;
  pods: PodSpec[];
  vms: ReportingVm[];
  effort: ReportingEffort[];
  resources: string[];
  analytics: string[];
  insights: string[];
  kpis: ReportingKpi[];
  managedSkus: { sku: string; qty: number; aedMonth: number; notes: string }[];
}

function money(n: number) {
  return Math.round(n);
}

export function buildReportingPlan(input: PlannerInputs): ReportingPlan | null {
  const superSet = input.includeSuperset;
  const powerBi = input.includePowerBi;
  if (!superSet && !powerBi) return null;

  const tps = Math.max(1, input.tps);
  const ha = input.haLevel === "strict" ? 3 : 2;
  const services = Math.max(1, input.springBootServices);
  const writeTps = tps * input.writeRatio;
  const dailyGi = max(2, (writeTps * input.avgPayloadKb * 1024 * 86400 * 0.18) / 1024 ** 3);
  const warehouseGi = max(400, ceil(dailyGi * input.dataRetentionDays * 1.4 + 120));
  const whCpu = tps > 3000 ? 16 : tps > 800 ? 8 : 4;
  const whMem = tps > 3000 ? 64 : tps > 800 ? 32 : 16;
  const etlCount = max(2, ceil(services / 6));
  const tools: ("superset" | "powerbi")[] = [];
  if (superSet) tools.push("superset");
  if (powerBi) tools.push("powerbi");

  const pods: PodSpec[] = [];
  const vms: ReportingVm[] = [];

  const whNodes = ha === 3 ? 3 : 2;
  pods.push(
    pod(
      "warehouse-clickhouse",
      "warehouse",
      whNodes,
      whCpu / 2,
      whCpu,
      whMem / 2,
      whMem,
      ceil(warehouseGi / whNodes),
      `Columnar warehouse (ClickHouse or equivalent). Shared by ${tools.join(" + ")}. Not the OLTP PostgreSQL.`
    ),
    pod(
      "warehouse-etl",
      "etl",
      etlCount,
      1,
      2,
      2,
      4,
      80,
      "CDC / batch loaders (Airbyte/Debezium/dbt runners). Reads OLTP replica, writes star schema."
    )
  );
  vms.push(
    {
      name: "DWH",
      tier: "warehouse",
      role: "Analytics warehouse",
      count: whNodes,
      vcpu: whCpu,
      ramGi: whMem,
      diskGi: ceil(warehouseGi / whNodes),
      notes: "Dedicated data-warehouse VMs. No OLTP traffic. Replication across AZs.",
    },
    {
      name: "ETL",
      tier: "etl",
      role: "CDC / dbt",
      count: etlCount,
      vcpu: 4,
      ramGi: 8,
      diskGi: 80,
      notes: "Extract from SoR replica on a schedule; never from the primary writer.",
    }
  );

  if (superSet) {
    pods.push(
      pod("superset-web", "bi", ha, 1, 2, 2, 4, 20, "Apache Superset UI/API. Private ingress, IdP OIDC. Not on the OLTP path."),
      pod("superset-worker", "bi", max(2, ceil(tps / 2000)), 1, 2, 2, 4, 20, "Celery async queries and alerts."),
      pod("superset-beat", "bi", 1, 0.2, 0.5, 0.5, 1, 5, "Celery beat for scheduled reports."),
      pod("superset-redis", "cache", ha, 0.5, 1, 1, 2, 10, "Superset cache/broker — not application Redis."),
      pod("superset-meta-db", "database", 1, 2, 4, 4, 8, 80, "Superset metadata PostgreSQL (dashboards, users). Separate from warehouse and SoR.")
    );
    vms.push(
      {
        name: "SUP",
        tier: "bi",
        role: "Apache Superset",
        count: ha,
        vcpu: 4,
        ramGi: 8,
        diskGi: 40,
        notes: "Web + gunicorn. Workers can pack on the same hosts in 3-tier; dedicated in K8s.",
      },
      {
        name: "SUP-META",
        tier: "bi",
        role: "Superset metadata DB",
        count: 1,
        vcpu: 4,
        ramGi: 8,
        diskGi: 80,
        notes: "PostgreSQL for Superset metadata only.",
      }
    );
  }

  if (powerBi) {
    pods.push(
      pod(
        "powerbi-gateway",
        "bi",
        2,
        2,
        4,
        8,
        16,
        80,
        "On-premises data gateway (Windows). Refresh from warehouse to Power BI Service. Not a K8s workload in production — size as VMs."
      )
    );
    vms.push({
      name: "PBI-GW",
      tier: "gateway",
      role: "Power BI data gateway",
      count: 2,
      vcpu: 8,
      ramGi: 16,
      diskGi: 80,
      notes: "Windows Server gateway cluster. Outbound 443 to Power BI Service. No inbound from internet.",
    });
  }

  const effort: ReportingEffort[] = [];
  const pushRole = (role: string, fte: number, aedPerHour: number, notes: string) => {
    const hoursPerMonth = round(fte * 0.8 * 8 * 22, 1);
    effort.push({
      role,
      fte: round(fte, 2),
      hoursPerMonth,
      aedPerHour,
      costAedMonth: money(hoursPerMonth * aedPerHour),
      notes,
    });
  };
  pushRole("Data engineer", superSet && powerBi ? 1 : 0.7, 360, "Pipelines, CDC, warehouse DDL, dbt.");
  pushRole("Analytics engineer", 0.5, 320, "Star schema, certified datasets, row-level security.");
  if (superSet) pushRole("Superset developer", 0.4, 300, "Dashboards, virtual datasets, alerts.");
  if (powerBi) pushRole("Power BI developer", 0.5, 320, "Semantic model, DAX, workspace apps, gateway.");
  pushRole("Data analyst / BI lead", 0.4, 280, "KPI dictionary, insight reviews with the business.");

  const resources = [
    `Warehouse usable storage ~${warehouseGi} Gi (retention ${input.dataRetentionDays}d, writes ~${round(dailyGi, 1)} Gi/day).`,
    `${whNodes} warehouse nodes × ${whCpu} vCPU / ${whMem} Gi — columnar, not OLTP.`,
    `${etlCount} ETL/CDC workers.`,
    superSet ? `Superset: ${ha} web + workers + metadata DB + dedicated Redis.` : "",
    powerBi ? "Power BI: 2× Windows on-premises data gateways + Power BI Premium/Fabric capacity (SaaS)." : "",
    "OLTP PostgreSQL is not the warehouse. BI tools query the replica/warehouse only.",
    "IdP OIDC for Superset; Entra ID for Power BI. Row-level security on tenant/org.",
  ].filter(Boolean);

  const analytics = [
    "Operational mart: cases/transactions by status, SLA, officer, channel — hourly grain.",
    "Volume mart: submissions, completions, rejects, peak-hour heatmap — daily grain.",
    "Quality mart: exception rates, duplicate keys, CDC lag, failed refreshes.",
    "Finance/ops (if in scope): cycle time, backlog age, first-time-right.",
    superSet ? "Superset SQL Lab for certified virtual datasets; no ad-hoc on OLTP." : "",
    powerBi ? "Power BI semantic model (star) published to a workspace app; DirectQuery or import from warehouse." : "",
  ].filter(Boolean);

  const insights = [
    "Where work piles up: queue age vs staffed hours.",
    "Which channel or module drives exceptions after a release.",
    "Refresh health: warehouse lag vs RPO; gateway failures vs Power BI dataset freshness.",
    "Cost-to-serve: warehouse CPU vs concurrent dashboard users (not OLTP TPS).",
    tools.length === 2
      ? "One warehouse, two consumers: keep measures in the warehouse/dbt so Superset and Power BI do not diverge."
      : "Publish a KPI dictionary with owner and grain before the first dashboard goes live.",
  ];

  const kpis: ReportingKpi[] = [
    { name: "Throughput (completed / day)", grain: "day × module", source: "warehouse fact_completion", owner: "Operations" },
    { name: "Backlog age p95", grain: "hour × queue", source: "warehouse fact_queue_snapshot", owner: "Operations" },
    { name: "SLA attainment %", grain: "day × SLA class", source: "warehouse fact_sla", owner: "Service owner" },
    { name: "Exception / reject rate", grain: "day × module", source: "warehouse fact_exception", owner: "Quality" },
    { name: "CDC / refresh lag (minutes)", grain: "5 min", source: "etl_runtime + gateway", owner: "Data engineering" },
    { name: "Active BI users (licensed)", grain: "day", source: superSet && powerBi ? "Superset audit + Power BI activity" : superSet ? "Superset audit log" : "Power BI activity", owner: "BI lead" },
    { name: "Warehouse CPU p95", grain: "hour", source: "warehouse metrics", owner: "Platform" },
    { name: "Dashboard p95 open time", grain: "hour", source: superSet ? "Superset" : "Power BI", owner: "BI lead" },
  ];

  const managedSkus = powerBi
    ? [
        {
          sku: "Power BI Premium P1 / Fabric F64 equivalent (planning)",
          qty: 1,
          aedMonth: 18360,
          notes: "SaaS capacity in UAE/GCC if available, else nearest region. Not a VM. Confirm Microsoft list.",
        },
        {
          sku: "Power BI Pro licenses (authors + viewers planning)",
          qty: max(20, ceil(services * 8)),
          aedMonth: max(20, ceil(services * 8)) * 37,
          notes: "~USD 10/user/month planning. Embed/Premium per-user if the Client standard says so.",
        },
      ]
    : [];

  const summary = `Reporting stack: ${tools.map((t) => (t === "superset" ? "Apache Superset" : "Microsoft Power BI")).join(" + ")}. Shared warehouse ${warehouseGi} Gi, ${whNodes} nodes. BI never queries the OLTP primary.`;

  return {
    tools,
    summary,
    warehouseGi,
    pods,
    vms,
    effort,
    resources,
    analytics,
    insights,
    kpis,
    managedSkus,
  };
}
