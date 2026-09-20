import type { ArchitectureStyle } from "../architecture";
import type { ReportingPlan } from "./reporting";

export type Messaging = "rabbitmq" | "kafka";
export type Observability = "elk" | "prometheus";
export type Visualization = "grafana" | "zabbix";
export type Hypervisor = "proxmox" | "vmware";
export type { ArchitectureStyle };

export interface PlannerInputs {
  architectureStyle: ArchitectureStyle;
  tps: number;
  springBootServices: number;
  messaging: Messaging;
  observability: Observability;
  visualization: Visualization;
  includeKonga: boolean;
  includeLonghorn: boolean;
  includeArgoCd: boolean;
  includeJenkins: boolean;
  includeCicdPipeline: boolean;
  includeHarbor: boolean;
  includeSuperset: boolean;
  includePowerBi: boolean;
  avgPayloadKb: number;
  writeRatio: number;
  logRetentionDays: number;
  dataRetentionDays: number;
  haLevel: "standard" | "strict";
  hypervisor: Hypervisor;
}

export interface PodSpec {
  name: string;
  role: string;
  count: number;
  cpuRequest: number;
  cpuLimit: number;
  memoryGiRequest: number;
  memoryGiLimit: number;
  storageGi: number;
  notes: string;
}

export interface NodePlan {
  role: "control-plane" | "worker" | "data" | "ingress" | "presentation" | "application" | "reporting";
  count: number;
  vcpu: number;
  memoryGi: number;
  osDiskGi: number;
  dataDiskGi: number;
  maxPods: number;
  notes: string;
}

export interface CapacityPlan {
  architectureStyle: ArchitectureStyle;
  assumptions: string[];
  peakConcurrent: number;
  totalAppReplicas: number;
  maxPodsPerVm: number;
  totalPods: number;
  clusterCpuRequest: number;
  clusterCpuLimit: number;
  clusterMemGiRequest: number;
  clusterMemGiLimit: number;
  persistentStorageGi: number;
  longhornPhysicalGi: number;
  wellArchitected: string[];
  workloads: PodSpec[];
  nodes: NodePlan[];
  vmCount: number;
  k8sNodeCount: number;
  reporting: ReportingPlan | null;
}

export interface SkuLine {
  sku: string;
  qty: number;
  vcpu: number;
  memoryGi: number;
  storageGi: number;
  usdHour: number;
  usdMonth: number;
  aedMonth: number;
  category: "compute" | "storage" | "network" | "managed" | "license" | "power" | "hardware";
  notes: string;
}

export interface CloudInstance {
  purpose: string;
  sku: string;
  qty: number;
  vcpu: number;
  memoryGi: number;
  usdHour: number;
}

export interface InstancePick {
  sku: string;
  vcpu: number;
  memoryGi: number;
  usdHour: number;
}

export interface VmDeployable {
  name: string;
  role: string;
  count: number;
  vcpu: number;
  memoryGi: number;
  osDiskGi: number;
  dataDiskGi: number;
  shape: "general" | "memory" | "compute" | "burstable";
  aws: InstancePick;
  azure: InstancePick;
  gcp: InstancePick;
  notes: string;
}

export interface LivePriceBook {
  fetchedAt: string;
  live: boolean;
  usdAed: number;
  aws: Record<string, number>;
  azure: Record<string, number>;
  gcp: Record<string, number>;
  awsGp3GbMonth: number;
  azurePremiumGbMonth: number;
  gcpSsdGbMonth: number;
  awsEksHour: number;
  azureAksSlaHour: number;
  gcpGkeHour: number;
  awsEgressGb: number;
  azureEgressGb: number;
  gcpEgressGb: number;
  awsNatHour: number;
  sources: string[];
  warnings: string[];
}

export interface CloudBill {
  provider: "AWS" | "Azure" | "GCP";
  product: string;
  mode: "kubernetes" | "virtual-machines";
  region: string;
  computeAed: number;
  storageAed: number;
  networkAed: number;
  managedAed: number;
  totalAed: number;
  totalUsd: number;
  instances: CloudInstance[];
  lines: SkuLine[];
  fetchedAt: string;
  live: boolean;
  usdAed: number;
}

export interface OnPremBill {
  capexAed: number;
  monthlyOpexAed: number;
  threeYearTcoAed: number;
  monthlyEquivalentAed: number;
  racks: number;
  physicalServers: number;
  vms: number;
  lines: SkuLine[];
  rackLayout: string[];
  vmInventory: {
    name: string;
    vcpu: number;
    memoryGi: number;
    diskGi: number;
    count: number;
    purpose: string;
  }[];
}
