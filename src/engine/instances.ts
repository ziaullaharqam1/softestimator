import type { InstancePick } from "./types";

export type MachineShape = "general" | "memory" | "compute" | "burstable";

interface CatalogSku {
  sku: string;
  vcpu: number;
  memoryGi: number;
  usdHour: number;
}

const aws: Record<MachineShape, CatalogSku[]> = {
  general: [
    { sku: "m6i.large", vcpu: 2, memoryGi: 8, usdHour: 0.112 },
    { sku: "m6i.xlarge", vcpu: 4, memoryGi: 16, usdHour: 0.224 },
    { sku: "m6i.2xlarge", vcpu: 8, memoryGi: 32, usdHour: 0.448 },
    { sku: "m6i.4xlarge", vcpu: 16, memoryGi: 64, usdHour: 0.896 },
    { sku: "m6i.8xlarge", vcpu: 32, memoryGi: 128, usdHour: 1.792 },
  ],
  memory: [
    { sku: "r6i.large", vcpu: 2, memoryGi: 16, usdHour: 0.151 },
    { sku: "r6i.xlarge", vcpu: 4, memoryGi: 32, usdHour: 0.302 },
    { sku: "r6i.2xlarge", vcpu: 8, memoryGi: 64, usdHour: 0.604 },
    { sku: "r6i.4xlarge", vcpu: 16, memoryGi: 128, usdHour: 1.208 },
    { sku: "r6i.8xlarge", vcpu: 32, memoryGi: 256, usdHour: 2.416 },
  ],
  compute: [
    { sku: "c6i.large", vcpu: 2, memoryGi: 4, usdHour: 0.098 },
    { sku: "c6i.xlarge", vcpu: 4, memoryGi: 8, usdHour: 0.196 },
    { sku: "c6i.2xlarge", vcpu: 8, memoryGi: 16, usdHour: 0.392 },
    { sku: "c6i.4xlarge", vcpu: 16, memoryGi: 32, usdHour: 0.784 },
  ],
  burstable: [
    { sku: "t3.small", vcpu: 2, memoryGi: 2, usdHour: 0.024 },
    { sku: "t3.medium", vcpu: 2, memoryGi: 4, usdHour: 0.048 },
    { sku: "t3.large", vcpu: 2, memoryGi: 8, usdHour: 0.096 },
  ],
};

const azure: Record<MachineShape, CatalogSku[]> = {
  general: [
    { sku: "Standard_D2s_v5", vcpu: 2, memoryGi: 8, usdHour: 0.096 },
    { sku: "Standard_D4s_v5", vcpu: 4, memoryGi: 16, usdHour: 0.192 },
    { sku: "Standard_D8s_v5", vcpu: 8, memoryGi: 32, usdHour: 0.384 },
    { sku: "Standard_D16s_v5", vcpu: 16, memoryGi: 64, usdHour: 0.768 },
    { sku: "Standard_D32s_v5", vcpu: 32, memoryGi: 128, usdHour: 1.536 },
  ],
  memory: [
    { sku: "Standard_E2s_v5", vcpu: 2, memoryGi: 16, usdHour: 0.126 },
    { sku: "Standard_E4s_v5", vcpu: 4, memoryGi: 32, usdHour: 0.252 },
    { sku: "Standard_E8s_v5", vcpu: 8, memoryGi: 64, usdHour: 0.504 },
    { sku: "Standard_E16s_v5", vcpu: 16, memoryGi: 128, usdHour: 1.008 },
    { sku: "Standard_E32s_v5", vcpu: 32, memoryGi: 256, usdHour: 2.016 },
  ],
  compute: [
    { sku: "Standard_F2s_v2", vcpu: 2, memoryGi: 4, usdHour: 0.085 },
    { sku: "Standard_F4s_v2", vcpu: 4, memoryGi: 8, usdHour: 0.169 },
    { sku: "Standard_F8s_v2", vcpu: 8, memoryGi: 16, usdHour: 0.338 },
    { sku: "Standard_F16s_v2", vcpu: 16, memoryGi: 32, usdHour: 0.677 },
  ],
  burstable: [
    { sku: "Standard_B1ms", vcpu: 1, memoryGi: 2, usdHour: 0.021 },
    { sku: "Standard_B2s", vcpu: 2, memoryGi: 4, usdHour: 0.042 },
    { sku: "Standard_B2ms", vcpu: 2, memoryGi: 8, usdHour: 0.083 },
  ],
};

