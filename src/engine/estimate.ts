import type { CapacityPlan, NodePlan, PlannerInputs, PodSpec } from "./types";
import { buildReportingPlan } from "./reporting";

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

export function estimateCapacity(input: PlannerInputs): CapacityPlan {
  if (input.architectureStyle === "monolith-3tier") return estimateMonolithCapacity(input);
  const tps = Math.max(1, input.tps);
  const services = Math.max(1, input.springBootServices);
  const ha = input.haLevel === "strict" ? 3 : 2;
  const assumptions: string[] = [];

  const tpsPerAppReplica = tps < 200 ? 100 : tps < 1500 ? 150 : 220;
  assumptions.push(
    `Spring Boot sizing uses ~${tpsPerAppReplica} RPS/replica with HPA from ${ha} (HA floor) up; JVM + pool headroom included.`
  );

  const hottestShare = Math.min(0.45, 0.2 + 0.25 / services);
  const hottestTps = tps * hottestShare;
  const extraHot = max(0, ceil(hottestTps / tpsPerAppReplica) - ha);
  const totalAppReplicas = services * ha + extraHot;

  const appCpuReq = tps > 4000 ? 1 : 0.5;
  const appCpuLim = tps > 4000 ? 2 : 1;
  const appMemReq = tps > 4000 ? 1 : 0.75;
  const appMemLim = tps > 4000 ? 2 : 1.5;

  const kongRps = 4000;
  const kongPods = max(3, ceil(tps / kongRps));
  const kongCpu = tps > 8000 ? 2 : 1;
  const kongMem = tps > 8000 ? 2 : 1;
  assumptions.push(
    `Kong is treated as L7 gateway + plugins (~${kongRps} RPS/pod). Konga is the admin UI and is not on the data path.`
  );

  const writeTps = tps * input.writeRatio;
  const pgPrimaryCpu = Math.min(16, max(2, ceil(2 + writeTps / 600 + tps / 2000)));
  const pgPrimaryMem = Math.min(64, max(8, ceil(8 + writeTps / 120 + services * 0.5)));
  const pgReplicas = 2;
  const pgReplicaCpu = Math.max(2, Math.round(pgPrimaryCpu * 0.75));
  const pgReplicaMem = Math.max(8, Math.round(pgPrimaryMem * 0.75));
  const dailyDataGi =
    (writeTps * input.avgPayloadKb * 1024 * 86400 * 0.22) / 1024 ** 3;
  const pgDataGi = max(80, ceil(dailyDataGi * input.dataRetentionDays * 1.25 + 40));
  const pgWalGi = max(40, ceil(dailyDataGi * 1.5));
  assumptions.push(
    `PostgreSQL well-architected: 1 primary + 2 replicas across 3 AZs. Disks are zonal SSD + PITR, not 3× Longhorn.`
  );

  const redisWorkingGi = max(2, ceil(2 + tps * 0.008 + services * 0.25));
  const redisCluster = redisWorkingGi > 12 || tps > 2500;
  const redisPods = redisCluster ? (redisWorkingGi > 24 ? 6 : 3) : 3;
  const redisMemEach = redisCluster
    ? max(4, ceil(redisWorkingGi / (redisPods / (redisPods === 6 ? 3 : 1)) + 1))
    : max(2, ceil(redisWorkingGi + 1));
  const redisCpu = tps > 4000 ? 2 : 1;
  assumptions.push(
    redisCluster
      ? `Redis Cluster with ${redisPods} pods (hash slots / replicas) for the ~${redisWorkingGi} Gi working set.`
      : `Redis Sentinel-style 3-pod HA, ~${redisWorkingGi} Gi working set plus AOF headroom.`
  );

  let mqPods: PodSpec[];
  if (input.messaging === "kafka") {
    const brokers = tps > 4000 ? 5 : 3;
    const kCpu = tps > 2500 ? 4 : 2;
    const kMem = tps > 2500 ? 8 : 4;
    const kDisk = max(200, ceil(dailyDataGi * 2 * input.logRetentionDays + 80));
    mqPods = [
      pod(
        "kafka",
        "messaging",
        brokers,
        kCpu,
        kCpu * 2,
        kMem,
        kMem * 1.5,
        kDisk,
        `${brokers}-broker HA cluster, ${input.logRetentionDays}d topic retention, local NVMe/SSD.`
      ),
      pod("zookeeper-or-kraft", "messaging", 3, 1, 2, 2, 4, 20, "KRaft controller quorum (or ZooKeeper if legacy)."),
    ];
    assumptions.push(`Kafka ${brokers} brokers for ordered partitions and consumer lag headroom at ${tps} TPS.`);
  } else {
    const rmq = 3;
    const rCpu = tps > 2000 ? 2 : 1;
    const rMem = max(2, ceil(2 + tps / 800));
    const rDisk = max(50, ceil(dailyDataGi * 0.5 * 3 + 20));
    mqPods = [
      pod(
        "rabbitmq",
        "messaging",
        rmq,
        rCpu,
        rCpu * 2,
        rMem,
        rMem * 2,
        rDisk,
        "3-node mirrored/quorum queue cluster. Prefer quorum queues for HA."
      ),
    ];
    assumptions.push("RabbitMQ 3-node quorum-queue cluster; memory alarm at 40% of container limit.");
  }

  let obsPods: PodSpec[] = [];
  if (input.observability === "elk") {
    const logGiPerDay = max(8, (tps * 4 * 1024 * 86400) / 1024 ** 3);
    const esDisk = max(200, ceil(logGiPerDay * input.logRetentionDays * 1.3 / 3));
    const esMem = tps > 2000 ? 16 : 8;
    const esCpu = tps > 2000 ? 4 : 2;
    obsPods = [
      pod("elasticsearch", "observability", 3, esCpu, esCpu * 2, esMem, esMem, esDisk, "3 master-eligible data nodes, heap ≤ 50% of RAM."),
      pod("kibana", "observability", ha, 1, 2, 2, 4, 10, "Kibana UI, not on ingest path."),
      pod("logstash-or-elastic-agent", "observability", max(2, ceil(tps / 4000)), 1, 2, 2, 4, 20, "Ingest/parse pipeline."),
    ];
    assumptions.push(
      `ELK: ~${round(logGiPerDay)} Gi logs/day × ${input.logRetentionDays}d, 3 Elasticsearch data nodes.`
    );
  } else {
    const pMem = tps > 3000 ? 16 : 8;
    obsPods = [
      pod("prometheus", "observability", 2, 2, 4, pMem, pMem, max(150, ceil(tps / 10 + 80)), "HA Prometheus (or Thanos) 15s scrape, local TSDB."),
      pod("alertmanager", "observability", 2, 0.2, 0.5, 0.5, 1, 5, "Alert routing HA pair."),
      pod("node-exporter", "observability", 0, 0.1, 0.2, 0.1, 0.2, 0, "DaemonSet — counted via node overhead."),
    ];
    assumptions.push("Prometheus stack with 2 replicas; node-exporter/cadvisor run as DaemonSets.");
  }

  let vizPods: PodSpec[] = [];
  if (input.visualization === "grafana") {
    if (input.observability !== "prometheus") {
      vizPods = [pod("grafana", "visualization", ha, 0.5, 1, 1, 2, 10, "Grafana against Elasticsearch/Prometheus datasources.")];
    } else {
      vizPods = [pod("grafana", "visualization", ha, 0.5, 1, 1, 2, 10, "Grafana HA against in-cluster Prometheus.")];
    }
  } else {
    vizPods = [
      pod("zabbix-server", "visualization", 2, 2, 4, 4, 8, 40, "Active-passive Zabbix server pair."),
      pod("zabbix-web", "visualization", ha, 1, 2, 1, 2, 5, "Zabbix frontend."),
      pod("zabbix-proxy", "visualization", 2, 1, 2, 2, 4, 20, "Proxies for K8s and VM inventory."),
      pod("zabbix-db-postgres", "visualization", 1, 2, 4, 4, 8, 80, "Dedicated Zabbix history DB (separate from app Postgres)."),
    ];
  }

  const kongaPods = input.includeKonga
    ? [pod("konga", "gateway-ui", 2, 0.3, 0.5, 0.5, 1, 5, "Konga admin UI; keep off public ingress.")]
    : [];

  const longhornPods = input.includeLonghorn
    ? [
        pod("longhorn-manager", "storage", 0, 0.3, 0.5, 0.5, 1, 0, "DaemonSet on every worker — overhead added per node."),
        pod("longhorn-ui", "storage", 2, 0.2, 0.5, 0.3, 0.5, 0, "Longhorn UI."),
        pod("longhorn-engine", "storage", 0, 0.2, 1, 0.3, 1, 0, "Engine processes scale with volumes."),
      ]
    : [];

  const devopsPods: PodSpec[] = [];
  if (input.includeArgoCd) {
    devopsPods.push(
      pod("argocd-server", "gitops", ha, 0.5, 1, 0.5, 1, 0, "Argo CD API/UI, HA, private ingress only."),
      pod("argocd-repo-server", "gitops", ha, 1, 2, 1, 2, 20, "Git clone/render workers; keep off the public NLB."),
      pod("argocd-application-controller", "gitops", 2, 1, 2, 2, 4, 0, "Reconciles Applications; PDB 1 across AZs."),
      pod("argocd-redis", "cache", 1, 0.5, 1, 1, 2, 8, "Dedicated Argo CD cache — not the application Redis.")
    );
    assumptions.push(`Argo CD HA (${ha} server/repo-server) for GitOps CD of the ${services} Spring Boot services.`);
  }
  if (input.includeJenkins) {
    const agents = max(2, ceil(services / 4), ceil(tps / 2500));
    devopsPods.push(
      pod(
        "jenkins-controller",
        "cicd",
        1,
        2,
        4,
        4,
        8,
        max(80, 40 + services * 5),
        "Single controller; JENKINS_HOME on zonal SSD + snapshots (not Longhorn)."
      ),
      pod(
        "jenkins-agent",
        "cicd",
        agents,
        2,
        4,
        4,
        8,
        60,
        `${agents} Kubernetes agents for parallel Maven/Gradle image builds.`
      )
    );
    assumptions.push(`Jenkins: 1 controller + ${agents} agents sized for ${services} services.`);
  }
  if (input.includeCicdPipeline) {
    devopsPods.push(
      pod(
        "cicd-control-plane",
        "cicd",
        2,
        0.5,
        1,
        0.5,
        1,
        5,
        "Pipeline controller + webhooks (Tekton / GitHub Actions runner-controller)."
      )
    );
    if (!input.includeJenkins) {
      const runners = max(2, ceil(services / 4), ceil(tps / 2500));
      devopsPods.push(
        pod(
          "cicd-runners",
          "cicd",
          runners,
          2,
          4,
          4,
          8,
          50,
          `${runners} self-hosted build/kaniko runners. Enable Jenkins if you want a classic CI UI.`
        )
      );
      assumptions.push(`CI/CD pipeline: control plane + ${runners} runners (no Jenkins agents).`);
    } else {
      assumptions.push("CI/CD pipeline control plane added; Jenkins agents are the build executors (no extra runner pool).");
    }
  }
  if (input.includeHarbor) {
    const registryGi = max(400, ceil(80 + services * 20 + tps / 15));
    devopsPods.push(
      pod("harbor-core", "registry", 2, 1, 2, 2, 4, 10, "Harbor core/API HA pair."),
      pod("harbor-portal", "registry", 2, 0.3, 0.5, 0.5, 1, 0, "Harbor UI; private ingress."),
      pod("harbor-jobservice", "registry", 2, 1, 2, 2, 4, 20, "Replication, GC, and scan jobs."),
      pod("harbor-registry", "registry", 2, 1, 2, 2, 4, 20, "Distribution API; blobs on the dedicated store below."),
      pod("harbor-trivy", "registry", 2, 1, 2, 2, 4, 40, "Image CVE scanning."),
      pod("harbor-db", "database", 1, 2, 4, 4, 8, 80, "Dedicated Harbor PostgreSQL — not the application database."),
      pod("harbor-redis", "cache", 1, 0.5, 1, 1, 2, 10, "Harbor job/session Redis."),
      pod(
        "harbor-blob-store",
        "registry",
        1,
        2,
        4,
        4,
        8,
        registryGi,
        `Image blob capacity ~${registryGi} Gi (S3/GCS/MinIO equivalent). Zonal disk or object storage, not 3× Longhorn.`
      )
    );
    assumptions.push(`Harbor HA registry with ~${registryGi} Gi blob store for ${services} services' images.`);
  }

  const reporting = buildReportingPlan(input);
  if (reporting) assumptions.push(reporting.summary);
  const reportingK8s = reporting?.pods.filter((p) => p.name !== "powerbi-gateway") ?? [];

  const systemPods: PodSpec[] = [
    pod("coredns", "platform", 2, 0.2, 0.5, 0.2, 0.5, 0, "Cluster DNS."),
    pod("ingress-or-kong-controller", "platform", 2, 0.2, 0.5, 0.3, 0.5, 0, "Ingress / Kong ingress controller."),
    pod("metrics-server", "platform", 2, 0.1, 0.3, 0.2, 0.5, 0, "HPA metrics."),
    pod("cert-manager", "platform", 2, 0.1, 0.3, 0.2, 0.5, 0, "TLS issuance."),
  ];

  const appPods: PodSpec[] = [
    pod(
      "spring-boot-services",
      "application",
      totalAppReplicas,
      appCpuReq,
      appCpuLim,
      appMemReq,
      appMemLim,
      10,
      `${services} services × ${ha} HA replicas` +
        (extraHot ? ` + ${extraHot} extra on the hottest path (~${Math.round(hottestShare * 100)}% of TPS)` : "") +
        "."
    ),
    pod("kong", "gateway", kongPods, kongCpu, kongCpu * 2, kongMem, kongMem * 2, 5, "Kong data plane, 3 AZ PodDisruptionBudget, behind NLB/ALB."),
    ...kongaPods,
    pod(
      "postgres-primary",
      "database",
      1,
      pgPrimaryCpu,
      pgPrimaryCpu,
      pgPrimaryMem,
      pgPrimaryMem,
      pgDataGi + pgWalGi,
      "Primary in AZ-a, sync replica AZ-b, async AZ-c. Cloud SSD/PITR — not Longhorn."
    ),
    pod(
      "postgres-replica",
      "database",
      pgReplicas,
      pgReplicaCpu,
      pgReplicaCpu,
      pgReplicaMem,
      pgReplicaMem,
      pgDataGi,
      "Streaming replicas across AZs for HA and read offload."
    ),
    pod(
      "redis",
      "cache",
      redisPods,
      redisCpu,
      redisCpu * 2,
      redisMemEach,
      redisMemEach,
      max(10, redisMemEach * 2),
      redisCluster ? "Redis Cluster" : "Redis + Sentinel pattern"
    ),
    ...mqPods,
    ...obsPods.filter((p) => p.count > 0),
    ...vizPods,
    ...longhornPods.filter((p) => p.count > 0),
    ...devopsPods.filter((p) => p.count > 0),
    ...reportingK8s.filter((p) => p.count > 0),
    ...systemPods,
  ];

  const schedulable = appPods.filter((p) => p.count > 0);
  const totalPods = schedulable.reduce((s, p) => s + p.count, 0);
  const clusterCpuRequest = schedulable.reduce((s, p) => s + p.cpuRequest * p.count, 0);
  const clusterCpuLimit = schedulable.reduce((s, p) => s + p.cpuLimit * p.count, 0);
  const clusterMemGiRequest = schedulable.reduce((s, p) => s + p.memoryGiRequest * p.count, 0);
  const clusterMemGiLimit = schedulable.reduce((s, p) => s + p.memoryGiLimit * p.count, 0);
  const persistentStorageGi = schedulable.reduce((s, p) => s + p.storageGi * p.count, 0);

  const isStateful = (p: PodSpec) =>
    p.role === "database" ||
    p.role === "cache" ||
    p.role === "messaging" ||
    p.name.includes("elasticsearch") ||
    p.name.includes("zabbix-db") ||
    p.name === "jenkins-controller" ||
    p.name === "harbor-blob-store" ||
    p.role === "warehouse" ||
    p.role === "etl" ||
    p.name.includes("warehouse") ||
    p.name === "superset-meta-db" ||
    p.name === "superset-redis";

  const statefulGi = schedulable.filter(isStateful).reduce((s, p) => s + p.storageGi * p.count, 0);
  const genericGi = persistentStorageGi - statefulGi;
  const replicaFactor = input.includeLonghorn ? 3 : 1;
  const longhornPhysicalGi = ceil(genericGi * replicaFactor * 1.15 + statefulGi * 1.2);

  const maxPodsPerVm = 30;
  assumptions.push(
    "Well-architected layout: 3 AZs, dedicated data node pool (taints), zonal SSD for stateful sets, Longhorn only for generic PVCs, PDBs and anti-affinity on Kong/Postgres/Redis."
  );

  const dataWorkloads = schedulable.filter(isStateful);
  const generalWorkloads = schedulable.filter((p) => !isStateful(p));
  const dataCpu = dataWorkloads.reduce((s, p) => s + p.cpuRequest * p.count, 0);
  const dataMem = dataWorkloads.reduce((s, p) => s + p.memoryGiRequest * p.count, 0);
  const dataPodCount = dataWorkloads.reduce((s, p) => s + p.count, 0);
  const genCpu = generalWorkloads.reduce((s, p) => s + p.cpuRequest * p.count, 0);
  const genMem = generalWorkloads.reduce((s, p) => s + p.memoryGiRequest * p.count, 0);
  const genPodCount = generalWorkloads.reduce((s, p) => s + p.count, 0);

  const dataVcpu = tps > 3000 ? 16 : 8;
  const dataRam = tps > 3000 ? 64 : 32;
  const genVcpu = tps > 4000 ? 16 : 8;
  const genRam = tps > 4000 ? 64 : 32;

  const poolCount = (cpu: number, mem: number, pods: number, vcpu: number, ram: number) => {
    const usableCpu = vcpu - 1.5;
    const usableMem = ram - 5;
    return max(3, ceil((cpu * 1.25) / usableCpu), ceil((mem * 1.25) / usableMem), ceil((pods * 1.1) / maxPodsPerVm));
  };

  let dataCount = poolCount(dataCpu, dataMem, dataPodCount, dataVcpu, dataRam);
  let genCount = poolCount(genCpu, genMem, genPodCount, genVcpu, genRam);

  const osDisk = 80;
  const maxDataPerNode = 4096;
  const dataDiskNeed = ceil(statefulGi * 1.2);
  const genDiskNeed = ceil(genericGi * replicaFactor * 1.15);
  if (ceil(dataDiskNeed / dataCount) > maxDataPerNode) {
    dataCount = max(dataCount, ceil(dataDiskNeed / maxDataPerNode));
  }
  if (ceil(genDiskNeed / genCount) > maxDataPerNode) {
    genCount = max(genCount, ceil(genDiskNeed / maxDataPerNode));
  }
  const dataDiskGi = max(200, ceil(dataDiskNeed / dataCount));
  const genDiskGi = max(200, ceil(genDiskNeed / genCount));

  const cpCount = 3;
  const workerCount = dataCount + genCount;

  const nodes = [
    {
      role: "control-plane" as const,
      count: cpCount,
      vcpu: 4,
      memoryGi: 8,
      osDiskGi: osDisk,
      dataDiskGi: 50,
      maxPods: 20,
      notes: "Stacked etcd, one per AZ. On EKS/AKS/GKE this is the managed control plane (not customer VMs).",
    },
    {
      role: "data" as const,
      count: dataCount,
      vcpu: dataVcpu,
      memoryGi: dataRam,
      osDiskGi: osDisk,
      dataDiskGi: dataDiskGi,
      maxPods: maxPodsPerVm,
      notes: "Tainted for Postgres, Redis, Kafka/RabbitMQ, Elasticsearch, Harbor DB/blobs, Jenkins home, warehouse/ClickHouse, Superset metadata. Local/zonal SSD, snapshots, no Longhorn replica tax.",
    },
    {
      role: "worker" as const,
      count: genCount,
      vcpu: genVcpu,
      memoryGi: genRam,
      osDiskGi: osDisk,
      dataDiskGi: genDiskGi,
      maxPods: maxPodsPerVm,
      notes: "General pool: Spring Boot, Kong, Grafana/Zabbix, Argo CD/Jenkins/CI, Harbor API, Superset web/workers, ETL, platform add-ons. 3 AZ spread, Cluster Autoscaler.",
    },
  ];

  const vmCount = cpCount + workerCount;
  const k8sNodeCount = vmCount;

  const wellArchitected = [
    "Reliability: 3 Availability Zones, PodDisruptionBudgets, anti-affinity on Kong, Postgres, Redis, and brokers.",
    "Security: private subnets, NAT egress, TLS via cert-manager, Konga/admin APIs not on the public NLB, IMDSv2 / equivalent.",
    "Performance: dedicated data node pool so JVM heaps do not share disks with etcd or app burst; gp3/Premium SSD/pd-ssd for stateful.",
    "Cost: Longhorn 3× only on generic PVCs; databases use 1× zonal disk + PITR. Right-size HPA on Spring Boot (CPU 60%).",
    "Ops: separate node groups, Velero/cloud snapshots daily, Prometheus or ELK with retention caps, no single-AZ control plane.",
    "Reporting: OLTP replica → CDC/ETL → warehouse. Dashboards never query the PostgreSQL writer.",
    "BI: Apache Superset (in-cluster or VMs) and/or Power BI Service via Windows gateways; one certified KPI dictionary.",
    "Complaints: multi-channel intake, one case id, ack/decision SLOs, segregation of duties, audit, warehouse facts — not a mailbox.",
    ...(input.includeArgoCd || input.includeJenkins || input.includeCicdPipeline || input.includeHarbor
      ? [
          "Delivery: Argo CD for GitOps, Jenkins and/or pipeline runners for CI, Harbor as the private registry (scan images before promote). Keep admin UIs off the public NLB.",
        ]
      : []),
    ...(reporting
      ? [
          "Analytics: warehouse is not OLTP. Apache Superset runs in-cluster; Power BI Service is SaaS with Windows on-premises data gateways (VMs, not pods). One star schema, two consumers if both tools are on.",
        ]
      : []),
  ];

  assumptions.push(
    `Cluster CPU request ${round(clusterCpuRequest)} vCPU, memory ${round(clusterMemGiRequest)} Gi, ${totalPods} pods → ${genCount} general + ${dataCount} data workers + 3 control-plane.`
  );
  assumptions.push(
    "Prices are on-demand list estimates (not reserved/SPOT), 730 h/month, USD→AED at 3.6725. Validate with a cloud calculator before procurement."
  );

  return {
    architectureStyle: "microservices",
    assumptions,
    peakConcurrent: ceil(tps * 0.08 + services * 40),
    totalAppReplicas,
    maxPodsPerVm,
    totalPods,
    clusterCpuRequest: round(clusterCpuRequest),
    clusterCpuLimit: round(clusterCpuLimit),
    clusterMemGiRequest: round(clusterMemGiRequest),
    clusterMemGiLimit: round(clusterMemGiLimit),
    persistentStorageGi: round(persistentStorageGi, 0),
    longhornPhysicalGi: round(longhornPhysicalGi, 0),
    wellArchitected,
    workloads: schedulable,
    nodes,
    vmCount,
    k8sNodeCount,
    reporting,
  };
}

