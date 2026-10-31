import type { ArchitectureStyle } from "../architecture";

export type Hosting = "aws" | "azure" | "gcp" | "onprem" | "vercel" | "lovable";
/** What the user picks: one hosting option, or every option side by side. */
export type Target = Hosting | "all";

export const HOSTINGS: Hosting[] = ["aws", "azure", "gcp", "onprem", "vercel", "lovable"];
export const CLOUDS: Hosting[] = ["aws", "azure", "gcp"];
export const MANAGED: Hosting[] = ["vercel", "lovable"];

export const HOSTING_LABEL: Record<Hosting, string> = {
  aws: "AWS (me-central-1, UAE)",
  azure: "Azure (UAE North)",
  gcp: "GCP (me-central1, Doha)",
  onprem: "On-premise servers (client DC)",
  vercel: "Vercel + Supabase/Neon (managed)",
  lovable: "Lovable + Supabase (managed)",
};

export const TARGET_LABEL: Record<Target, string> = { ...HOSTING_LABEL, all: "All options (compare side by side)" };

export const SHORT: Record<Hosting, string> = { aws: "AWS", azure: "Azure", gcp: "GCP", onprem: "On-premise", vercel: "Vercel", lovable: "Lovable" };

/** Service names on the managed platforms, by "filter:option" first, then by filter. */
const MANAGED_NAMES: Record<"vercel" | "lovable", Record<string, string>> = {
  vercel: {
    "sqlDb:postgres": "Neon Postgres (Vercel Marketplace)",
    "sqlDb:mysql": "PlanetScale MySQL",
    sqlDb: "External managed DB (not on platform)",
    noSql: "MongoDB Atlas (Vercel Marketplace)",
    cache: "Upstash Redis",
    search: "Algolia / Upstash Search",
    messaging: "Upstash QStash / Inngest",
    objectStorage: "Vercel Blob",
    loadBalancer: "Vercel Edge Network (built-in)",
    apiGateway: "Vercel Routing Middleware",
    cdnWaf: "Vercel Edge Network + Firewall",
    identity: "Clerk / Auth.js",
    secrets: "Vercel encrypted environment variables",
    email: "Resend",
  },
  lovable: {
    "sqlDb:postgres": "Supabase Postgres",
    sqlDb: "External managed DB (not on platform)",
    noSql: "Supabase Postgres JSONB",
    cache: "Upstash Redis",
    search: "Supabase full-text search",
    messaging: "Supabase Queues (pgmq)",
    objectStorage: "Supabase Storage",
    loadBalancer: "Lovable hosting (built-in)",
    apiGateway: "Supabase Edge Functions",
    cdnWaf: "Lovable hosting CDN",
    identity: "Supabase Auth",
    secrets: "Supabase Vault / project secrets",
    email: "Resend",
  },
};

/** One selectable technology. `per` names the equivalent service on each hosting option. */
export interface TechOption {
  id: string;
  label: string;
  per?: Partial<Record<Hosting, string>>;
  /** Extra licence / SaaS cost in AED per month that the capacity engine does not include. */
  licenceAedMonth?: number;
  licenceNote?: string;
}

export interface FilterGroup {
  id: FilterKey;
  label: string;
  section: "Application" | "Data" | "Network & edge" | "Platform & operations" | "Delivery";
  multi?: boolean;
  options: TechOption[];
}

export type FilterKey =
  | "backend"
  | "frontend"
  | "mobile"
  | "sqlDb"
  | "noSql"
  | "cache"
  | "search"
  | "messaging"
  | "objectStorage"
  | "loadBalancer"
  | "apiGateway"
  | "cdnWaf"
  | "identity"
  | "secrets"
  | "observability"
  | "cicd"
  | "iac"
  | "email"
  | "dr"
  | "aiTooling";

const none: TechOption = { id: "none", label: "None" };