const gcp: Record<MachineShape, CatalogSku[]> = {
  general: [
    { sku: "n2-standard-2", vcpu: 2, memoryGi: 8, usdHour: 0.097 },
    { sku: "n2-standard-4", vcpu: 4, memoryGi: 16, usdHour: 0.194 },
    { sku: "n2-standard-8", vcpu: 8, memoryGi: 32, usdHour: 0.388 },
    { sku: "n2-standard-16", vcpu: 16, memoryGi: 64, usdHour: 0.777 },
    { sku: "n2-standard-32", vcpu: 32, memoryGi: 128, usdHour: 1.554 },
  ],
  memory: [
    { sku: "n2-highmem-2", vcpu: 2, memoryGi: 16, usdHour: 0.131 },
    { sku: "n2-highmem-4", vcpu: 4, memoryGi: 32, usdHour: 0.262 },
    { sku: "n2-highmem-8", vcpu: 8, memoryGi: 64, usdHour: 0.524 },
    { sku: "n2-highmem-16", vcpu: 16, memoryGi: 128, usdHour: 1.048 },
    { sku: "n2-highmem-32", vcpu: 32, memoryGi: 256, usdHour: 2.096 },
  ],
  compute: [
    { sku: "n2-highcpu-2", vcpu: 2, memoryGi: 2, usdHour: 0.072 },
    { sku: "n2-highcpu-4", vcpu: 4, memoryGi: 4, usdHour: 0.143 },
    { sku: "n2-highcpu-8", vcpu: 8, memoryGi: 8, usdHour: 0.287 },
    { sku: "n2-highcpu-16", vcpu: 16, memoryGi: 16, usdHour: 0.573 },
  ],
  burstable: [
    { sku: "e2-small", vcpu: 2, memoryGi: 2, usdHour: 0.017 },
    { sku: "e2-medium", vcpu: 2, memoryGi: 4, usdHour: 0.034 },
    { sku: "e2-standard-2", vcpu: 2, memoryGi: 8, usdHour: 0.067 },
  ],
};

function pickFrom(list: CatalogSku[], vcpu: number, memoryGi: number): InstancePick {
  const fit = list.find((s) => s.vcpu >= vcpu && s.memoryGi >= memoryGi) ?? list[list.length - 1];
  return { sku: fit.sku, vcpu: fit.vcpu, memoryGi: fit.memoryGi, usdHour: fit.usdHour };
}

export function pickAws(shape: MachineShape, vcpu: number, memoryGi: number): InstancePick {
  return pickFrom(aws[shape], vcpu, memoryGi);
}

export function pickAzure(shape: MachineShape, vcpu: number, memoryGi: number): InstancePick {
  return pickFrom(azure[shape], vcpu, memoryGi);
}

export function pickGcp(shape: MachineShape, vcpu: number, memoryGi: number): InstancePick {
  return pickFrom(gcp[shape], vcpu, memoryGi);
}

export function allCatalogSkus() {
  const names = (table: Record<string, CatalogSku[]>) =>
    [...new Set(Object.values(table).flatMap((rows) => rows.map((r) => r.sku)))];
  return { aws: names(aws), azure: names(azure), gcp: names(gcp) };
}

export function pickTrio(shape: MachineShape, vcpu: number, memoryGi: number) {
  return {
    aws: pickAws(shape, vcpu, memoryGi),
    azure: pickAzure(shape, vcpu, memoryGi),
    gcp: pickGcp(shape, vcpu, memoryGi),
  };
}
