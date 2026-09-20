import type { ArchitectureStyle } from "../architecture";

export type ProductKind = "platform" | "product" | "software";
export type DeploymentModel = "cloud" | "on-premise" | "hybrid";
export type { ArchitectureStyle };

export interface PlannerBrief {
  productName: string;
  clientName: string;
  vendorName: string;
  kind: ProductKind;
  architectureStyle: ArchitectureStyle;
  deployment: DeploymentModel;
  rateCard?: Record<string, number>;
  industry: string;
  briefing: string;
  modules: string;
  users: string;
  durationMonths: string;
  constraints: string;
  startDate: string;
}

export interface DocTable {
  caption: string;
  headers: string[];
  rows: string[][];
}

export interface DocSection {
  heading: string;
  body: string;
  paragraphs?: string[];
  bullets?: string[];
  numbered?: string[];
  table?: DocTable;
  diagramId?: string;
}

export interface Diagram {
  id: string;
  title: string;
  caption: string;
  width: number;
  height: number;
  svg: string;
}

export interface Milestone {
  id: string;
  name: string;
  phase: string;
  startWeek: number;
  durationWeeks: number;
  owner: string;
  deliverables: string[];
}

export interface BoqLine {
  item: string;
  category: "compute" | "storage" | "network" | "security" | "facility" | "license" | "services" | "support";
  qty: number;
  unit: string;
  unitAed: number;
  totalAed: number;
  capex: boolean;
  notes: string;
}

export interface TestCase {
  id: string;
  suite: "Functional" | "Integration" | "Security" | "NFR" | "UAT";
  module: string;
  title: string;
  preconditions: string;
  steps: string;
  expected: string;
  priority: "P0" | "P1" | "P2";
}

export interface ApiContract {
  method: string;
  path: string;
  purpose: string;
  auth: string;
  request?: string;
  response?: string;
}

export interface ComponentSpec {
  name: string;
  layer: string;
  responsibility: string;
  tech: string;
  interfaces: string;
}

