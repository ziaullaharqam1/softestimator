import type { CapacityPlan, OnPremBill, PlannerInputs, SkuLine } from "./types";

const aed = (n: number) => Math.round(n);

function hw(
  sku: string,
  qty: number,
  unitAed: number,
  notes: string,
  category: SkuLine["category"] = "hardware"
): SkuLine {
  const total = qty * unitAed;
  return {
    sku,
    qty,
    vcpu: 0,
    memoryGi: 0,
    storageGi: 0,
    usdHour: 0,
    usdMonth: 0,
    aedMonth: 0,
    category,
    notes: `${notes} Unit ${unitAed.toLocaleString()} AED · line ${total.toLocaleString()} AED (capex).`,
  };
}

export function priceOnPrem(plan: CapacityPlan, input: PlannerInputs): OnPremBill {
  const pools = plan.nodes.filter((n) => n.role !== "control-plane");
  const cps = plan.nodes.find((n) => n.role === "control-plane");

  const vmVcpu = pools.reduce((s, n) => s + n.count * n.vcpu, 0) + (cps ? cps.count * cps.vcpu : 0);
  const vmMem = pools.reduce((s, n) => s + n.count * n.memoryGi, 0) + (cps ? cps.count * cps.memoryGi : 0);
  const vmDisk =
    pools.reduce((s, n) => s + n.count * (n.osDiskGi + n.dataDiskGi), 0) +
    (cps ? cps.count * (cps.osDiskGi + cps.dataDiskGi) : 0);

  const coresPerHost = 64;
  const ramPerHost = 256;
  const nvmePerHostGi = 7680;
  const cpuHosts = Math.ceil((vmVcpu * 1.25) / coresPerHost);
  const memHosts = Math.ceil((vmMem * 1.25) / ramPerHost);
  const diskHosts = Math.ceil((vmDisk * 1.2) / nvmePerHostGi);
  const hosts = Math.max(3, cpuHosts, memHosts, diskHosts);

  const racks = Math.max(1, Math.ceil(hosts / 8));
  const hypervisor = input.hypervisor;

  const serverUnit = 68000;
  const switchTor = 22000;
  const switchMgmt = 4500;
  const rackUnit = 8500;
  const pdu = 3800;
  const ups = 28000;
  const cabling = 3500;
  const kvm = 4200;
  const install = 12000;
  const firewall = 18500;

  const capexLines: { sku: string; qty: number; unit: number; notes: string }[] = [
    {
      sku: "Dell PowerEdge R760 (or HPE DL380 Gen11)",
      qty: hosts,
      unit: serverUnit,
      notes: "2× Xeon Gold 6430 (32c/64t each → 64 cores), 256 Gi DDR5, 4×1.92 TB NVMe, dual 25GbE, iDRAC/iLO.",
    },
    {
      sku: "42U server rack + contained airflow",
      qty: racks,
      unit: rackUnit,
      notes: "Name-brand 42U, cable managers, blanking panels.",
    },
    {
      sku: "25/100Gb ToR leaf switch (48×25Gb + 8×100Gb)",
      qty: Math.max(2, racks * 2),
      unit: switchTor,
      notes: "HA pair per rack for east-west. MLAG/EVPN.",
    },
    {
      sku: "1Gb management switch",
      qty: racks,
      unit: switchMgmt,
      notes: "iDRAC/iLO, IPMI, PDU metering out-of-band.",
    },
    {
      sku: "Next-gen firewall HA pair (appliance)",
      qty: 2,
      unit: firewall,
      notes: "North-south edge, IPSec/SSL VPN, 10Gb.",
    },
    {
      sku: "Metered PDU (32A)",
      qty: racks * 2,
      unit: pdu,
      notes: "A+B feeds per rack.",
    },
    {
      sku: "UPS 10–20 kVA online double-conversion",
      qty: racks,
      unit: ups,
      notes: "N+ runtime ≥ 8 min to generator/ATS.",
    },
    {
      sku: "DAC/fiber, patch panels, rails, labelling",
      qty: racks,
      unit: cabling,
      notes: "Structured cabling kit.",
    },
    {
      sku: "KVM over IP / crash-cart",
      qty: 1,
      unit: kvm,
      notes: "Break-glass console access.",
    },
    {
      sku: "Rack-and-stack + network bring-up (labour)",
      qty: 1,
      unit: install * racks,
      notes: "Physical install, firmware, bonding, VLAN, NTP, backup jump host.",
    },
  ];

  if (hypervisor === "vmware") {
    capexLines.push({
      sku: "VMware vSphere Standard + vCenter (3yr list, allocated monthly later)",
      qty: hosts,
      unit: 18000,
      notes: "Per-socket class license ballpark; confirm with Broadcom quote. Shown as capex prepaid 3yr /3.",
    });
  }

  const lines: SkuLine[] = capexLines.map((c) => hw(c.sku, c.qty, c.unit, c.notes));

  const capexAed = capexLines.reduce((s, c) => s + c.qty * c.unit, 0);

  const wattsPerHost = 550;
  const pue = 1.55;
  const kwhMonth = (hosts * wattsPerHost * pue * 730) / 1000;
  const aedPerKwh = 0.44;
  const powerMonth = kwhMonth * aedPerKwh;
  const hardwareSupport = (hosts * serverUnit + racks * 2 * switchTor) * 0.12 / 12;
  const osLic = hypervisor === "vmware" ? hosts * 0 : hosts * 0;
  const rhelOrSusi = hosts * 180;
  const colo = racks * 4500;
  const backupSoftware = 900;
  const staffShare = 6500;

  const opexItems: SkuLine[] = [
    {
      sku: "Power + cooling (PUE 1.55)",
      qty: hosts,
      vcpu: 0,
      memoryGi: 0,
      storageGi: 0,
      usdHour: 0,
      usdMonth: 0,
      aedMonth: aed(powerMonth),
      category: "power",
      notes: `${Math.round(kwhMonth)} kWh/mo × ${aedPerKwh} AED/kWh commercial UAE-like rate.`,
    },
    {
      sku: "OEM 24×7 hardware support (12% of metal / 12)",
      qty: hosts,
      vcpu: 0,
      memoryGi: 0,
      storageGi: 0,
      usdHour: 0,
      usdMonth: 0,
      aedMonth: aed(hardwareSupport),
      category: "license",
      notes: "Dell ProSupport / HPE Foundation Care class.",
    },
    {
      sku: hypervisor === "vmware" ? "VMware SnS (annual / 12)" : "Proxmox subscription (Community/Standard)",
      qty: hosts,
      vcpu: 0,
      memoryGi: 0,
      storageGi: 0,
      usdHour: 0,
      usdMonth: 0,
      aedMonth: aed(hypervisor === "vmware" ? hosts * 420 : hosts * 95),
      category: "license",
      notes: hypervisor === "vmware" ? "Support & subscription after prepaid licenses." : "Optional; KVM/Proxmox can run without it.",
    },
    {
      sku: "RHEL or Ubuntu Pro / OS support",
      qty: hosts,
      vcpu: 0,
      memoryGi: 0,
      storageGi: 0,
      usdHour: 0,
      usdMonth: 0,
      aedMonth: aed(rhelOrSusi + osLic),
      category: "license",
      notes: "Per-host OS support for Kubernetes nodes.",
    },
    {
      sku: "Colo / data-hall (power ports + 42U)",
      qty: racks,
      vcpu: 0,
      memoryGi: 0,
      storageGi: 0,
      usdHour: 0,
      usdMonth: 0,
      aedMonth: aed(colo),
      category: "power",
      notes: "UAE/GCC colo ballpark per rack if not in owned DC. Drop if you already own the hall.",
    },
    {
      sku: "Backup software + offsite object target",
      qty: 1,
      vcpu: 0,
      memoryGi: 0,
      storageGi: 0,
      usdHour: 0,
      usdMonth: 0,
      aedMonth: aed(backupSoftware),
      category: "license",
      notes: "Velero + S3-compatible or Veeam class.",
    },
    {
      sku: "Platform engineering (fractional FTE)",
      qty: 1,
      vcpu: 0,
      memoryGi: 0,
      storageGi: 0,
      usdHour: 0,
      usdMonth: 0,
      aedMonth: aed(staffShare),
      category: "license",
      notes: input.architectureStyle === "monolith-3tier" ? "On-prem 3-tier ops is not free — 0.2–0.4 FTE allocated." : "On-prem K8s ops is not free — 0.3–0.5 FTE allocated.",
    },
  ];

  const monthlyOpexAed = opexItems.reduce((s, l) => s + l.aedMonth, 0);
  const threeYearTcoAed = capexAed + monthlyOpexAed * 36;
  const monthlyEquivalentAed = Math.round(capexAed / 36 + monthlyOpexAed);

  const vmInventory = [
    ...(cps
      ? [
          {
            name: "k8s-cp",
            vcpu: cps.vcpu,
            memoryGi: cps.memoryGi,
            diskGi: cps.osDiskGi + cps.dataDiskGi,
            count: cps.count,
            purpose: "Kubernetes control plane + etcd (one per failure domain).",
          },
        ]
      : []),
    ...pools
      .filter((p) => p.role !== "reporting")
      .map((p) => ({
      name: input.architectureStyle === "monolith-3tier" ? `tier-${p.role}` : `k8s-${p.role}`,
      vcpu: p.vcpu,
      memoryGi: p.memoryGi,
      diskGi: p.osDiskGi + p.dataDiskGi,
      count: p.count,
      purpose: p.notes,
    })),
    ...(plan.reporting
      ? plan.reporting.vms
          .filter((v) => input.architectureStyle !== "microservices" || v.tier === "gateway")
          .map((v) => ({
            name: v.name,
            vcpu: v.vcpu,
            memoryGi: v.ramGi,
            diskGi: v.diskGi,
            count: v.count,
            purpose: v.notes,
          }))
      : []),
    {
      name: "jump-bastion",
      vcpu: 2,
      memoryGi: 4,
      diskGi: 40,
      count: 1,
      purpose: "SSH/VPN break-glass, not in the cluster.",
    },
    {
      name: "backup-repo",
      vcpu: 4,
      memoryGi: 8,
      diskGi: 500,
      count: 1,
      purpose: "Velero/restic repo or NFS backup target.",
    },
  ];

  const rackLayout = [
    `Rack 1–${racks}: U42–U41 PDUs, U40 UPS/ATS, U38–U37 leaf HA pair, U36 mgmt switch, U35 firewall pair (rack 1 only).`,
    `U34–U${Math.max(10, 34 - hosts)}: ${hosts}× R760/DL380, 1U each + 1U cable. Leave 2U blanking for airflow.`,
    "Bonded 25Gb dual-homed to both leaves. iDRAC/iLO on isolated mgmt VLAN.",
    `Hypervisor: ${hypervisor === "vmware" ? "ESXi + vCenter" : "Proxmox VE / KVM"} with CPU pinning optional for Postgres/Kafka VMs.`,
    `Create ${plan.vmCount} ${input.architectureStyle === "monolith-3tier" ? "3-tier" : "cluster"} VMs + bastion + backup. Live-migration domain = all ${hosts} hosts.`,
    input.architectureStyle === "monolith-3tier"
      ? "Do not collocate PostgreSQL with application VMs. Presentation VMs stay in DMZ."
      : "etcd/control-plane VMs must not share a physical host (soft anti-affinity).",
  ];

  return {
    capexAed,
    monthlyOpexAed: aed(monthlyOpexAed),
    threeYearTcoAed,
    monthlyEquivalentAed,
    racks,
    physicalServers: hosts,
    vms: vmInventory.reduce((s, v) => s + v.count, 0),
    lines: [...lines, ...opexItems],
    rackLayout,
    vmInventory,
  };
}
