import type {
  InfraCapacity,
  InfraEnv,
  InfraHost,
  InfraPlan,
  InfraPolicy,
  InfraStorage,
  InfraVip,
  InfraVlan,
  InfraVm,
  PlannerBrief,
} from "./types";

const ENVS: InfraEnv[] = ["DEV", "UAT", "PRD"];

function pad(n: number, w = 2) {
  return String(n).padStart(w, "0");
}

export function siteCodeOf(client: string, product: string) {
  const raw = (client || product).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return raw.slice(0, 3) || "DXB";
}

function hypervisorOf(brief: PlannerBrief) {
  if (brief.architectureStyle === "monolith-3tier") {
    if (brief.deployment === "cloud") return "IaaS VMs / App Service equivalent (UAE/GCC region)";
    const t = `${brief.briefing} ${brief.constraints}`.toLowerCase();
    if (/vmware|vsphere|esxi/.test(t)) return "VMware vSphere / ESXi (3-tier guests)";
    return "Proxmox VE / KVM (3-tier guests)";
  }
  if (brief.deployment === "cloud") return "Managed Kubernetes + IaaS (UAE/GCC region)";
  const t = `${brief.briefing} ${brief.constraints}`.toLowerCase();
  if (/vmware|vsphere|esxi/.test(t)) return "VMware vSphere / ESXi";
  return "Proxmox VE / KVM";
}

function envOctet(env: InfraEnv, cloud: boolean) {
  if (cloud) {
    if (env === "DEV") return "10.60";
    if (env === "UAT") return "10.50";
    return "10.40";
  }
  if (env === "DEV") return "10.20";
  if (env === "UAT") return "10.30";
  return "10.10";
}

const ZONE_THIRD: Record<string, number> = {
  dmz: 10,
  app: 20,
  data: 30,
  mgmt: 40,
  backup: 50,
  hb: 60,
  vmotion: 70,
};

const VLAN_BASE: Record<InfraEnv, number> = { DEV: 100, UAT: 200, PRD: 10 };

function vlanId(env: InfraEnv, zone: keyof typeof ZONE_THIRD) {
  if (env === "PRD") return VLAN_BASE.PRD + (ZONE_THIRD[zone] / 10 - 1) * 10;
  return VLAN_BASE[env] + ZONE_THIRD[zone] / 10;
}

function cidr(env: InfraEnv, zone: keyof typeof ZONE_THIRD, cloud: boolean) {
  return `${envOctet(env, cloud)}.${ZONE_THIRD[zone]}.0/24`;
}

function gw(env: InfraEnv, zone: keyof typeof ZONE_THIRD, cloud: boolean) {
  return `${envOctet(env, cloud)}.${ZONE_THIRD[zone]}.1`;
}

class IpPool {
  private next: Record<string, number> = {};
  constructor(private cloud: boolean) {}
  take(env: InfraEnv, zone: keyof typeof ZONE_THIRD, reservedVip = false) {
    const key = `${env}-${zone}`;
    if (this.next[key] == null) this.next[key] = reservedVip ? 4 : 11;
    const n = this.next[key];
    this.next[key] = n + 1;
    return `${envOctet(env, this.cloud)}.${ZONE_THIRD[zone]}.${n}`;
  }
  vip(env: InfraEnv, zone: keyof typeof ZONE_THIRD, slot: number) {
    return `${envOctet(env, this.cloud)}.${ZONE_THIRD[zone]}.${slot}`;
  }
}

function scale(env: InfraEnv, prod: number, uat: number, dev: number) {
  if (env === "PRD") return prod;
  if (env === "UAT") return uat;
  return dev;
}

function ha(env: InfraEnv, kind: string) {
  if (env === "PRD") return kind;
  if (env === "UAT") return kind.includes("pair") ? "N+1 reduced" : "single + nightly backup";
  return "single; restore from backup";
}

