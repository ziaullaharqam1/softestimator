import type { MachineShape } from "./instances";
import { pickAws, pickAzure, pickGcp } from "./instances";
import { FALLBACK_RATES } from "./livePricing";
import type {
  CapacityPlan,
  CloudBill,
  CloudInstance,
  LivePriceBook,
  NodePlan,
  SkuLine,
  VmDeployable,
} from "./types";

export const USD_AED = FALLBACK_RATES.usdAed;
const HOURS = 730;

const money = (usd: number) => Math.round(usd * 100) / 100;

function hour(map: Record<string, number>, sku: string, fallback: number) {
  const v = map[sku];
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function line(
  book: LivePriceBook,
  sku: string,
  qty: number,
  vcpu: number,
  memoryGi: number,
  storageGi: number,
  usdHour: number,
  category: SkuLine["category"],
  notes: string,
  extraMonthUsd = 0
): SkuLine {
  const usdMonth = money(qty * usdHour * HOURS + extraMonthUsd);
  return {
    sku,
    qty,
    vcpu,
    memoryGi,
    storageGi,
    usdHour,
    usdMonth,
    aedMonth: Math.round(usdMonth * book.usdAed * 100) / 100,
    category,
    notes,
  };
}

function sum(lines: SkuLine[], cat?: SkuLine["category"]) {
  return lines
    .filter((l) => !cat || l.category === cat)
    .reduce((s, l) => s + l.aedMonth, 0);
}

function bill(
  book: LivePriceBook,
  provider: CloudBill["provider"],
  product: string,
  mode: CloudBill["mode"],
  region: string,
  lines: SkuLine[],
  instances: CloudInstance[]
): CloudBill {
  const computeAed = sum(lines, "compute");
  const storageAed = sum(lines, "storage");
  const networkAed = sum(lines, "network");
  const managedAed = sum(lines, "managed");
  const totalAed = lines.reduce((s, l) => s + l.aedMonth, 0);
  const totalUsd = lines.reduce((s, l) => s + l.usdMonth, 0);
  return {
    provider,
    product,
    mode,
    region,
    computeAed: Math.round(computeAed),
    storageAed: Math.round(storageAed),
    networkAed: Math.round(networkAed),
    managedAed: Math.round(managedAed),
    totalAed: Math.round(totalAed),
    totalUsd: Math.round(totalUsd),
    instances,
    lines,
    fetchedAt: book.fetchedAt,
    live: book.live,
    usdAed: book.usdAed,
  };
}

function egressGb(tps: number) {
  return Math.round(Math.max(50, (tps * 2 * 86400 * 30) / 1e6));
}

function poolShape(role: NodePlan["role"]): MachineShape {
  if (role === "data" || role === "reporting") return "memory";
  if (role === "ingress") return "compute";
  return "general";
}

function reportingManaged(plan: CapacityPlan, book: LivePriceBook): SkuLine[] {
  return (plan.reporting?.managedSkus ?? []).map((s) =>
    line(book, s.sku, 1, 0, 0, 0, 0, "managed", s.notes, s.aedMonth / book.usdAed)
  );
}

function computePools(plan: CapacityPlan) {
  return plan.nodes.filter((n) => n.role !== "control-plane" && n.count > 0);
}

export function priceEks(plan: CapacityPlan, book: LivePriceBook = FALLBACK_RATES): CloudBill {
  const pools = computePools(plan);
  const picked = pools.map((p) => {
    const base = pickAws(poolShape(p.role), p.vcpu, p.memoryGi);
    return { p, sku: { ...base, usdHour: hour(book.aws, base.sku, base.usdHour) } };
  });
  const dataGi = pools.reduce((s, p) => s + p.dataDiskGi * p.count, 0);
  const osGi = 80 * pools.reduce((s, p) => s + p.count, 0);
  const ebs = (dataGi + osGi) * book.awsGp3GbMonth;
  const gb = egressGb(Math.max(1, plan.totalAppReplicas * 80));
  const nlb = 0.0254 * HOURS + 15;
  const instances: CloudInstance[] = [
    {
      purpose: "EKS managed control plane",
      sku: "EKS (no EC2 for API/etcd)",
      qty: 1,
      vcpu: 0,
      memoryGi: 0,
      usdHour: book.awsEksHour,
    },
    ...picked.map(({ p, sku }) => ({
      purpose: `EKS ${p.role} node group`,
      sku: sku.sku,
      qty: p.count,
      vcpu: sku.vcpu,
      memoryGi: sku.memoryGi,
      usdHour: sku.usdHour,
    })),
  ];
  const lines: SkuLine[] = [
    line(book, "Amazon EKS control plane", 1, 0, 0, 0, book.awsEksHour, "managed", "Live AWS Price List · me-central-1 cluster hours."),
    ...picked.map(({ p, sku }) =>
      line(
        book,
        `EC2 ${sku.sku} — EKS ${p.role}`,
        p.count,
        sku.vcpu,
        sku.memoryGi,
        p.dataDiskGi,
        sku.usdHour,
        "compute",
        `Live on-demand ${sku.sku} Linux · ${sku.vcpu} vCPU / ${sku.memoryGi} Gi · 3 AZ.`
      )
    ),
    line(book, "EBS gp3 volumes", 1, 0, 0, dataGi + osGi, 0, "storage", `OS + data ${dataGi + osGi} Gi at $${book.awsGp3GbMonth.toFixed(4)}/Gi-mo.`, ebs),
    line(book, "EBS snapshots / PITR (est.)", 1, 0, 0, 0, 0, "storage", "Daily snapshots for stateful volumes.", Math.max(25, dataGi * 0.01)),
    line(book, "NLB + 3 AZ", 1, 0, 0, 0, 0, "network", "In front of Kong/ingress.", nlb),
    line(book, "Data transfer (est.)", 1, 0, 0, gb, 0, "network", `~${gb} GB/mo egress at $${book.awsEgressGb}/GB.`, gb * book.awsEgressGb),
    line(book, "NAT GW 3 AZ + CloudWatch (est.)", 1, 0, 0, 0, 0, "managed", "Private subnets, one NAT per AZ (live hourly × 3).", 3 * book.awsNatHour * HOURS + 40),
  ];
  return bill(book, "AWS", "Amazon EKS", "kubernetes", "me-central-1 (UAE)", [...lines, ...reportingManaged(plan, book)], instances);
}

export function priceAks(plan: CapacityPlan, book: LivePriceBook = FALLBACK_RATES): CloudBill {
  const pools = computePools(plan);
  const picked = pools.map((p) => {
    const base = pickAzure(poolShape(p.role), p.vcpu, p.memoryGi);
    return { p, sku: { ...base, usdHour: hour(book.azure, base.sku, base.usdHour) } };
  });
  const dataGi = pools.reduce((s, p) => s + p.dataDiskGi * p.count, 0);
  const osGi = 128 * pools.reduce((s, p) => s + p.count, 0);
  const disks = (dataGi + osGi) * book.azurePremiumGbMonth;
  const gb = egressGb(Math.max(1, plan.totalAppReplicas * 80));
  const instances: CloudInstance[] = [
    {
      purpose: "AKS managed control plane",
      sku: "AKS Uptime SLA (no customer VM)",
      qty: 1,
      vcpu: 0,
      memoryGi: 0,
      usdHour: book.azureAksSlaHour,
    },
    ...picked.map(({ p, sku }) => ({
      purpose: `AKS ${p.role} node pool`,
      sku: sku.sku,
      qty: p.count,
      vcpu: sku.vcpu,
      memoryGi: sku.memoryGi,
      usdHour: sku.usdHour,
    })),
  ];
  const lines: SkuLine[] = [
    line(book, "Azure Kubernetes Service (Uptime SLA)", 1, 0, 0, 0, book.azureAksSlaHour, "managed", "Live Azure Retail Prices · Standard Uptime SLA."),
    ...picked.map(({ p, sku }) =>
      line(
        book,
        `VM ${sku.sku} — AKS ${p.role}`,
        p.count,
        sku.vcpu,
        sku.memoryGi,
        p.dataDiskGi,
        sku.usdHour,
        "compute",
        `Live Linux PAYG ${sku.sku} · UAE North · 3 AZ.`
      )
    ),
    line(book, "Premium SSD Managed Disks", 1, 0, 0, dataGi + osGi, 0, "storage", `${dataGi + osGi} Gi at $${book.azurePremiumGbMonth.toFixed(4)}/Gi-mo (from P30 LRS).`, disks),
    line(book, "Azure Backup snapshots (est.)", 1, 0, 0, 0, 0, "storage", "PITR for data disks.", Math.max(20, dataGi * 0.012)),
    line(book, "Standard Load Balancer + Public IPs", 1, 0, 0, 0, 0, "network", "Frontending Kong.", 28),
    line(book, "Bandwidth outbound (est.)", 1, 0, 0, gb, 0, "network", `~${gb} GB/mo after 100 GB free.`, Math.max(0, (gb - 100) * book.azureEgressGb)),
    line(book, "Azure Monitor + Defender + NAT 3 AZ", 1, 0, 0, 0, 0, "managed", "Private cluster egress.", 155),
  ];
  return bill(book, "Azure", "Azure Kubernetes Service", "kubernetes", "UAE North", [...lines, ...reportingManaged(plan, book)], instances);
}

export function priceGke(plan: CapacityPlan, book: LivePriceBook = FALLBACK_RATES): CloudBill {
  const pools = computePools(plan);
  const picked = pools.map((p) => {
    const base = pickGcp(poolShape(p.role), p.vcpu, p.memoryGi);
    return { p, sku: { ...base, usdHour: hour(book.gcp, base.sku, base.usdHour) } };
  });
  const dataGi = pools.reduce((s, p) => s + p.dataDiskGi * p.count, 0);
  const osGi = 80 * pools.reduce((s, p) => s + p.count, 0);
  const pd = (dataGi + osGi) * book.gcpSsdGbMonth;
  const gb = egressGb(Math.max(1, plan.totalAppReplicas * 80));
  const instances: CloudInstance[] = [
    {
      purpose: "GKE Standard control plane",
      sku: "GKE cluster (no GCE for API)",
      qty: 1,
      vcpu: 0,
      memoryGi: 0,
      usdHour: book.gcpGkeHour,
    },
    ...picked.map(({ p, sku }) => ({
      purpose: `GKE ${p.role} node pool`,
      sku: sku.sku,
      qty: p.count,
      vcpu: sku.vcpu,
      memoryGi: sku.memoryGi,
      usdHour: sku.usdHour,
    })),
  ];
  const lines: SkuLine[] = [
    line(book, "GKE Standard regional cluster", 1, 0, 0, 0, book.gcpGkeHour, "managed", "Regional control plane fee."),
    ...picked.map(({ p, sku }) =>
      line(
        book,
        `GCE ${sku.sku} — GKE ${p.role}`,
        p.count,
        sku.vcpu,
        sku.memoryGi,
        p.dataDiskGi,
        sku.usdHour,
        "compute",
        `Live ${sku.sku} · me-central1 · multi-zone.`
      )
    ),
    line(book, "Persistent Disk SSD", 1, 0, 0, dataGi + osGi, 0, "storage", `${dataGi + osGi} Gi pd-ssd at $${book.gcpSsdGbMonth.toFixed(4)}/Gi-mo.`, pd),
    line(book, "PD snapshots (est.)", 1, 0, 0, 0, 0, "storage", "Stateful disk backup.", Math.max(18, dataGi * 0.014)),
    line(book, "Cloud Load Balancing", 1, 0, 0, 0, 0, "network", "Forwarding rules + ingress.", 22),
    line(book, "Internet egress (est.)", 1, 0, 0, gb, 0, "network", `~${gb} GB/mo at $${book.gcpEgressGb}/GB.`, gb * book.gcpEgressGb),
    line(book, "Cloud NAT 3 AZ + Ops suite", 1, 0, 0, 0, 0, "managed", "Private GKE egress + logging.", 120),
  ];
  return bill(book, "GCP", "Google Kubernetes Engine", "kubernetes", "me-central1 (Doha)", [...lines, ...reportingManaged(plan, book)], instances);
}

function priceAwsVms(fleet: VmDeployable[], plan: CapacityPlan, book: LivePriceBook): CloudBill {
  const gb = egressGb(Math.max(1, plan.totalAppReplicas * 80));
  const nlb = 0.0254 * HOURS + 15;
  const priced = fleet.map((d) => ({ ...d, aws: { ...d.aws, usdHour: hour(book.aws, d.aws.sku, d.aws.usdHour) } }));
  const diskGi = priced.reduce((s, d) => s + (d.osDiskGi + d.dataDiskGi) * d.count, 0);
  const instances: CloudInstance[] = priced.map((d) => ({
    purpose: d.name,
    sku: d.aws.sku,
    qty: d.count,
    vcpu: d.aws.vcpu,
    memoryGi: d.aws.memoryGi,
    usdHour: d.aws.usdHour,
  }));
  const lines: SkuLine[] = [
    ...priced.map((d) =>
      line(
        book,
        `EC2 ${d.aws.sku} — ${d.name}`,
        d.count,
        d.aws.vcpu,
        d.aws.memoryGi,
        d.osDiskGi + d.dataDiskGi,
        d.aws.usdHour,
        "compute",
        `Live on-demand ${d.aws.sku} · ${d.notes}`
      )
    ),
    line(book, "EBS gp3 OS + data", 1, 0, 0, diskGi, 0, "storage", `Per-VM volumes at $${book.awsGp3GbMonth.toFixed(4)}/Gi-mo.`, diskGi * book.awsGp3GbMonth),
    line(book, "NLB + 3 AZ", 1, 0, 0, 0, 0, "network", "TCP/HTTPS to Kong VMs.", nlb),
    line(book, "Data transfer (est.)", 1, 0, 0, gb, 0, "network", `~${gb} GB/mo egress.`, gb * book.awsEgressGb),
    line(book, "VPC NAT + CloudWatch (est.)", 1, 0, 0, 0, 0, "managed", "NAT GW live hourly × 1 + logs.", book.awsNatHour * HOURS + 40),
  ];
  return bill(book, "AWS", "EC2 VM fleet", "virtual-machines", "me-central-1 (UAE)", [...lines, ...reportingManaged(plan, book)], instances);
}

function priceAzureVms(fleet: VmDeployable[], plan: CapacityPlan, book: LivePriceBook): CloudBill {
  const gb = egressGb(Math.max(1, plan.totalAppReplicas * 80));
  const priced = fleet.map((d) => ({ ...d, azure: { ...d.azure, usdHour: hour(book.azure, d.azure.sku, d.azure.usdHour) } }));
  const diskGi = priced.reduce((s, d) => s + (d.osDiskGi + 48 + d.dataDiskGi) * d.count, 0);
  const instances: CloudInstance[] = priced.map((d) => ({
    purpose: d.name,
    sku: d.azure.sku,
    qty: d.count,
    vcpu: d.azure.vcpu,
    memoryGi: d.azure.memoryGi,
    usdHour: d.azure.usdHour,
  }));
  const lines: SkuLine[] = [
    ...priced.map((d) =>
      line(
        book,
        `Azure ${d.azure.sku} — ${d.name}`,
        d.count,
        d.azure.vcpu,
        d.azure.memoryGi,
        d.osDiskGi + d.dataDiskGi,
        d.azure.usdHour,
        "compute",
        `Live ${d.azure.sku} UAE North · ${d.notes}`
      )
    ),
    line(book, "Managed Premium SSD", 1, 0, 0, diskGi, 0, "storage", `OS + data at $${book.azurePremiumGbMonth.toFixed(4)}/Gi-mo.`, diskGi * book.azurePremiumGbMonth),
    line(book, "Standard Load Balancer + Public IPs", 1, 0, 0, 0, 0, "network", "In front of Kong VMs.", 28),
    line(book, "Bandwidth outbound (est.)", 1, 0, 0, gb, 0, "network", `~${gb} GB/mo after 100 GB free.`, Math.max(0, (gb - 100) * book.azureEgressGb)),
    line(book, "Azure Monitor (est.)", 1, 0, 0, 0, 0, "managed", "VM insights light.", 70),
  ];
  return bill(book, "Azure", "Azure Virtual Machines", "virtual-machines", "UAE North", [...lines, ...reportingManaged(plan, book)], instances);
}

function priceGcpVms(fleet: VmDeployable[], plan: CapacityPlan, book: LivePriceBook): CloudBill {
  const gb = egressGb(Math.max(1, plan.totalAppReplicas * 80));
  const priced = fleet.map((d) => ({ ...d, gcp: { ...d.gcp, usdHour: hour(book.gcp, d.gcp.sku, d.gcp.usdHour) } }));
  const diskGi = priced.reduce((s, d) => s + (d.osDiskGi + d.dataDiskGi) * d.count, 0);
  const instances: CloudInstance[] = priced.map((d) => ({
    purpose: d.name,
    sku: d.gcp.sku,
    qty: d.count,
    vcpu: d.gcp.vcpu,
    memoryGi: d.gcp.memoryGi,
    usdHour: d.gcp.usdHour,
  }));
  const lines: SkuLine[] = [
    ...priced.map((d) =>
      line(
        book,
        `GCE ${d.gcp.sku} — ${d.name}`,
        d.count,
        d.gcp.vcpu,
        d.gcp.memoryGi,
        d.osDiskGi + d.dataDiskGi,
        d.gcp.usdHour,
        "compute",
        `Live ${d.gcp.sku} me-central1 · ${d.notes}`
      )
    ),
    line(book, "Persistent Disk SSD", 1, 0, 0, diskGi, 0, "storage", `pd-ssd at $${book.gcpSsdGbMonth.toFixed(4)}/Gi-mo.`, diskGi * book.gcpSsdGbMonth),
    line(book, "Cloud Load Balancing", 1, 0, 0, 0, 0, "network", "TCP/HTTPS to Kong VMs.", 22),
    line(book, "Internet egress (est.)", 1, 0, 0, gb, 0, "network", `~${gb} GB/mo.`, gb * book.gcpEgressGb),
    line(book, "Cloud Logging/Monitoring (est.)", 1, 0, 0, 0, 0, "managed", "Ops suite light.", 55),
  ];
  return bill(book, "GCP", "Compute Engine VM fleet", "virtual-machines", "me-central1 (Doha)", [...lines, ...reportingManaged(plan, book)], instances);
}

export function priceK8sClouds(plan: CapacityPlan, book: LivePriceBook = FALLBACK_RATES): CloudBill[] {
  return [priceEks(plan, book), priceAks(plan, book), priceGke(plan, book)];
}

export function priceVmClouds(plan: CapacityPlan, fleet: VmDeployable[], book: LivePriceBook = FALLBACK_RATES): CloudBill[] {
  return [priceAwsVms(fleet, plan, book), priceAzureVms(fleet, plan, book), priceGcpVms(fleet, plan, book)];
}