export interface ArchBox {
  id: string;
  label: string;
  sub: string;
  layer: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArchitectureView {
  id: "software" | "network" | "security" | "database" | "reporting" | "bi" | "complaints";
  title: string;
  summary: string;
  bullets: string[];
  table?: DocTable;
  diagramId: string;
}

export interface WireframeScreen {
  id: string;
  name: string;
  persona: string;
  purpose: string;
  layoutNotes: string;
  regions: string[];
  emptyState: string;
  errorState: string;
  stitchPrompt: string;
  figmaNotes: string;
  width: number;
  height: number;
  svg: string;
}

export interface Slide {
  title: string;
  kicker: string;
  bullets: string[];
  note?: string;
}

export interface RfpPreviewRow {
  sheet: string;
  question: string;
  answer: string;
  compliance: "Comply" | "Partial" | "Noted" | "Exception";
}

export interface InvoiceLine {
  description: string;
  qty: number;
  unit: string;
  unitAed: number;
  vatRate: number;
}

export interface Invoice {
  id: string;
  number: string;
  kind: "proforma" | "tax" | "credit-note";
  status: "Draft" | "Pro forma" | "Template";
  title: string;
  issueDate: string;
  dueDate: string;
  poRef: string;
  sowRef: string;
  msaRef: string;
  gate: string;
  trigger: string;
  lines: InvoiceLine[];
  notes: string[];
}

export type InfraEnv = "DEV" | "UAT" | "PRD";

export interface InfraVlan {
  env: InfraEnv;
  vlanId: number;
  name: string;
  zone: string;
  cidr: string;
  mask: string;
  gateway: string;
  dns: string;
  ntp: string;
  dhcp: string;
  purpose: string;
}

export interface InfraVm {
  hostname: string;
  fqdn: string;
  env: InfraEnv;
  role: string;
  function: string;
  cluster: string;
  hypervisor: string;
  os: string;
  vcpu: number;
  ramGi: number;
  osDiskGi: number;
  dataDiskGi: number;
  extraDisks: string;
  vlanId: number;
  vlanName: string;
  subnet: string;
  ip: string;
  vip: string;
  gateway: string;
  dns: string;
  ntp: string;
  ha: string;
  backupPolicy: string;
  monitoring: string;
  notes: string;
  k8sRole: "" | "master" | "worker";
  k8sTaints: string;
  cri: string;
}

export interface InfraPolicy {
  id: string;
  env: InfraEnv | "ALL";
  name: string;
  direction: "north-south" | "east-west" | "mgmt" | "backup";
  fromZone: string;
  toZone: string;
  source: string;
  destination: string;
  service: string;
  action: "allow" | "deny" | "reject";
  logging: string;
  nat: string;
  notes: string;
}

export interface InfraStorage {
  volume: string;
  env: InfraEnv;
  type: string;
  sizeGi: number;
  replica: string;
  mountOrLun: string;
  owner: string;
  encryption: string;
  backup: string;
}

export interface InfraVip {
  name: string;
  env: InfraEnv;
  dns: string;
  vip: string;
  vlanId: number;
  pool: string;
  ports: string;
  persistence: string;
  healthCheck: string;
  cert: string;
}

export interface InfraHost {
  name: string;
  env: InfraEnv;
  role: string;
  cpu: string;
  ramGi: number;
  localNvmeGi: number;
  cluster: string;
  mgmtIp: string;
  vlan: string;
}

export interface InfraCapacity {
  env: InfraEnv;
  vmCount: number;
  vcpu: number;
  ramGi: number;
  osDiskGi: number;
  dataDiskGi: number;
}

export interface InfraPlan {
  siteCode: string;
  domain: string;
  hypervisor: string;
  runtime: "kubernetes" | "three-tier";
  naming: string[];
  vlans: InfraVlan[];
  vms: InfraVm[];
  policies: InfraPolicy[];
  storage: InfraStorage[];
  vips: InfraVip[];
  hosts: InfraHost[];
  dns: { name: string; type: string; value: string; env: string; notes: string }[];
  capacity: InfraCapacity[];
  assumptions: string[];
}

export interface EffortRole {
  id: string;
  role: string;
  discipline: string;
  aedPerHour: number;
  aedPerDay: number;
  notes: string;
}

export interface EffortLine {
  phaseId: string;
  phase: string;
  weeks: number;
  roleId: string;
  role: string;
  fte: number;
  utilisation: number;
  manDays: number;
  hours: number;
  aedPerHour: number;
  costAed: number;
}

export interface EffortModule {
  module: string;
  hours: number;
  manDays: number;
  costAed: number;
  sharePct: number;
}

export interface EffortPhaseTotal {
  phaseId: string;
  phase: string;
  weeks: number;
  hours: number;
  manDays: number;
  costAed: number;
}

export interface EffortPlan {
  hoursPerDay: number;
  utilisation: number;
  contingencyPct: number;
  calendarMonths: number;
  calendarWeeks: number;
  roles: EffortRole[];
  lines: EffortLine[];
  byPhase: EffortPhaseTotal[];
  byModule: EffortModule[];
  byRole: { role: string; hours: number; manDays: number; costAed: number; avgFte: number }[];
  hours: number;
  manDays: number;
  costAed: number;
  contingencyHours: number;
  contingencyAed: number;
  totalHours: number;
  totalManDays: number;
  totalCostAed: number;
  assumptions: string[];
}

export interface DeliveryPack {
  brief: PlannerBrief;
  generatedAt: string;
  slug: string;
  kindLabel: string;
  moduleList: string[];
  userCount: number;
  months: number;
  executiveSummary: string;
  rfpNarrative: string[];
  sow: DocSection[];
  nda: DocSection[];
  msa: DocSection[];
  hld: DocSection[];
  lld: DocSection[];
  brd: DocSection[];
  prd: DocSection[];
  components: ComponentSpec[];
  apis: ApiContract[];
  boq: { lines: BoqLine[]; capexAed: number; opexYearAed: number };
  infra: InfraPlan;
  effort: EffortPlan;
  milestones: Milestone[];
  testCases: TestCase[];
  diagrams: Diagram[];
  architecture: { boxes: ArchBox[]; layers: string[]; svg: string };
  architectureViews: ArchitectureView[];
  slides: Slide[];
  wireframes: WireframeScreen[];
  placeholders: Record<string, string>;
  assumptions: string[];
  invoices: Invoice[];
}