export function buildInfrastructure(
  brief: PlannerBrief,
  product: string,
  client: string,
  modules: string[],
  users: number
): InfraPlan {
  const site = siteCodeOf(client, product);
  const domain = `${site.toLowerCase()}.corp.local`;
  const hypervisor = hypervisorOf(brief);
  const k8s = brief.architectureStyle !== "monolith-3tier";
  const cloud = brief.deployment === "cloud";
  const hybrid = brief.deployment === "hybrid";
  const concurrent = Math.max(20, Math.round(users * 0.1));
  const wrkPrd = Math.max(3, Math.ceil(users / 350));
  const wrkUat = Math.max(2, Math.ceil(users / 800));
  const wrkDev = 2;
  const busTech = /kafka/i.test(brief.briefing) ? "Kafka" : "RabbitMQ";
  const ips = new IpPool(cloud);

  const naming = k8s
    ? [
        `Pattern: ${site}-<ENV>-<ROLE>-<NN>  e.g. ${site}-PRD-MST-01 (Kubernetes master), ${site}-PRD-WKR-01 (Kubernetes worker)`,
        "ENV = DEV | UAT | PRD. Kubernetes node roles: MST = master/control plane (no user pods). WKR = worker (workloads).",
        `FQDN: <hostname>.${domain} (internal). Public names are on the VIP-LB sheet.`,
        "IPs are statically reserved. DHCP on mgmt VLAN is for ILO/iLO/OOB only, not guest OS.",
        "Do not reuse a hostname across environments. Decommission = tombstone DNS 30 days.",
        cloud
          ? "Cloud: guest names still apply to IaaS and node-pool instances. Managed PaaS rows have Type=managed in notes."
          : "On-premise: hostname is the guest; physical hosts are on the Physical-hosts sheet.",
        hybrid ? "Hybrid: internet-facing edge may live in cloud subnets 10.40/10.50/10.60; system of record stays on 10.10 data VLAN." : "",
      ].filter(Boolean)
    : [
        `Pattern: ${site}-<ENV>-<ROLE>-<NN>  e.g. ${site}-PRD-WEB-01 (presentation), ${site}-PRD-APP-01 (application), ${site}-PRD-PG-01 (data)`,
        "ENV = DEV | UAT | PRD. 3-tier roles: WEB = presentation / reverse proxy. APP = application (monolith). PG = database. No Kubernetes masters or workers.",
        `FQDN: <hostname>.${domain} (internal). Public names are on the VIP-LB sheet.`,
        "IPs are statically reserved. DHCP on mgmt VLAN is for ILO/iLO/OOB only, not guest OS.",
        "Do not reuse a hostname across environments. Decommission = tombstone DNS 30 days.",
        cloud
          ? "Cloud: guest names apply to IaaS. App Service / equivalent may replace APP rows if the Client chooses PaaS."
          : "On-premise: hostname is the guest; physical hosts are on the Physical-hosts sheet.",
        hybrid ? "Hybrid: internet-facing WEB may live in cloud; PostgreSQL stays on the data VLAN." : "",
      ].filter(Boolean);

  const vlans: InfraVlan[] = [];
  for (const env of ENVS) {
    const zones: { zone: keyof typeof ZONE_THIRD; name: string; purpose: string; dhcp: string }[] = [
      { zone: "dmz", name: `${env}-UNTRUST-DMZ`, purpose: "WAF, reverse proxy, public/partner VIP", dhcp: "Disabled" },
      { zone: "app", name: `${env}-APP`, purpose: "API gateway, Kubernetes / app VMs, mesh", dhcp: "Disabled" },
      { zone: "data", name: `${env}-DATA`, purpose: "PostgreSQL, Redis, bus, object store — no inbound internet", dhcp: "Disabled" },
      { zone: "mgmt", name: `${env}-MGMT`, purpose: "Jump, vault, monitoring, DNS/NTP, hypervisor mgmt", dhcp: "ILO/OOB only" },
      { zone: "backup", name: `${env}-BACKUP`, purpose: "Backup proxy and isolated target; not a user path", dhcp: "Disabled" },
    ];
    if (!cloud) {
      zones.push({ zone: "hb", name: `${env}-HB`, purpose: "Cluster heartbeat / Corosync / vSAN witness path", dhcp: "Disabled" });
      zones.push({ zone: "vmotion", name: `${env}-VMOTION`, purpose: "Live migration. No guest OS. Isolated.", dhcp: "Disabled" });
    }
    for (const z of zones) {
      const dnsHere = `${envOctet(env, cloud)}.${ZONE_THIRD.mgmt}.11, ${envOctet(env, cloud)}.${ZONE_THIRD.mgmt}.12`;
      vlans.push({
        env,
        vlanId: vlanId(env, z.zone),
        name: z.name,
        zone: z.zone.toUpperCase(),
        cidr: cidr(env, z.zone, cloud),
        mask: "255.255.255.0",
        gateway: gw(env, z.zone, cloud),
        dns: dnsHere,
        ntp: dnsHere,
        dhcp: z.dhcp,
        purpose: z.purpose,
      });
    }
  }

  const vms: InfraVm[] = [];
  const storage: InfraStorage[] = [];
  const vips: InfraVip[] = [];
  const dns: InfraPlan["dns"] = [];

  const addVm = (vm: InfraVm) => {
    vms.push(vm);
    dns.push({
      name: vm.fqdn,
      type: "A",
      value: vm.ip,
      env: vm.env,
      notes: vm.role,
    });
    if (vm.dataDiskGi > 0) {
      storage.push({
        volume: `${vm.hostname}-data`,
        env: vm.env,
        type: vm.role.includes("PG") ? "Thick eager / premium SSD" : "Thin / SSD",
        sizeGi: vm.dataDiskGi,
        replica: vm.env === "PRD" ? "RAID-10 or storage policy FTT=1" : "RAID-5/1",
        mountOrLun: vm.role.includes("PG") ? "/var/lib/postgresql" : vm.role.includes("OBJ") ? "/data" : "/var/data",
        owner: vm.hostname,
        encryption: "VMDK/volume encryption + OS LUKS where policy requires",
        backup: vm.backupPolicy,
      });
    }
  };

  const host = (env: InfraEnv, role: string, n: number) => {
    const hostname = `${site}-${env}-${role}-${pad(n)}`;
    return { hostname, fqdn: `${hostname.toLowerCase()}.${domain}` };
  };

  for (const env of ENVS) {
    const wrkN = scale(env, wrkPrd, wrkUat, wrkDev);
    const cpN = scale(env, 3, 1, 1);
    const wafN = scale(env, 2, 2, 1);
    const lbN = scale(env, 2, 2, 1);
    const pgN = scale(env, 3, 2, 1);
    const rdsN = scale(env, 3, 2, 1);
    const busN = scale(env, 3, 1, 1);
    const objN = scale(env, 3, 1, 1);
    const vltN = scale(env, 2, 1, 1);
    const monN = scale(env, 2, 1, 1);
    const cluster = k8s ? `${site}-${env}-K8S` : `${site}-${env}-APP`;
    const wrkCpu = scale(env, 8, 4, 4);
    const wrkRam = scale(env, 32, 16, 8);
    const mstCpu = scale(env, 4, 4, 2);
    const mstRam = scale(env, 16, 8, 8);
    const pgCpu = scale(env, 8, 4, 4);
    const pgRam = scale(env, 64, 16, 8);
    const pgData = scale(env, Math.max(500, Math.ceil(users / 2)), 200, 80);

    const vipWaf = ips.vip(env, "dmz", 4);
    const vipLb = ips.vip(env, "dmz", 5);
    const vipK8s = ips.vip(env, "app", 4);
    const vipPg = ips.vip(env, "data", 4);
    const vipBus = ips.vip(env, "data", 5);
    const vipObj = ips.vip(env, "data", 6);
    const dnsLocal = `${envOctet(env, cloud)}.${ZONE_THIRD.mgmt}.11, ${envOctet(env, cloud)}.${ZONE_THIRD.mgmt}.12`;

    vips.push(
      {
        name: `${site}-${env}-WAF-VIP`,
        env,
        dns: `${product
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}${env === "PRD" ? "" : "-" + env.toLowerCase()}.${domain.replace(".corp.local", ".ae")}`,
        vip: vipWaf,
        vlanId: vlanId(env, "dmz"),
        pool: `${site}-${env}-WAF`,
        ports: "443, 80 (redirect)",
        persistence: "Source-IP 30m",
        healthCheck: "HTTPS /healthz 5s",
        cert: `${site}-${env}-edge.pfx — TLS 1.2+`,
      },
      {
        name: `${site}-${env}-LB-VIP`,
        env,
        dns: `api-${env.toLowerCase()}.${domain}`,
        vip: vipLb,
        vlanId: vlanId(env, "dmz"),
        pool: `${site}-${env}-LB`,
        ports: "443",
        persistence: "None (JWT)",
        healthCheck: "HTTPS /readyz",
        cert: `${site}-${env}-api.pfx`,
      },
      {
        name: k8s ? `${site}-${env}-K8S-API` : `${site}-${env}-APP-VIP`,
        env,
        dns: k8s ? `k8s-${env.toLowerCase()}.${domain}` : `app-${env.toLowerCase()}.${domain}`,
        vip: vipK8s,
        vlanId: vlanId(env, "app"),
        pool: k8s ? `${site}-${env}-MST (Kubernetes masters)` : `${site}-${env}-APP (application tier)`,
        ports: k8s ? "6443" : "8080, 8443",
        persistence: k8s ? "None — kube-apiserver HA" : "Cookie optional; prefer Redis session",
        healthCheck: k8s ? "HTTPS /readyz on 6443" : "HTTPS /healthz on app",
        cert: k8s ? "Kubernetes API serving cert (vault)" : `${site}-${env}-app.pfx`,
      },
      {
        name: `${site}-${env}-PG-VIP`,
        env,
        dns: `pg-${env.toLowerCase()}.${domain}`,
        vip: vipPg,
        vlanId: vlanId(env, "data"),
        pool: `${site}-${env}-PG`,
        ports: "5432",
        persistence: "None — driver targets primary",
        healthCheck: "pg_isready",
        cert: "N/A (private, TLS to node)",
      }
    );

    const mk = (
      role: string,
      n: number,
      fn: string,
      zone: keyof typeof ZONE_THIRD,
      os: string,
      vcpu: number,
      ramGi: number,
      osDiskGi: number,
      dataDiskGi: number,
      extraDisks: string,
      haMode: string,
      backup: string,
      notes: string,
      vip = "",
      k8sRole: InfraVm["k8sRole"] = "",
      k8sTaints = "",
      cri = ""
    ) => {
      const h = host(env, role, n);
      const ip = ips.take(env, zone);
      addVm({
        hostname: h.hostname,
        fqdn: h.fqdn,
        env,
        role,
        function: fn,
        cluster,
        hypervisor: cloud && /MST|WKR|WEB|APP/.test(role) ? "Node pool / IaaS instance" : hypervisor,
        os,
        vcpu,
        ramGi,
        osDiskGi,
        dataDiskGi,
        extraDisks,
        vlanId: vlanId(env, zone),
        vlanName: `${env}-${zone.toUpperCase()}`,
        subnet: cidr(env, zone, cloud),
        ip,
        vip,
        gateway: gw(env, zone, cloud),
        dns: dnsLocal,
        ntp: dnsLocal,
        ha: haMode,
        backupPolicy: backup,
        monitoring: k8s ? "node_exporter + kubelet metrics; 15s scrape" : "node_exporter + app metrics; 15s scrape",
        notes,
        k8sRole,
        k8sTaints,
        cri,
      });
    };

    mk("JMP", 1, "Bastion / PAM landing", "mgmt", "Ubuntu 24.04 LTS", 2, 4, 80, 0, "", ha(env, "single + break-glass"), "Weekly image", "SSH from PAM only. No prod data. Session recorded.", "");
    if (env === "PRD") mk("JMP", 2, "Bastion standby", "mgmt", "Ubuntu 24.04 LTS", 2, 4, 80, 0, "", "standby", "Weekly image", "Cold standby. Same hardening.", "");

    for (let i = 1; i <= wafN; i++) {
      mk("WAF", i, "WAF / reverse proxy", "dmz", "Appliance / Ubuntu + WAF", 4, 8, 80, 40, "", ha(env, "active-active pair"), "Config nightly", "TLS edge, bot/geo, OWASP CRS. Pairs with WAF VIP.", i === 1 ? vipWaf : "");
    }
    for (let i = 1; i <= lbN; i++) {
      mk("LB", i, k8s ? "L4/L7 load balancer" : "L4/L7 load balancer to application tier", "dmz", "Appliance / HAProxy", 4, 8, 80, 20, "", ha(env, "active-passive pair"), "Config nightly", k8s ? "Health checks to Kubernetes workers via ingress. No business logic." : "Health checks to APP VMs. No business logic.", i === 1 ? vipLb : "");
    }
    if (k8s) {
    for (let i = 1; i <= cpN; i++) {
      mk(
        "MST",
        i,
        i === 1 ? "Kubernetes master (control plane, etcd leader eligible, kube-apiserver)" : "Kubernetes master (control plane, stacked etcd)",
        "app",
        "Ubuntu 24.04 + kubeadm/RKE2",
        mstCpu,
        mstRam,
        80,
        80,
        "etcd 40 Gi dedicated disk",
        ha(env, "odd quorum — 3 masters in PRD"),
        "etcd snapshot hourly",
        cloud
          ? "If the Client uses managed Kubernetes, this row is the control-plane equivalent (do not schedule pods)."
          : `No user pods. Tainted node-role.kubernetes.io/control-plane:NoSchedule. kube-apiserver VIP ${vipK8s}:6443.`,
        i === 1 ? vipK8s : "",
        "master",
        "node-role.kubernetes.io/control-plane:NoSchedule, node-role.kubernetes.io/master:NoSchedule",
        "containerd (CRI) — kubelet on master only for control-plane static pods"
      );
    }
    for (let i = 1; i <= wrkN; i++) {
      const mod = modules[(i - 1) % Math.max(modules.length, 1)] ?? "core";
      mk(
        "WKR",
        i,
        `Kubernetes worker (kubelet + CRI; schedules ${mod} and platform pods)`,
        "app",
        "Ubuntu 24.04 + kubelet",
        wrkCpu,
        wrkRam,
        80,
        200,
        "containerd 100 Gi",
        ha(env, "N+1 worker pool"),
        "Daily incremental; exclude ephemeral emptyDir",
        `Schedulable. Labels: node-role.kubernetes.io/worker=, workload=${mod.replace(/\s+/g, "-").toLowerCase()}. Concurrent design ~${concurrent} sessions across workers.`,
        "",
        "worker",
        "none (schedulable)",
        "containerd 1.7+ / kubelet"
      );
    }
    } else {
    const webN = scale(env, 2, 2, 1);
    for (let i = 1; i <= webN; i++) {
      mk("WEB", i, "Presentation tier (reverse proxy / static)", "dmz", "Ubuntu 24.04 + Nginx", 4, 8, 80, 40, "", ha(env, "active-active pair"), "Config nightly", "TLS to users. Proxies to APP VIP. No business logic.", "");
    }
    for (let i = 1; i <= wrkN; i++) {
      const mod = modules[(i - 1) % Math.max(modules.length, 1)] ?? "core";
      mk(
        "APP",
        i,
        `Application tier (monolith process; packages include ${mod})`,
        "app",
        "Ubuntu 24.04 + JRE/.NET",
        wrkCpu,
        wrkRam,
        80,
        80,
        "",
        ha(env, "N+1 application pool"),
        "Daily incremental",
        `One binary. Concurrent design ~${concurrent} sessions. Session in Redis. VIP ${vipK8s}.`,
        i === 1 ? vipK8s : "",
        "",
        "",
        ""
      );
    }
    }
    for (let i = 1; i <= pgN; i++) {
      const fn = i === 1 ? "PostgreSQL primary (SoR)" : i === 2 ? "PostgreSQL sync/semi-sync replica" : "PostgreSQL witness / async";
      mk("PG", i, fn, "data", "Ubuntu 24.04 + PostgreSQL 16", pgCpu, pgRam, 80, pgData, "WAL 100 Gi; archive 200 Gi", ha(env, "auto-failover via Patroni/repmgr"), "PITR WAL + nightly full; RPO ≤ 15 min", i === 1 ? `VIP ${vipPg}. No public IP. App VLAN only.` : "Read replica is not a second writer.", i === 1 ? vipPg : "");
    }
    for (let i = 1; i <= rdsN; i++) {
      mk("RDS", i, i === 1 ? "Redis primary (cache)" : "Redis replica", "data", "Ubuntu 24.04 + Redis 7", 4, scale(env, 16, 8, 4), 40, 40, "", ha(env, "Sentinel/cluster"), "RDB snapshot daily — cache only", "Never system of record. TTL + explicit invalidate.", "");
    }
    for (let i = 1; i <= busN; i++) {
      mk("BUS", i, `${busTech} broker`, "data", "Ubuntu 24.04", 4, 16, 80, 200, "", ha(env, "3-node quorum"), "Topic/queue snapshot daily", `Consumers idempotent. Outbox is on PG, not on the bus.`, i === 1 ? vipBus : "");
    }
    for (let i = 1; i <= objN; i++) {
      mk("OBJ", i, "Object store (S3-compat)", "data", "Ubuntu 24.04 + MinIO", 4, 16, 80, scale(env, 2000, 500, 200), "erasure set", ha(env, "erasure coding"), "Versioning + immutable lock if licensed", "DB holds object key + checksum, not the blob.", i === 1 ? vipObj : "");
    }
    for (let i = 1; i <= vltN; i++) {
      mk("VLT", i, "Secrets / PKI vault", "mgmt", "Ubuntu 24.04 + Vault", 2, 8, 80, 40, "seal device / HSM note", ha(env, "HA storage backend"), "Raft snapshot daily — no secret plaintext in backup logs", "Unseal via Shamir or auto-unseal. No prod data path.", "");
    }
    for (let i = 1; i <= monN; i++) {
      mk("MON", i, i === 1 ? "Metrics / Prometheus" : "Logs / SIEM sink", "mgmt", "Ubuntu 24.04", 4, 16, 80, scale(env, 500, 200, 80), "", "single per role", "Index ILM 30–90 days", "No PII in traces beyond hashed ids.", "");
    }
    mk("BAK", 1, "Backup proxy / catalog", "backup", "Ubuntu 24.04 + backup agent", 4, 16, 80, 100, "catalog 200 Gi", "single + DR copy", "Self-backup weekly to isolated target", "Talks to PG/OBJ over backup VLAN. Immutable target on NAS/object from BOQ.", "");
    if (env === "PRD" && !cloud) {
      mk("DNS", 1, "Internal DNS / NTP primary", "mgmt", "Ubuntu 24.04", 2, 4, 40, 0, "", "HA pair", "Config nightly", "Authoritative for " + domain, "");
      mk("DNS", 2, "Internal DNS / NTP secondary", "mgmt", "Ubuntu 24.04", 2, 4, 40, 0, "", "HA pair", "Config nightly", "Forwarders: Client recursive resolvers.", "");
    }
    if (hybrid && env === "PRD") {
      mk("VPN", 1, "Cloud–DC overlay / concentrator", "dmz", "Appliance", 4, 8, 40, 0, "", "HA pair", "Config nightly", "IPsec or private interconnect. No split-tunnel for SoR.", "");
      mk("VPN", 2, "Cloud–DC overlay standby", "dmz", "Appliance", 4, 8, 40, 0, "", "standby", "Config nightly", "Matches VPN-01 PSK/certs in vault.", "");
    }

    dns.push(
      { name: vips.find((x) => x.name.endsWith("-WAF-VIP") && x.env === env)?.dns ?? "", type: "A", value: vipWaf, env, notes: "Public/edge VIP" },
      { name: `api-${env.toLowerCase()}.${domain}`, type: "A", value: vipLb, env, notes: "Internal API VIP" },
      { name: k8s ? `k8s-${env.toLowerCase()}.${domain}` : `app-${env.toLowerCase()}.${domain}`, type: "A", value: vipK8s, env, notes: k8s ? "Kubernetes API (masters) :6443" : "Application-tier VIP" },
      { name: `pg-${env.toLowerCase()}.${domain}`, type: "A", value: vipPg, env, notes: "PostgreSQL VIP" }
    );
  }

  const hosts: InfraHost[] = [];
  if (!cloud) {
    const appHosts = Math.max(3, 2 + Math.max(1, Math.ceil(users / 500)));
    const dbHosts = 3;
    for (let i = 1; i <= appHosts; i++) {
      hosts.push({
        name: `${site}-PRD-ESX-${pad(i)}`,
        env: "PRD",
        role: i === appHosts ? "N+1 spare compute" : "App / platform hypervisor",
        cpu: "Dual-socket 64c",
        ramGi: 256,
        localNvmeGi: 3200,
        cluster: `${site}-PRD-C01`,
        mgmtIp: `10.10.40.${80 + i}`,
        vlan: "PRD-MGMT + vMotion + HB",
      });
    }
    for (let i = 1; i <= dbHosts; i++) {
      hosts.push({
        name: `${site}-PRD-DBH-${pad(i)}`,
        env: "PRD",
        role: i === 1 ? "PostgreSQL primary host" : i === 2 ? "Replica host" : "Witness / backup host",
        cpu: "Dual-socket 64c",
        ramGi: 256,
        localNvmeGi: 6400,
        cluster: `${site}-PRD-DATA`,
        mgmtIp: `10.10.40.${90 + i}`,
        vlan: "PRD-MGMT + DATA (dedicated NICs)",
      });
    }
    hosts.push(
      {
        name: `${site}-UAT-ESX-01`,
        env: "UAT",
        role: "Shared UAT hypervisor",
        cpu: "Dual-socket 32c",
        ramGi: 128,
        localNvmeGi: 1600,
        cluster: `${site}-UAT-C01`,
        mgmtIp: "10.30.40.21",
        vlan: "UAT-MGMT",
      },
      {
        name: `${site}-DEV-ESX-01`,
        env: "DEV",
        role: "Shared DEV hypervisor",
        cpu: "Dual-socket 16c",
        ramGi: 64,
        localNvmeGi: 800,
        cluster: `${site}-DEV-C01`,
        mgmtIp: "10.20.40.21",
        vlan: "DEV-MGMT",
      }
    );
  } else {
    for (const env of ENVS) {
      const n = scale(env, Math.max(4, 3 + Math.ceil(users / 500)), 3, 2);
      for (let i = 1; i <= n; i++) {
        hosts.push({
          name: `${site}-${env}-NODE-${pad(i)}`,
          env,
          role: "Managed K8s worker (billing node)",
          cpu: "8 vCPU",
          ramGi: 32,
          localNvmeGi: 200,
          cluster: `${site}-${env}-EKS`,
          mgmtIp: ips.take(env, "app"),
          vlan: `${env}-APP private subnet`,
        });
      }
    }
  }

  const policies: InfraPolicy[] = [];
  let pn = 1;
  const pol = (p: Omit<InfraPolicy, "id">) => {
    policies.push({ ...p, id: `FW-${pad(pn++, 3)}` });
  };
  for (const env of ENVS) {
    const wafVip = vms.find((v) => v.env === env && v.role === "WAF" && v.vip)?.vip || "";
    const wrkNet = cidr(env, "app", cloud);
    const dataNet = cidr(env, "data", cloud);
    const mgmtNet = cidr(env, "mgmt", cloud);
    const dmzNet = cidr(env, "dmz", cloud);
    const bakNet = cidr(env, "backup", cloud);
    const jmp = vms.find((v) => v.env === env && v.role === "JMP")?.ip ?? "";
    const pgVip = `pg-${env.toLowerCase()}.${domain}`;
    const dnsLocal = `${envOctet(env, cloud)}.${ZONE_THIRD.mgmt}.11, ${envOctet(env, cloud)}.${ZONE_THIRD.mgmt}.12`;

    pol({ env, name: "Internet to WAF HTTPS", direction: "north-south", fromZone: "UNTRUST", toZone: "DMZ", source: "any (or CDN)", destination: wafVip || dmzNet, service: "tcp/443", action: "allow", logging: "session", nat: "destination NAT to WAF pool", notes: "HSTS at WAF. HTTP 80 redirect only." });
    pol({ env, name: "Internet HTTP redirect", direction: "north-south", fromZone: "UNTRUST", toZone: "DMZ", source: "any", destination: wafVip || dmzNet, service: "tcp/80", action: "allow", logging: "minimal", nat: "DNAT WAF", notes: "301 to HTTPS. No application on 80." });
    pol({ env, name: "Partner mTLS", direction: "north-south", fromZone: "UNTRUST", toZone: "DMZ", source: "partner WAN prefixes [TBD]", destination: wafVip, service: "tcp/443", action: "allow", logging: "full", nat: "DNAT WAF", notes: "Client cert required. Else deny." });
    pol({ env, name: "WAF to LB", direction: "east-west", fromZone: "DMZ", toZone: "DMZ", source: `${site}-${env}-WAF-*`, destination: `${site}-${env}-LB-VIP`, service: "tcp/443", action: "allow", logging: "session", nat: "none", notes: "No WAF to data VLAN." });
    if (k8s) {
      pol({ env, name: "LB to Kubernetes workers (ingress)", direction: "east-west", fromZone: "DMZ", toZone: "APP", source: `${site}-${env}-LB-*`, destination: `${site}-${env}-WKR-*`, service: "tcp/443, tcp/8443, tcp/30080-32767 (NodePort if used)", action: "allow", logging: "session", nat: "none", notes: "Ingress on workers only. Not on masters." });
      pol({ env, name: "kube-apiserver to masters", direction: "east-west", fromZone: "APP", toZone: "APP", source: `${wrkNet}; jump`, destination: `k8s-${env.toLowerCase()}.${domain} (${site}-${env}-MST-*)`, service: "tcp/6443", action: "allow", logging: "session", nat: "none", notes: "Workers, CI, and jump only. Not from UNTRUST." });
      pol({ env, name: "kubelet from masters to workers", direction: "east-west", fromZone: "APP", toZone: "APP", source: `${site}-${env}-MST-*`, destination: `${site}-${env}-WKR-*`, service: "tcp/10250", action: "allow", logging: "sampled", nat: "none", notes: "kubelet. Do not expose 10250 off-cluster." });
      pol({ env, name: "etcd between masters", direction: "east-west", fromZone: "APP", toZone: "APP", source: `${site}-${env}-MST-*`, destination: `${site}-${env}-MST-*`, service: "tcp/2379, tcp/2380", action: "allow", logging: "sampled", nat: "none", notes: "Stacked etcd. Not from workers." });
      pol({ env, name: "No pods on masters from LB", direction: "east-west", fromZone: "DMZ", toZone: "APP", source: `${site}-${env}-LB-*`, destination: `${site}-${env}-MST-*`, service: "tcp/80, tcp/443, tcp/8080", action: "deny", logging: "full", nat: "none", notes: "Masters are control plane only." });
    } else {
      pol({ env, name: "LB to application tier", direction: "east-west", fromZone: "DMZ", toZone: "APP", source: `${site}-${env}-LB-*`, destination: `${site}-${env}-APP-*`, service: "tcp/8080, tcp/8443", action: "allow", logging: "session", nat: "none", notes: "Application VMs only. Not the database." });
      pol({ env, name: "WEB to APP", direction: "east-west", fromZone: "DMZ", toZone: "APP", source: `${site}-${env}-WEB-*`, destination: `${site}-${env}-APP-*`, service: "tcp/8080, tcp/8443", action: "allow", logging: "session", nat: "none", notes: "Presentation proxies to application. No SQL from WEB." });
    }
    pol({ env, name: k8s ? "Workers to PostgreSQL" : "Application to PostgreSQL", direction: "east-west", fromZone: "APP", toZone: "DATA", source: wrkNet, destination: pgVip, service: "tcp/5432", action: "allow", logging: "session", nat: "none", notes: "TLS. No DMZ to 5432." });
    pol({ env, name: "Workers to Redis", direction: "east-west", fromZone: "APP", toZone: "DATA", source: wrkNet, destination: `${site}-${env}-RDS-*`, service: "tcp/6379", action: "allow", logging: "session", nat: "none", notes: "AUTH + TLS. Cache only." });
    pol({ env, name: `Workers to ${busTech}`, direction: "east-west", fromZone: "APP", toZone: "DATA", source: wrkNet, destination: `${site}-${env}-BUS-*`, service: busTech === "Kafka" ? "tcp/9092, tcp/9093" : "tcp/5671, tcp/5672", action: "allow", logging: "session", nat: "none", notes: "mTLS where licensed." });
    pol({ env, name: "Workers to object store", direction: "east-west", fromZone: "APP", toZone: "DATA", source: wrkNet, destination: `${site}-${env}-OBJ-*`, service: "tcp/443, tcp/9000", action: "allow", logging: "session", nat: "none", notes: "Presigned URLs preferred for browsers." });
    pol({ env, name: "Mesh east-west", direction: "east-west", fromZone: "APP", toZone: "APP", source: wrkNet, destination: wrkNet, service: "tcp/15008, tcp/8443 (mTLS)", action: "allow", logging: "sampled", nat: "none", notes: "Default-deny except mesh + DNS." });
    pol({ env, name: "App DNS/NTP", direction: "east-west", fromZone: "APP", toZone: "MGMT", source: wrkNet, destination: dnsLocal, service: "udp/53, tcp/53, udp/123", action: "allow", logging: "deny-only", nat: "none", notes: mgmtNet });
    pol({ env, name: "Workers to vault", direction: "east-west", fromZone: "APP", toZone: "MGMT", source: wrkNet, destination: `${site}-${env}-VLT-*`, service: "tcp/8200", action: "allow", logging: "full", nat: "none", notes: "AppRole/K8s auth. No human tokens on workers." });
    pol({ env, name: "PAM to jump", direction: "mgmt", fromZone: "MGMT-IN", toZone: "MGMT", source: "Client PAM / jump CIDR [TBD]", destination: jmp, service: "tcp/22", action: "allow", logging: "full + session rec", nat: "none", notes: "MFA at PAM. No direct SSH from internet." });
    pol({ env, name: "Jump to guests SSH", direction: "mgmt", fromZone: "MGMT", toZone: "APP/DATA", source: jmp, destination: `${wrkNet}; ${dataNet}`, service: "tcp/22", action: "allow", logging: "full", nat: "none", notes: "Named break-glass. Time-bounded." });
    pol({ env, name: "No SSH from internet", direction: "north-south", fromZone: "UNTRUST", toZone: "any", source: "any", destination: "any", service: "tcp/22, tcp/3389", action: "deny", logging: "full", nat: "none", notes: "Explicit deny even if a later allow is mis-ordered." });
    pol({ env, name: "No DMZ to data", direction: "east-west", fromZone: "DMZ", toZone: "DATA", source: dmzNet, destination: dataNet, service: "any", action: "deny", logging: "full", nat: "none", notes: "WAF/LB never talk to PostgreSQL." });
    pol({ env, name: "Backup pull", direction: "backup", fromZone: "BACKUP", toZone: "DATA", source: bakNet, destination: dataNet, service: "tcp/5432, tcp/9000, tcp/22", action: "allow", logging: "session", nat: "none", notes: "Backup VLAN only. No user route." });
    pol({ env, name: "Telemetry", direction: "mgmt", fromZone: "APP/DATA", toZone: "MGMT", source: `${wrkNet}; ${dataNet}`, destination: `${site}-${env}-MON-*`, service: "tcp/9090, tcp/4317, tcp/5044", action: "allow", logging: "sampled", nat: "none", notes: "OTLP/gRPC. Strip PII at agent." });
    pol({ env, name: "Default deny", direction: "east-west", fromZone: "any", toZone: "any", source: "any", destination: "any", service: "any", action: "deny", logging: "full", nat: "none", notes: "Last rule. Implicit drop on NSG too." });
    pol({ env, name: "Egress pinned NAT", direction: "north-south", fromZone: "APP", toZone: "UNTRUST", source: wrkNet, destination: "IdP, UAE Pass, mail/SMS, artefact registries [TBD]", service: "tcp/443", action: "allow", logging: "session", nat: "source NAT to pinned egress IP", notes: "No general web browse from prod." });
  }

  const capacity: InfraCapacity[] = ENVS.map((env) => {
    const set = vms.filter((v) => v.env === env);
    return {
      env,
      vmCount: set.length,
      vcpu: set.reduce((s, v) => s + v.vcpu, 0),
      ramGi: set.reduce((s, v) => s + v.ramGi, 0),
      osDiskGi: set.reduce((s, v) => s + v.osDiskGi, 0),
      dataDiskGi: set.reduce((s, v) => s + v.dataDiskGi, 0),
    };
  });

  return {
    siteCode: site,
    domain,
    hypervisor,
    runtime: k8s ? "kubernetes" : "three-tier",
    naming,
    vlans,
    vms,
    policies,
    storage,
    vips,
    hosts,
    dns,
    capacity,
    assumptions: [
      "Planning addressing. Confirm with Client IPAM before cabling or VPC build. Collisions with existing 10.10/10.20/10.30 must be remapped at freeze.",
      `${users.toLocaleString()} named users → ~${concurrent} concurrent sessions (10%). Worker count scales from that; it is not a load-test result.`,
      "IPs are static reservations. VIPs occupy .4–.10 in each subnet. Gateways are .1. Broadcast .255.",
      cloud
        ? "Cloud rows mix IaaS node names with PaaS capacity. Managed PostgreSQL still appears as PG VIP for application config."
        : "Physical host counts align with the BOQ N+1 compute. Guest overcommit: vCPU 3:1 on app cluster, 1:1 on data cluster.",
      "Security policies are the intended rulebase. Implement as firewall + NSG/security-group pairs. Order: explicit deny SSH from untrust, then allows, then default deny.",
      k8s
        ? "Kubernetes: MST = master/control plane (NoSchedule). WKR = worker (schedulable). Workloads do not land on masters."
        : "3-tier: WEB = presentation, APP = application (monolith), PG = data. No Kubernetes control plane.",
    ],
  };
}