export const FILTERS: FilterGroup[] = [
  {
    id: "backend",
    label: "Backend language / framework",
    section: "Application",
    options: [
      { id: "java-spring", label: "Java 21 · Spring Boot" },
      { id: "node-nest", label: "Node.js · NestJS (TypeScript)" },
      { id: "dotnet", label: ".NET 8 · ASP.NET Core" },
      { id: "python-fastapi", label: "Python · FastAPI" },
      { id: "go", label: "Go · Gin / Fiber" },
      { id: "php-laravel", label: "PHP · Laravel" },
    ],
  },
  {
    id: "frontend",
    label: "Web / admin frontend",
    section: "Application",
    options: [
      { id: "react-next", label: "React · Next.js" },
      { id: "angular", label: "Angular" },
      { id: "vue-nuxt", label: "Vue · Nuxt" },
      none,
    ],
  },
  {
    id: "mobile",
    label: "Mobile apps",
    section: "Application",
    options: [
      { id: "flutter", label: "Flutter (iOS + Android)" },
      { id: "react-native", label: "React Native (iOS + Android)" },
      { id: "native", label: "Native: Swift + Kotlin" },
      none,
    ],
  },
  {
    id: "sqlDb",
    label: "SQL database",
    section: "Data",
    options: [
      { id: "postgres", label: "PostgreSQL", per: { aws: "RDS for PostgreSQL", azure: "Azure Database for PostgreSQL Flexible", gcp: "Cloud SQL for PostgreSQL", onprem: "PostgreSQL + Patroni HA" } },
      { id: "mysql", label: "MySQL", per: { aws: "RDS / Aurora MySQL", azure: "Azure Database for MySQL Flexible", gcp: "Cloud SQL for MySQL", onprem: "MySQL InnoDB Cluster" } },
      { id: "sqlserver", label: "SQL Server", per: { aws: "RDS for SQL Server", azure: "Azure SQL Database", gcp: "Cloud SQL for SQL Server", onprem: "SQL Server Always On" }, licenceAedMonth: 4400, licenceNote: "SQL Server Standard, 8 cores (licence-included / SPLA estimate)" },
      { id: "oracle", label: "Oracle Database", per: { aws: "RDS for Oracle", azure: "Oracle Database@Azure", gcp: "Oracle Database@Google Cloud", onprem: "Oracle RAC" }, licenceAedMonth: 15500, licenceNote: "Oracle SE2/EE processor licence + support, amortised monthly" },
      none,
    ],
  },
  {
    id: "noSql",
    label: "NoSQL database",
    section: "Data",
    options: [
      none,
      { id: "mongodb", label: "MongoDB", per: { aws: "MongoDB Atlas (AWS) / DocumentDB", azure: "MongoDB Atlas (Azure) / Cosmos DB for MongoDB", gcp: "MongoDB Atlas (GCP)", onprem: "MongoDB replica set" } },
      { id: "cloud-doc", label: "Cloud-native document / key-value", per: { aws: "DynamoDB", azure: "Cosmos DB", gcp: "Firestore", onprem: "MongoDB replica set" } },
      { id: "cassandra", label: "Cassandra (wide-column)", per: { aws: "Amazon Keyspaces", azure: "Azure Managed Instance for Apache Cassandra", gcp: "Cassandra on GKE", onprem: "Apache Cassandra cluster" } },
    ],
  },
  {
    id: "cache",
    label: "Cache",
    section: "Data",
    options: [
      { id: "redis", label: "Redis", per: { aws: "ElastiCache for Redis / Valkey", azure: "Azure Cache for Redis", gcp: "Memorystore for Redis", onprem: "Redis + Sentinel" } },
      { id: "memcached", label: "Memcached", per: { aws: "ElastiCache for Memcached", azure: "Memcached on AKS/VM", gcp: "Memorystore for Memcached", onprem: "Memcached" } },
      none,
    ],
  },
  {
    id: "search",
    label: "Search engine",
    section: "Data",
    options: [
      none,
      { id: "opensearch", label: "OpenSearch / Elasticsearch", per: { aws: "Amazon OpenSearch Service", azure: "Elastic Cloud on Azure", gcp: "Elastic Cloud on GCP", onprem: "OpenSearch cluster" } },
    ],
  },
  {
    id: "messaging",
    label: "Messaging / events",
    section: "Data",
    options: [
      { id: "rabbitmq", label: "RabbitMQ", per: { aws: "Amazon MQ for RabbitMQ", azure: "RabbitMQ on AKS", gcp: "RabbitMQ on GKE", onprem: "RabbitMQ quorum cluster" } },
      { id: "kafka", label: "Apache Kafka", per: { aws: "Amazon MSK", azure: "Event Hubs (Kafka API)", gcp: "Managed Service for Apache Kafka", onprem: "Kafka (KRaft) cluster" } },
      { id: "cloud-queue", label: "Cloud-native queue / bus", per: { aws: "SQS + SNS + EventBridge", azure: "Service Bus + Event Grid", gcp: "Pub/Sub", onprem: "RabbitMQ quorum cluster" } },
      none,
    ],
  },
  {
    id: "objectStorage",
    label: "Object storage",
    section: "Data",
    options: [
      { id: "native", label: "Cloud object storage", per: { aws: "Amazon S3", azure: "Azure Blob Storage", gcp: "Cloud Storage", onprem: "MinIO (S3-compatible)" } },
      none,
    ],
  },
  {
    id: "loadBalancer",
    label: "Load balancer",
    section: "Network & edge",
    options: [
      { id: "cloud-l7", label: "Cloud L7 load balancer", per: { aws: "Application Load Balancer", azure: "Application Gateway v2", gcp: "External HTTPS Load Balancer", onprem: "HAProxy + keepalived" } },
      { id: "nginx", label: "NGINX", per: { aws: "NGINX on NLB", azure: "NGINX on Azure LB", gcp: "NGINX on TCP LB", onprem: "NGINX + keepalived" } },
      { id: "haproxy", label: "HAProxy", per: { aws: "HAProxy on NLB", azure: "HAProxy on Azure LB", gcp: "HAProxy on TCP LB", onprem: "HAProxy + keepalived" } },
      { id: "f5", label: "F5 BIG-IP", per: { aws: "F5 BIG-IP VE (Marketplace)", azure: "F5 BIG-IP VE (Marketplace)", gcp: "F5 BIG-IP VE (Marketplace)", onprem: "F5 BIG-IP appliance pair" }, licenceAedMonth: 3700, licenceNote: "F5 BIG-IP VE LTM 1 Gbps pair, subscription estimate" },
    ],
  },
  {
    id: "apiGateway",
    label: "API gateway",
    section: "Network & edge",
    options: [
      { id: "kong", label: "Kong", per: { aws: "Kong on EKS", azure: "Kong on AKS", gcp: "Kong on GKE", onprem: "Kong on Kubernetes" } },
      { id: "cloud-apigw", label: "Cloud API gateway", per: { aws: "Amazon API Gateway", azure: "Azure API Management", gcp: "Apigee / API Gateway", onprem: "Kong on Kubernetes" } },
      { id: "nginx-ingress", label: "NGINX Ingress only", per: { aws: "NGINX Ingress", azure: "NGINX Ingress", gcp: "NGINX Ingress", onprem: "NGINX Ingress" } },
      none,
    ],
  },
  {
    id: "cdnWaf",
    label: "CDN / WAF",
    section: "Network & edge",
    options: [
      { id: "native", label: "Cloud-native CDN + WAF", per: { aws: "CloudFront + AWS WAF", azure: "Front Door + WAF", gcp: "Cloud CDN + Cloud Armor", onprem: "Cloudflare Business" } },
      { id: "cloudflare", label: "Cloudflare", per: { aws: "Cloudflare Business", azure: "Cloudflare Business", gcp: "Cloudflare Business", onprem: "Cloudflare Business" }, licenceAedMonth: 735, licenceNote: "Cloudflare Business plan (USD 200)" },
      none,
    ],
  },
  {
    id: "identity",
    label: "Identity / SSO",
    section: "Platform & operations",
    options: [
      { id: "keycloak", label: "Keycloak", per: { aws: "Keycloak on EKS", azure: "Keycloak on AKS", gcp: "Keycloak on GKE", onprem: "Keycloak HA" } },
      { id: "cloud-idp", label: "Cloud identity", per: { aws: "Cognito + IAM Identity Center", azure: "Entra ID / External ID", gcp: "Identity Platform + Cloud Identity", onprem: "Keycloak HA" } },
      { id: "auth0", label: "Auth0 / Okta", per: { aws: "Auth0", azure: "Auth0", gcp: "Auth0", onprem: "Auth0" }, licenceAedMonth: 880, licenceNote: "Auth0 B2C Essentials-class plan estimate" },
    ],
  },
  {
    id: "secrets",
    label: "Secrets & keys",
    section: "Platform & operations",
    options: [
      { id: "native", label: "Cloud secrets manager + KMS", per: { aws: "Secrets Manager + KMS", azure: "Key Vault (HSM)", gcp: "Secret Manager + Cloud KMS", onprem: "HashiCorp Vault" } },
      { id: "vault", label: "HashiCorp Vault", per: { aws: "Vault on EKS", azure: "Vault on AKS", gcp: "Vault on GKE", onprem: "HashiCorp Vault" } },
    ],
  },
  {
    id: "observability",
    label: "Observability",
    section: "Platform & operations",
    options: [
      { id: "prometheus", label: "Prometheus + Grafana + Loki" },
      { id: "elk", label: "ELK / OpenSearch stack" },
      { id: "datadog", label: "Datadog", licenceAedMonth: 2600, licenceNote: "Datadog infra + APM, ~10 hosts" },
    ],
  },
  {
    id: "cicd",
    label: "CI/CD",
    section: "Delivery",
    options: [
      { id: "github", label: "GitHub Actions + Argo CD" },
      { id: "gitlab", label: "GitLab CI + Argo CD" },
      { id: "jenkins", label: "Jenkins + Argo CD" },
      { id: "azdo", label: "Azure DevOps Pipelines" },
    ],
  },
  {
    id: "iac",
    label: "Infrastructure as code",
    section: "Delivery",
    options: [
      { id: "terraform", label: "Terraform / OpenTofu" },
      { id: "pulumi", label: "Pulumi" },
      { id: "native", label: "Cloud-native (CloudFormation / Bicep / Deployment Manager)" },
      { id: "ansible", label: "Ansible (on-premise)" },
    ],
  },
  {
    id: "email",
    label: "Transactional email",
    section: "Platform & operations",
    options: [
      { id: "native", label: "Cloud email service", per: { aws: "Amazon SES", azure: "Azure Communication Services Email", gcp: "SendGrid (Marketplace)", onprem: "Postfix + relay" } },
      { id: "sendgrid", label: "SendGrid", per: { aws: "SendGrid", azure: "SendGrid", gcp: "SendGrid", onprem: "SendGrid" } },
      none,
    ],
  },
  {
    id: "dr",
    label: "Disaster recovery",
    section: "Platform & operations",
    options: [
      { id: "pilot", label: "Pilot light (second region)" },
      { id: "warm", label: "Warm standby (second region)" },
      { id: "backup", label: "Backups only (same region)" },
    ],
  },
  {
    id: "aiTooling",
    label: "AI coding tools (vibe coding)",
    section: "Delivery",
    multi: true,
    options: [
      { id: "cursor", label: "Cursor" },
      { id: "claude-code", label: "Claude Code" },
      { id: "copilot", label: "GitHub Copilot" },
    ],
  },
];