function estimateMonolithCapacity(input: PlannerInputs): CapacityPlan {
  const tps = Math.max(1, input.tps);
  const modules = Math.max(1, input.springBootServices);
  const ha = input.haLevel === "strict" ? 3 : 2;
  const assumptions: string[] = [];

  const tpsPerProcess = tps < 200 ? 80 : tps < 1500 ? 140 : 200;
  const appCount = max(ha, ceil(tps / tpsPerProcess));
  assumptions.push(
    `Monolithic 3-tier: one application binary hosts ${modules} logical modules. Size ~${tpsPerProcess} RPS per app process, HA floor ${ha}.`
  );

  const webCount = max(2, ha);
  const webCpu = tps > 4000 ? 4 : 2;
  const webMem = tps > 4000 ? 8 : 4;

  const appCpuReq = tps > 4000 ? 4 : 2;
  const appCpuLim = tps > 4000 ? 8 : 4;
  const appMemReq = tps > 4000 ? 8 : 4;
  const appMemLim = tps > 4000 ? 16 : 8;

  const writeTps = tps * input.writeRatio;
  const pgPrimaryCpu = Math.min(16, max(2, ceil(2 + writeTps / 600 + tps / 2000)));
  const pgPrimaryMem = Math.min(64, max(8, ceil(8 + writeTps / 120 + modules * 0.5)));
  const pgReplicas = ha === 3 ? 2 : 1;
  const pgReplicaCpu = Math.max(2, Math.round(pgPrimaryCpu * 0.75));
  const pgReplicaMem = Math.max(8, Math.round(pgPrimaryMem * 0.75));
  const dailyDataGi = (writeTps * input.avgPayloadKb * 1024 * 86400 * 0.22) / 1024 ** 3;
  const pgDataGi = max(80, ceil(dailyDataGi * input.dataRetentionDays * 1.25 + 40));

  const redisWorkingGi = max(2, ceil(2 + tps * 0.008 + modules * 0.25));
  const redisCount = ha;
  const redisMem = max(2, ceil(redisWorkingGi / redisCount + 1));

  const mqCount = input.messaging === "kafka" ? max(3, ha) : ha;
  const mqMem = input.messaging === "kafka" ? 8 : 4;

  const workloads: PodSpec[] = [
    pod("reverse-proxy", "presentation", webCount, webCpu / 2, webCpu, webMem / 2, webMem, 40, "Nginx / IIS / Apache in the presentation tier. TLS, static, reverse-proxy to app."),
    pod("monolith-app", "application", appCount, appCpuReq, appCpuLim, appMemReq, appMemLim, 80, `Single deployable hosting ${modules} packages. Sticky sessions off — session in Redis.`),
    pod("postgres-primary", "database", 1, pgPrimaryCpu, pgPrimaryCpu, pgPrimaryMem, pgPrimaryMem, pgDataGi, "System of record. Dedicated data-tier VM."),
    pod("postgres-replica", "database", pgReplicas, pgReplicaCpu, pgReplicaCpu, pgReplicaMem, pgReplicaMem, pgDataGi, "Failover / reporting replica. Not a second writer."),
    pod("redis", "cache", redisCount, 1, 2, redisMem, redisMem + 1, 20, "Cache and session only."),
    pod(input.messaging, "messaging", mqCount, 1, 2, mqMem / 2, mqMem, 80, input.messaging === "kafka" ? "Optional async. Not required for in-process module calls." : "Optional async / mailer. In-process calls stay in the monolith."),
  ];

  if (input.observability === "elk") {
    workloads.push(pod("elasticsearch", "observability", ha, 2, 4, 8, 16, 200, "Log store on data or dedicated VMs — not on the app hosts."));
  } else {
    workloads.push(pod("prometheus", "observability", 1, 1, 2, 4, 8, 80, "Metrics on a management VM."));
  }
  if (input.visualization === "grafana") {
    workloads.push(pod("grafana", "observability", 1, 0.5, 1, 1, 2, 20, "Dashboards. Not on the data path."));
  } else {
    workloads.push(pod("zabbix", "observability", 1, 1, 2, 2, 4, 40, "SNMP/agent NM. Not on the data path."));
  }

  const reporting = buildReportingPlan(input);
  if (reporting) {
    workloads.push(...reporting.pods.filter((p) => p.count > 0));
    assumptions.push(reporting.summary);
  }

  const schedulable = workloads.filter((w) => w.count > 0);
  const totalPods = schedulable.reduce((s, p) => s + p.count, 0);
  const clusterCpuRequest = schedulable.reduce((s, p) => s + p.cpuRequest * p.count, 0);
  const clusterCpuLimit = schedulable.reduce((s, p) => s + p.cpuLimit * p.count, 0);
  const clusterMemGiRequest = schedulable.reduce((s, p) => s + p.memoryGiRequest * p.count, 0);
  const clusterMemGiLimit = schedulable.reduce((s, p) => s + p.memoryGiLimit * p.count, 0);
  const persistentStorageGi = schedulable.reduce((s, p) => s + p.storageGi * p.count, 0);

  const webVcpu = tps > 4000 ? 8 : 4;
  const webRam = tps > 4000 ? 16 : 8;
  const appVcpu = tps > 4000 ? 16 : 8;
  const appRam = tps > 4000 ? 32 : 16;
  const dataVcpu = tps > 3000 ? 16 : 8;
  const dataRam = tps > 3000 ? 64 : 32;

  const nodes: NodePlan[] = [
    {
      role: "presentation" as const,
      count: webCount,
      vcpu: webVcpu,
      memoryGi: webRam,
      osDiskGi: 80,
      dataDiskGi: 40,
      maxPods: 0,
      notes: "Presentation tier: reverse proxy, static, TLS. No business logic, no database.",
    },
    {
      role: "application" as const,
      count: appCount,
      vcpu: appVcpu,
      memoryGi: appRam,
      osDiskGi: 80,
      dataDiskGi: 80,
      maxPods: 0,
      notes: "Application tier: monolith processes behind the proxy. N+1. Rolling restart one at a time.",
    },
    {
      role: "data" as const,
      count: 1 + pgReplicas + redisCount,
      vcpu: dataVcpu,
      memoryGi: dataRam,
      osDiskGi: 80,
      dataDiskGi: max(200, ceil(pgDataGi)),
      maxPods: 0,
      notes: "Data tier: PostgreSQL primary/replica, Redis. No inbound internet. App tier only.",
    },
  ];

  if (reporting) {
    const wh = reporting.vms.find((v) => v.tier === "warehouse");
    nodes.push({
      role: "reporting",
      count: reporting.vms.reduce((s, v) => s + v.count, 0),
      vcpu: wh?.vcpu ?? 8,
      memoryGi: wh?.ramGi ?? 32,
      osDiskGi: 80,
      dataDiskGi: Math.max(200, Math.ceil(reporting.warehouseGi / Math.max(1, wh?.count ?? 2))),
      maxPods: 0,
      notes: "Reporting VMs: warehouse, ETL, Superset and/or Power BI gateways. Separate from OLTP data-tier.",
    });
  }

  const vmCount = nodes.reduce((s, n) => s + n.count, 0);

  assumptions.push("No Kubernetes control plane. Tiers are dedicated VMs (or equivalent PaaS: App Service / Elastic Beanstalk / Compute Engine MIG).");
  assumptions.push("In-process module calls replace most east–west RPC. Integrations still leave through the app tier.");
  assumptions.push(
    "Prices are on-demand list estimates (not reserved/SPOT), 730 h/month, USD→AED at 3.6725. Validate with a cloud calculator before procurement."
  );

  return {
    architectureStyle: "monolith-3tier",
    assumptions,
    peakConcurrent: ceil(tps * 0.08 + modules * 20),
    totalAppReplicas: appCount,
    maxPodsPerVm: 0,
    totalPods,
    clusterCpuRequest: round(clusterCpuRequest),
    clusterCpuLimit: round(clusterCpuLimit),
    clusterMemGiRequest: round(clusterMemGiRequest),
    clusterMemGiLimit: round(clusterMemGiLimit),
    persistentStorageGi: round(persistentStorageGi, 0),
    longhornPhysicalGi: 0,
    wellArchitected: [
      "Reliability: N+1 presentation and application; database with replica and PITR; no single VM as SPOF in PRD.",
      "Security: reverse proxy terminates TLS; app tier private; data tier accepts only app-tier IPs; no staff passwords in the app.",
      "Performance: scale app processes horizontally; scale the database vertically or with a reporting replica — do not put the DB on the app hosts.",
      ...(reporting
        ? [
            "Analytics: warehouse VMs and BI tools sit beside the 3-tier SoR. Never point Power BI or Superset at the OLTP primary.",
          ]
        : []),
      "Cost: one runtime to patch and licence. Avoid a hidden second stack (don't add Kubernetes 'just in case').",
      "Ops: rolling restart of app VMs, blue/green or two-slot IIS/systemd. Backups are data-tier, not presentation.",
      "Reporting: replica/CDC into a warehouse beside the 3-tier SoR. BI is not a live query on the writer.",
      "BI: Apache Superset and/or Power BI gateway + Service. Tick the cost-estimator checkboxes to size VMs and SKUs.",
      "Complaints: portal, phone/email, walk-in, and partner API share one complaint_record, SLA clocks, and SoD on decision.",
    ],
    workloads: schedulable,
    nodes,
    vmCount,
    k8sNodeCount: 0,
    reporting,
  };
}