export function flattenInfra(plan: InfraPlan) {
  const cap = plan.capacity.map((c) => `${c.env}: ${c.vmCount} VMs, ${c.vcpu} vCPU, ${c.ramGi} Gi RAM, ${c.dataDiskGi} Gi data`).join("\n");
  const vms = plan.vms
    .map(
      (v) =>
        `${v.hostname} [${v.k8sRole || v.role}] ${v.env} ${v.function} ${v.vcpu} vCPU ${v.ramGi} Gi RAM OS ${v.osDiskGi} Gi data ${v.dataDiskGi} Gi ${v.ip} VLAN ${v.vlanId} ${v.subnet}`
    )
    .join("\n");
  const vlan = plan.vlans.map((v) => `${v.env} VLAN ${v.vlanId} ${v.name} ${v.cidr} gw ${v.gateway} ${v.purpose}`).join("\n");
  const pol = plan.policies.map((p) => `${p.id} ${p.env} ${p.name} ${p.source} -> ${p.destination} ${p.service} ${p.action}`).join("\n");
  return [`Infrastructure ${plan.siteCode} ${plan.domain}`, ...plan.naming, cap, vlan, vms, pol, ...plan.assumptions].join("\n\n");
}

export function infraSheetMatrices(plan: InfraPlan): { name: string; rows: (string | number)[][] }[] {
  return [
    {
      name: "Cover",
      rows: [
        ["Infrastructure workbook — planning", plan.siteCode],
        ["Internal domain", plan.domain],
        ["Runtime", plan.runtime === "kubernetes" ? "Kubernetes (MST/WKR)" : "Monolithic 3-tier (WEB/APP/PG)"],
        ["Hypervisor / runtime", plan.hypervisor],
        ["Kubernetes masters", String(plan.vms.filter((v) => v.k8sRole === "master").length)],
        ["Kubernetes workers", String(plan.vms.filter((v) => v.k8sRole === "worker").length)],
        ["Presentation WEB", String(plan.vms.filter((v) => v.role === "WEB").length)],
        ["Application APP", String(plan.vms.filter((v) => v.role === "APP").length)],
        ["VLAN / subnet rows", plan.vlans.length],
        ["Firewall / NSG policies", plan.policies.length],
        [],
        ["Read order", "Cover → Naming → K8s-nodes → VLAN-Subnet → IP-plan → VM-inventory → Capacity → Storage → Physical-hosts → VIP-LB → DNS → Firewall-policy → NSG-east-west → Backup → Certificates → Assumptions"],
        ["Class", "Planning. Confirm IPAM, AD/DNS, and firewall change windows at architecture freeze. Not a cabling ticket."],
      ],
    },
    {
      name: "Naming",
      rows: [["Rule"], ...plan.naming.map((n) => [n]), [], ["ROLE codes", plan.runtime === "kubernetes" ? "MST Kubernetes master (control plane), WKR Kubernetes worker, JMP bastion, WAF edge, LB, PG database, RDS Redis, BUS message, OBJ object, VLT vault, MON telemetry, BAK backup, DNS, VPN" : "WEB presentation, APP application, JMP bastion, WAF edge, LB, PG database, RDS Redis, BUS message, OBJ object, VLT vault, MON telemetry, BAK backup, DNS, VPN"]],
    },
    {
      name: plan.runtime === "kubernetes" ? "K8s-nodes" : "App-tier",
      rows: [
        ["Cluster", "Env", "Node type", "Hostname", "FQDN", "vCPU", "RAM Gi", "OS Gi", "Data Gi", "IP", "VIP", "Taints", "Runtime", "Schedulable?", "Notes"],
        ...plan.vms
          .filter((v) =>
            plan.runtime === "kubernetes" ? v.k8sRole === "master" || v.k8sRole === "worker" : v.role === "WEB" || v.role === "APP"
          )
          .map((v) => [
            v.cluster,
            v.env,
            v.k8sRole === "master" ? "Master (control plane)" : v.k8sRole === "worker" ? "Worker" : v.role === "WEB" ? "Presentation" : "Application",
            v.hostname,
            v.fqdn,
            v.vcpu,
            v.ramGi,
            v.osDiskGi,
            v.dataDiskGi,
            v.ip,
            v.vip || "—",
            v.k8sTaints,
            v.cri,
            v.k8sRole === "master" ? "No — control-plane only" : v.role === "WEB" ? "Presentation only" : "Yes — workloads",
            v.notes,
          ]),
        [],
        ["PRD masters", String(plan.vms.filter((v) => v.env === "PRD" && v.k8sRole === "master").length), "odd number for etcd quorum"],
        ["PRD workers", String(plan.vms.filter((v) => v.env === "PRD" && v.k8sRole === "worker").length), "N+1 for rolling drain"],
        ["CNI (planning)", "Calico or Cilium — confirm at freeze"],
        ["Kubernetes version (planning)", "1.31.x"],
      ],
    },
    {
      name: "VLAN-Subnet",
      rows: [
        ["Env", "VLAN ID", "Name", "Zone", "CIDR", "Mask", "Gateway", "DNS", "NTP", "DHCP", "Purpose"],
        ...plan.vlans.map((v) => [v.env, v.vlanId, v.name, v.zone, v.cidr, v.mask, v.gateway, v.dns, v.ntp, v.dhcp, v.purpose]),
      ],
    },
    {
      name: "IP-plan",
      rows: [
        ["Hostname", "FQDN", "Env", "VLAN ID", "VLAN", "Subnet", "IP", "VIP", "Gateway", "DNS", "NTP", "Reservation"],
        ...plan.vms.map((v) => [v.hostname, v.fqdn, v.env, v.vlanId, v.vlanName, v.subnet, v.ip, v.vip, v.gateway, v.dns, v.ntp, "Static — IPAM reserved"]),
      ],
    },
    {
      name: "VM-inventory",
      rows: [
        [
          "Hostname",
          "FQDN",
          "Env",
          "Role",
          "Function",
          "Cluster",
          "Hypervisor",
          "OS",
          "vCPU",
          "RAM Gi",
          "OS disk Gi",
          "Data disk Gi",
          "Extra disks",
          "VLAN ID",
          "IP",
          "VIP",
          "HA",
          "Backup",
          "Monitoring",
          "K8s role",
          "K8s taints",
          "CRI",
          "Notes",
        ],
        ...plan.vms.map((v) => [
          v.hostname,
          v.fqdn,
          v.env,
          v.role,
          v.function,
          v.cluster,
          v.hypervisor,
          v.os,
          v.vcpu,
          v.ramGi,
          v.osDiskGi,
          v.dataDiskGi,
          v.extraDisks,
          v.vlanId,
          v.ip,
          v.vip,
          v.ha,
          v.backupPolicy,
          v.monitoring,
          v.k8sRole || "n/a",
          v.k8sTaints,
          v.cri,
          v.notes,
        ]),
      ],
    },
    {
      name: "Capacity",
      rows: [
        ["Env", "VM count", "vCPU", "RAM Gi", "OS disk Gi", "Data disk Gi"],
        ...plan.capacity.map((c) => [c.env, c.vmCount, c.vcpu, c.ramGi, c.osDiskGi, c.dataDiskGi]),
        [],
        ["Total VMs", plan.vms.length],
        ["Total vCPU", plan.vms.reduce((s, v) => s + v.vcpu, 0)],
        ["Total RAM Gi", plan.vms.reduce((s, v) => s + v.ramGi, 0)],
        ["Total data Gi", plan.vms.reduce((s, v) => s + v.dataDiskGi, 0)],
      ],
    },
    {
      name: "Storage",
      rows: [
        ["Volume", "Env", "Type", "Size Gi", "Replica", "Mount / LUN", "Owner VM", "Encryption", "Backup"],
        ...plan.storage.map((s) => [s.volume, s.env, s.type, s.sizeGi, s.replica, s.mountOrLun, s.owner, s.encryption, s.backup]),
      ],
    },
    {
      name: "Physical-hosts",
      rows: [
        ["Host", "Env", "Role", "CPU", "RAM Gi", "Local NVMe Gi", "Cluster", "Mgmt IP", "VLANs"],
        ...plan.hosts.map((h) => [h.name, h.env, h.role, h.cpu, h.ramGi, h.localNvmeGi, h.cluster, h.mgmtIp, h.vlan]),
      ],
    },
    {
      name: "VIP-LB",
      rows: [
        ["Name", "Env", "DNS", "VIP", "VLAN", "Pool", "Ports", "Persistence", "Health check", "Certificate"],
        ...plan.vips.map((v) => [v.name, v.env, v.dns, v.vip, v.vlanId, v.pool, v.ports, v.persistence, v.healthCheck, v.cert]),
      ],
    },
    {
      name: "DNS",
      rows: [
        ["Name", "Type", "Value", "Env", "Notes"],
        ...plan.dns.map((d) => [d.name, d.type, d.value, d.env, d.notes]),
      ],
    },
    {
      name: "Firewall-policy",
      rows: [
        ["ID", "Env", "Name", "Direction", "From zone", "To zone", "Source", "Destination", "Service", "Action", "Logging", "NAT", "Notes"],
        ...plan.policies.map((p) => [
          p.id,
          p.env,
          p.name,
          p.direction,
          p.fromZone,
          p.toZone,
          p.source,
          p.destination,
          p.service,
          p.action,
          p.logging,
          p.nat,
          p.notes,
        ]),
      ],
    },
    {
      name: "NSG-east-west",
      rows: [
        ["ID", "Env", "Name", "From zone", "To zone", "Source", "Destination", "Service", "Action", "Notes"],
        ...plan.policies
          .filter((p) => p.direction === "east-west" || p.direction === "backup")
          .map((p) => [p.id, p.env, p.name, p.fromZone, p.toZone, p.source, p.destination, p.service, p.action, p.notes]),
      ],
    },
    {
      name: "Backup",
      rows: [
        ["Hostname", "Env", "Policy", "Data Gi", "RPO", "RTO note"],
        ...plan.vms.map((v) => [
          v.hostname,
          v.env,
          v.backupPolicy,
          v.dataDiskGi,
          v.role === "PG" ? "≤ 15 min (WAL)" : "24 h",
          v.env === "PRD" ? "Restore drill each release train" : "Best effort",
        ]),
      ],
    },
    {
      name: "Certificates",
      rows: [
        ["Name", "Env", "SAN / DNS", "Use", "Store"],
        ...plan.vips.map((v) => [v.cert, v.env, v.dns, v.name, "Vault — inventory with expiry alert 30/14/7 days"]),
      ],
    },
    {
      name: "Assumptions",
      rows: [["Assumption"], ...plan.assumptions.map((a) => [a])],
    },
  ];
}
