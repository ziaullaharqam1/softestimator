import { pickTrio, type MachineShape } from "./instances";
import type { CapacityPlan, VmDeployable } from "./types";

function deployable(
  name: string,
  role: string,
  count: number,
  vcpu: number,
  memoryGi: number,
  dataDiskGi: number,
  shape: MachineShape,
  notes: string,
  osDiskGi = 80
): VmDeployable {
  const trio = pickTrio(shape, vcpu, memoryGi);
  return {
    name,
    role,
    count,
    vcpu,
    memoryGi,
    osDiskGi,
    dataDiskGi,
    shape,
    ...trio,
    notes,
  };
}

function shapeFor(role: string, name: string): MachineShape {
  if (name === "konga" || name === "jump-bastion" || name === "harbor-portal" || name === "cicd-control-plane") {
    return "burstable";
  }
  if (role === "gateway" || name === "kong") return "compute";
  if (
    role === "database" ||
    role === "cache" ||
    role === "warehouse" ||
    name.includes("elasticsearch") ||
    name.includes("zabbix-db") ||
    name === "harbor-blob-store" ||
    name.includes("warehouse") ||
    name.includes("powerbi")
  ) {
    return "memory";
  }
  return "general";
}

export function buildVmFleet(plan: CapacityPlan): VmDeployable[] {
  const items: VmDeployable[] = [];

  const app = plan.workloads.find((w) => w.name === "spring-boot-services");
  if (app) {
    const perVm = Math.max(2, Math.min(6, Math.floor(8 / Math.max(1, app.cpuLimit))));
    const vmCount = Math.max(3, Math.ceil(app.count / perVm));
    const vcpu = Math.max(4, Math.ceil(perVm * app.cpuLimit + 1));
    const mem = Math.max(8, Math.ceil(perVm * app.memoryGiLimit + 2));
    items.push(
      deployable(
        "spring-boot",
        "application",
        vmCount,
        vcpu,
        mem,
        80,
        "general",
        `${app.count} app processes packed ~${perVm}/VM behind Kong.`
      )
    );
  }

  for (const w of plan.workloads) {
    if (w.name === "spring-boot-services") continue;
    if (w.role === "platform" || w.role === "storage") continue;
    if (w.count <= 0) continue;

    const osOverheadCpu = 0.5;
    const osOverheadMem = 1;
    const vcpu = Math.max(2, Math.ceil(w.cpuLimit + osOverheadCpu));
    const mem = Math.max(2, Math.ceil(w.memoryGiLimit + osOverheadMem));
    const data = Math.max(40, Math.ceil(w.storageGi));
    const shape = shapeFor(w.role, w.name);
    const oneToOne =
      ["database", "cache", "messaging", "gateway", "warehouse"].includes(w.role) ||
      w.name === "elasticsearch" ||
      w.name === "jenkins-controller" ||
      w.name === "harbor-blob-store" ||
      w.name.includes("powerbi") ||
      w.name.includes("warehouse");
    const packed = !oneToOne && w.cpuLimit <= 1 && w.count > 2;
    const perVm = packed ? 2 : 1;
    const count = Math.ceil(w.count / perVm);
    const scaledCpu = packed ? vcpu * perVm : vcpu;
    const scaledMem = packed ? mem * perVm : mem;

    items.push(
      deployable(
        w.name,
        w.role,
        count,
        scaledCpu,
        scaledMem,
        packed ? data : data,
        shape,
        packed
          ? `${w.count} processes, 2 per VM. ${w.notes}`
          : `Dedicated VM per instance. ${w.notes}`
      )
    );
  }

  if (plan.architectureStyle === "microservices" && plan.reporting) {
    for (const v of plan.reporting.vms) {
      if (v.tier !== "gateway") continue;
      items.push(
        deployable("powerbi-gateway", "bi", v.count, v.vcpu, v.ramGi, v.diskGi, "memory", v.notes)
      );
    }
  }

  items.push(
    deployable(
      "jump-bastion",
      "ops",
      3,
      2,
      2,
      40,
      "burstable",
      "SSH/SSM jump hosts, one per AZ, not on the data path.",
      30
    )
  );

  return items;
}