export type Selections = Record<Exclude<FilterKey, "aiTooling">, string> & { aiTooling: string[] };

export const DR_UPLIFT: Record<string, number> = { pilot: 0.15, warm: 0.45, backup: 0.04 };

export const SLIDE_SECTIONS = [
  ["summary", "Executive summary"],
  ["scope", "Scope (description)"],
  ["screens", "Screenshots"],
  ["stack", "Technology stack"],
  ["architecture", "Architecture diagram"],
  ["sizing", "Resource sizing"],
  ["costs", "Cost comparison"],
  ["roadmap", "Roadmap & phase cost"],
  ["security", "Security"],
  ["boq", "Bill of quantities"],
  ["assumptions", "Assumptions & next steps"],
] as const;

export type SlideSection = (typeof SLIDE_SECTIONS)[number][0];

export interface Preset {
  id: string;
  label: string;
  architecture: ArchitectureStyle;
  hosting: Target;
  selections: Selections;
}

const baseAi = ["cursor", "claude-code"];

export const PRESETS: Preset[] = [
  {
    id: "micro-ref",
    label: "Microservices reference",
    architecture: "microservices",
    hosting: "azure",
    selections: {
      backend: "java-spring", frontend: "react-next", mobile: "flutter", sqlDb: "postgres", noSql: "cloud-doc", cache: "redis", search: "none",
      messaging: "rabbitmq", objectStorage: "native", loadBalancer: "cloud-l7", apiGateway: "kong", cdnWaf: "native", identity: "cloud-idp",
      secrets: "native", observability: "prometheus", cicd: "github", iac: "terraform", email: "native", dr: "pilot", aiTooling: baseAi,
    },
  },
  {
    id: "mono-ref",
    label: "Monolithic 3-tier reference",
    architecture: "monolith-3tier",
    hosting: "aws",
    selections: {
      backend: "dotnet", frontend: "angular", mobile: "none", sqlDb: "sqlserver", noSql: "none", cache: "redis", search: "none",
      messaging: "none", objectStorage: "native", loadBalancer: "cloud-l7", apiGateway: "none", cdnWaf: "native", identity: "cloud-idp",
      secrets: "native", observability: "elk", cicd: "azdo", iac: "terraform", email: "native", dr: "backup", aiTooling: baseAi,
    },
  },
  {
    id: "onprem-ref",
    label: "On-premise sovereign",
    architecture: "microservices",
    hosting: "onprem",
    selections: {
      backend: "java-spring", frontend: "react-next", mobile: "flutter", sqlDb: "postgres", noSql: "mongodb", cache: "redis", search: "opensearch",
      messaging: "kafka", objectStorage: "native", loadBalancer: "haproxy", apiGateway: "kong", cdnWaf: "cloudflare", identity: "keycloak",
      secrets: "vault", observability: "prometheus", cicd: "gitlab", iac: "ansible", email: "native", dr: "pilot", aiTooling: baseAi,
    },
  },
];

export function option(key: FilterKey, id: string): TechOption | undefined {
  return FILTERS.find((g) => g.id === key)?.options.find((o) => o.id === id);
}

export function serviceName(key: FilterKey, id: string, hosting: Hosting | "generic"): string {
  const o = option(key, id);
  if (!o) return "—";
  if (hosting === "generic") return o.label;
  if (hosting === "vercel" || hosting === "lovable") {
    if (key === "backend") {
      const ok = hosting === "vercel" ? ["node-nest", "python-fastapi"] : ["node-nest"];
      return ok.includes(id) ? `${o.label} as ${hosting === "vercel" ? "Vercel Functions" : "Supabase Edge Functions"}` : "Not supported: host separately";
    }
    if (key === "mobile" && hosting === "lovable" && id !== "none") return "Separate build (Lovable is web-only)";
    const m = MANAGED_NAMES[hosting];
    return m[`${key}:${id}`] ?? m[key] ?? o.label;
  }
  return o.per?.[hosting] ?? o.label;
}
