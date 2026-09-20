import type { ApiContract, ArchitectureView, ComponentSpec, DocSection, PlannerBrief } from "./types";

export function kindLabel(kind: PlannerBrief["kind"]) {
  return kind === "platform" ? "platform" : kind === "product" ? "product" : "software solution";
}

export function deployPhrase(d: PlannerBrief["deployment"]) {
  if (d === "on-premise") return "on-premise (customer datacenter / private cloud)";
  if (d === "hybrid") return "hybrid (cloud control plane with on-premise data plane)";
  return "secure public-cloud (UAE/GCC region preferred)";
}

export function architecturePhrase(brief: PlannerBrief) {
  return brief.architectureStyle === "monolith-3tier"
    ? "monolithic 3-tier (presentation, application, data)"
    : "microservices (API gateway and independently deployable services)";
}

export function buildSow(
  product: string,
  client: string,
  vendor: string,
  brief: PlannerBrief,
  modules: string[],
  months: number,
  users: number,
  constraints: string,
  briefing: string
): DocSection[] {
  const phases = Math.min(5, Math.max(3, Math.round(months / 2)));
  return [
    {
      heading: "1. What this SOW is",
      body: `${vendor} will design, build, test and hand over ${product} to ${client}. ${client} pays against the milestones below, not against a pile of workshops with no software.`,
      paragraphs: [
        `What we heard: ${briefing}`,
        `Size: about ${users.toLocaleString()} named users. Time: ${months} months. Where it runs: ${deployPhrase(brief.deployment)}. Architecture: ${architecturePhrase(brief)}. The BOQ in this pack is for planning; it is not an invoice.`,
        `If something is unclear, write it down and run it through change control (§9). Verbal “can you just…” is not scope.`,
      ],
    },
    {
      heading: "2. What good looks like",
      body: `${client} can run the in-scope work on ${product}: the right people get in, the wrong people do not, and you can show an auditor who changed a record.`,
      bullets: [
        `${modules.join(", ")} live in production, with roles, not a demo on a laptop.`,
        "Each increment has tests you can open (function, integration, security, load, UAT).",
        `After go-live we stay for 30 days of hypercare. You are not left with a system only the vendor can restart.`,
        `We will follow ${client} policy on personal data. Constraints we already know: ${constraints}`,
      ],
    },
    {
      heading: "3. In-scope services",
      body: "The Supplier shall perform the following work packages unless a signed change request removes or defers them. Each package produces the artefacts listed in §6.",
      numbered: [
        `Discovery — process, data-classification, integration, security, and environment workshops with ${client}; RAID log; refined backlog; environment request pack.`,
        "Architecture — HLD, LLD, and desktop wireframes (SVG + Stitch prompts for Figma).",
        ...modules.map((m) => `Capability delivery — ${m}: analysis, UX/API design, implementation, automated tests, admin screens, and as-built notes.`),
        "Environments — development, test/UAT, and production (plus DR topology when on-premise or hybrid), with secrets management and infrastructure as code.",
        "Security baseline — IdP federation, RBAC/SoD matrix, encryption in transit and at rest, audit of privileged actions, dependency scanning, and a pre-go-live VA/PT cycle with agreed remediation.",
        "Data — migration templates for in-scope reference and open-transaction data; no unbounded historical cleansing unless added by change.",
        "Assurance — SIT, security tests, NFR evidence, UAT support, defect triage against severity definitions in §8.",
        "Service introduction — cutover plan, training (admin + super-user), knowledge transfer, 30 calendar days of hypercare aligned to Client business hours (GST) unless 24×7 is separately contracted.",
      ],
      diagramId: "process",
    },
    {
      heading: "4. Out of scope",
      body: "The following are excluded unless added through change control. Exclusion is stated so that both parties share the same expectation at bid and at kickoff.",
      bullets: [
        "Replacement or rewrite of unrelated legacy systems that are not named on the integration schedule.",
        "End-user devices, corporate WAN/MPLS, and the Client’s identity-provider licensing (Entra ID, UAE Pass commercial terms, etc.).",
        "Data quality remediation of source systems beyond agreed field mapping and reject/repair queues.",
        "24×7 operations staffing, SOC-as-a-service, and multi-year application management — offered as a separate managed-service schedule.",
        "Custom hardware procurement as a reseller (the BOQ is a planning instrument; purchase is through the Client’s integrator unless otherwise agreed).",
      ],
    },
    {
      heading: "5. Client responsibilities",
      body: `${client} remains accountable for timely decisions. Delay in the items below is a day-for-day impact on the calendar unless the Supplier can reasonably mitigate.`,
      numbered: [
        "Nominate a product owner with authority to accept increments, and a technical counterpart for identity, network, and data.",
        "Provide access to sample data, current SOPs, integration sandboxes, and the IdP (OIDC/SAML metadata) within ten business days of kickoff.",
        "Review artefacts within five working days (GST) as in §12. Written defects must cite a requirement or test ID. Silence after that window is deemed acceptance of that deliverable.",
        "Staff UAT with real users of each persona; Supplier cannot sign UAT on the Client’s behalf.",
        "Own production change windows, CAB, and any physical datacenter access for on-premise work.",
      ],
      table: {
        caption: "RACI (R = responsible, A = accountable, C = consulted, I = informed)",
        headers: ["Activity", vendor, `${client} PO`, `${client} IT/Sec`, "Users"],
        rows: [
          ["Workshops & backlog", "R", "A", "C", "C"],
          ["HLD / LLD freeze", "R", "A", "C", "I"],
          ["Build & unit/SIT", "A/R", "I", "C", "I"],
          ["Security design & VA/PT", "R", "C", "A", "I"],
          ["UAT", "C", "A", "I", "R"],
          ["Go-live CAB", "C", "A", "R", "I"],
          ["Hypercare", "R", "A", "C", "I"],
        ],
      },
    },
    {
      heading: "6. Deliverables and gates",
      body: `Work is organised in ${phases} phase gates. Agile sprints (two weeks) sit inside the gates so ${client} sees working software without losing milestone control. A gate is passed when the listed artefacts are submitted and severity-1/2 defects are closed or waived in writing.`,
      table: {
        caption: "Deliverable register (planning)",
        headers: ["ID", "Deliverable", "Gate", "Format"],
        rows: [
          ["D01", "RAID, workshop pack, refined backlog", "M0 Discovery", "Confluence/Word + backlog"],
          ["D02", "HLD with software, network, security, database, reporting, BI, and complaints architecture (separate views)", "M1 Architecture", "Word + SVG"],
          ["D03", "LLD (APIs, data, failure modes, sequence)", "M1 Architecture", "Word"],
          ["D04", "Security design & RBAC matrix", "M1 Architecture", "Word/Excel"],
          ["D05", "Increment builds per capability", "Build sprints", "Software + OpenAPI"],
          ["D06", "Test pack & evidence", "SIT/NFR/UAT", "Excel + reports"],
          ["D07", "Cutover & rollback plan", "UAT", "Word"],
          ["D08", "As-built, runbooks, training records", "Go-live", "Word + recordings"],
          ["D09", "Wireframes (SVG) + Stitch prompts for Figma", "M1 / UX", "Zip + Figma file owned by Client design"],
          ["D10", "Infrastructure workbook (VM names, vCPU/RAM/disk, IPs, VLAN/subnets, firewall/NSG)", "M1 Architecture", "Excel"],
          ["D11", "Effort estimate and man-hour costing (roles, FTE, hours, AED)", "M0 / commercial", "Excel"],
        ],
      },
      diagramId: "cicd",
    },
    {
      heading: "7. Approach, governance, and reporting",
      body: `${vendor} will run a weekly steering pack (progress, RAID, burn-up, upcoming decisions) and a technical stand-up. Steering attendees: Client product owner, Supplier delivery lead, architect as required. Decisions older than five business days are escalated.`,
      paragraphs: [
        "RAID items are classified (risk, assumption, issue, dependency) with an owner, due date, and residual rating. Assumptions in this pack become RAID entries at kickoff so they are either validated or converted to change.",
        "Source control, CI, and artefact promotion are the Supplier’s unless the Client mandates a platform; in that case access is a Client responsibility (§5).",
      ],
    },
    {
      heading: "8. Acceptance, severity, and warranty of workmanship",
      body: "An increment is accepted when the mapped P0/P1 tests pass or are waived, severity-1 defects are zero, severity-2 defects have an agreed fix-forward, and the Client product owner records written acceptance (email or tool).",
      table: {
        caption: "Defect severity (used in SIT, UAT, and hypercare)",
        headers: ["Sev", "Meaning", "Response (hypercare hours)", "Resolution target"],
        rows: [
          ["1", "Production down or data loss / security breach in progress", "15 minutes", "4 hours workaround or restore"],
          ["2", "Major journey blocked; no reasonable workaround", "1 hour", "1 business day"],
          ["3", "Degraded feature; workaround exists", "4 hours", "Next sprint / agreed release"],
          ["4", "Cosmetic / documentation", "Next business day", "Backlog"],
        ],
      },
      paragraphs: [
        "Final acceptance follows production go-live plus completion of the 30-day hypercare report. Latent defects of sev 1–2 discovered in hypercare are corrected under this SOW; thereafter they fall under the support schedule if contracted.",
      ],
    },
    {
      heading: "9. Change control",
      body: "Material change to scope, calendar, or cost is logged, impact-assessed (effort, risk, schedule), and approved by both product owners before work proceeds. Gold-plating without a CR is not billable and is not a Supplier obligation.",
    },
    {
      heading: "10. Assumptions and constraints",
      body: constraints,
      bullets: [
        `${users.toLocaleString()} named users is the sizing basis (peak concurrent modelled at ~10% unless discovery shows otherwise).`,
        `Calendar of ${months} months assumes Client reviews within five business days and environment access as in §5.`,
        "Arabic (or other) language packs are string-externalised; certified linguistic QA of all copy is a Client activity unless a CR adds it.",
      ],
    },
  ];
}

export function buildHld(
  product: string,
  client: string,
  vendor: string,
  brief: PlannerBrief,
  modules: string[],
  users: number,
  constraints: string,
  briefing: string
): DocSection[] {
  return [
    {
      heading: "1. Why this design exists",
      body: `${product} for ${client}. ${vendor} wrote this HLD so infrastructure, security and engineering argue from the same pictures. If the RFP and this file clash, we raise it at freeze — we do not implement the clash quietly.`,
      paragraphs: [
        briefing,
        `~${users.toLocaleString()} named users. ${deployPhrase(brief.deployment)}. Constraints: ${constraints}`,
        "LLD has the APIs and failure modes. Wireframes have the screens. Architecture is seven separate views: software, network, security, database, reporting, BI, and complaints handling.",
      ],
    },
    {
      heading: "2. What we will not trade away",
      body: "If a later design drops one of these, it needs a written ADR and ${client} on the email.".replace("${client}", client),
      bullets: [
        "API-first: user journeys and partner integrations share the same versioned HTTPS APIs (OpenAPI 3). The UI is a client, not a second business layer.",
        "Zero trust: authenticate at the edge, authorise in the service, encrypt in transit (TLS 1.2+) and at rest; no implicit trust of VLAN or subnet.",
        "Stateless application tier: session and hot state live in Redis; durable state in PostgreSQL; files in object storage. This is what makes horizontal scale and rolling deploy possible.",
        "Transactional outbox: domain events are written in the same database transaction as the aggregate so notifications, search, and downstream modules cannot diverge silently.",
        "Observability by default: traces (W3C traceparent), structured logs, RED/USE metrics, synthetic checks on the top journeys.",
        brief.deployment === "on-premise"
          ? "On-premise HA: N+1 compute, dual ToR, clustered data stores, backup on an isolated VLAN, no single rack as a SPOF."
          : brief.deployment === "hybrid"
            ? "Hybrid: internet-facing control in cloud; classified data remains on-premise unless the Client reclassifies it in writing."
            : "Cloud: multi-AZ, private subnets, no public data stores, infrastructure as code, customer-managed keys where the Client’s policy requires.",
      ],
      table: {
        caption: "Quality-attribute scenarios (ATAM-style)",
        headers: ["ID", "Attribute", "Scenario", "Response measure"],
        rows: [
          ["QA-1", "Availability", "AZ or host loss during business hours", "API error rate < 1% after 60s; no lost committed writes"],
          ["QA-2", "Performance", `${Math.round(users * 0.1)} concurrent users on core list/detail`, "p95 < 2s on UAE broadband; p99 < 4s"],
          ["QA-3", "Recoverability", "Site or region declared lost", "RPO ≤ 15 min; RTO ≤ 4 h after decision to fail over"],
          ["QA-4", "Security", "Stolen session token used from new IP", "Refresh rotation + anomaly flag; audit row written"],
          ["QA-5", "Modifiability", `New capability adjacent to ${modules[0]}`, "Additive service + events; no rewrite of SoR"],
          ["QA-6", "Auditability", "Privileged change to a record", "Who/what/when/why retained ≥ 365 days"],
          ["QA-7", "Complaints", "Lodge via portal or contact centre during hours", "Ack within Client SLO; unique case id; SoD on decision"],
          ["QA-8", "Reporting freshness", "Dashboard open after warehouse load", "CDC lag within SLO; no query of OLTP primary"],
        ],
      },
    },
    {
      heading: "3. Software architecture",
      body:
        brief.architectureStyle === "monolith-3tier"
          ? `${product} is a monolithic 3-tier system. The SPA and partners call OpenAPI on the application tier. Packages for ${modules.join(", ")} live in one deployable. Presentation (reverse proxy) has no business rules.`
          : `${product} is an API-first system. The SPA, admin UI, and partner clients are clients of the same OpenAPI contracts. Business rules live in domain services for ${modules.join(", ")}, not in the browser.`,
      paragraphs:
        brief.architectureStyle === "monolith-3tier"
          ? [
              "Tiers: presentation (reverse proxy, static, TLS), application (one binary, modular packages), data (PostgreSQL as SoR, Redis cache, object store).",
              `Packages: ${modules.join("; ")}. They share a process and a database with schema ownership. Do not split into Kubernetes services in this SOW unless a CR says so.`,
              "UI holds no durable business state. Session lives in Redis. Horizontal scale is more application VMs, not more service types.",
              "OpenAPI 3 is frozen at M1. Sequence and process diagrams support this view.",
            ]
          : [
              "Containers (C4 L2): web SPA, optional BFF, API gateway, identity adapter, notification adapter, one service (or modular package) per capability, shared kernel (audit, RBAC, errors, tracing), PostgreSQL, Redis, object store, message bus.",
              `Bounded contexts: ${modules.join("; ")}. Shared kernel is libraries and the identity/audit services — not a shared database for all modules. A modular monolith is allowed for MVP; split when independent scale or release cadence demands it.`,
              "UI holds no durable business state. East–west calls use service identity (mTLS or projected workload identity), not the user’s JWT reused as a hop token without an audience restriction.",
              "OpenAPI 3 is frozen at M1 and is the source of truth for UI, partners, and tests. Sequence and process diagrams support this view; they are not a substitute for it.",
            ],
      diagramId: "software",
    },
    {
      heading: "4. Process architecture",
      body: "The canonical journey is submit → validate → persist → (optional) human decision → notify. This pattern is instantiated per capability so operations and UAT share one mental model.",
      paragraphs: [
        `The end user initiates work in the portal. The officer of ${client} acts on queues that the system derives from state transitions — the product does not depend on inbox-as-spreadsheet. Integrations are invoked either synchronously when the user is blocked on the result, or asynchronously when the downstream SLA is longer than a request timeout.`,
        "Compensating actions are explicit: a failed downstream after a local commit raises a repair task rather than silently rolling back committed legal records. Timeouts, retries with jitter, and idempotency keys are mandatory on egress.",
      ],
      diagramId: "process",
    },
    {
      heading: "5. Security architecture",
      body: `${product} does not store passwords for Client staff. Authentication is federated to ${client}’s IdP (OIDC preferred; SAML where mandated, including UAE Pass for public users when in scope). This section is the security architecture; network zones are in §7.`,
      paragraphs: [
        "Zero trust: a VLAN is not a credential. WAF and gateway enforce TLS, bot/geo, rate limits, and JWT validation. Services authenticate to each other. Authorisation is RBAC with optional ABAC (organisation unit, classification, duty). Segregation of duties: the same principal cannot submit and give final approval on the same case when the Client’s control matrix forbids it.",
        "Secrets, keys, and certificates live in a vault. Break-glass accounts are named, monitored, and time-bounded. Every privileged mutation writes an append-only audit record (actor, subject, action, before/after hash or field diff, correlation id, reason).",
        "In transit: TLS 1.2+. At rest: volume/TDE plus backup encryption. VA/PT, SAST, and SCA are CI and pre-go-live gates. PDPL: minimise PII, residency as the deployment model, 72-hour incident notice path.",
      ],
      diagramId: "security-arch",
    },
    {
      heading: "6. Database architecture",
      body: "PostgreSQL is the system of record. Redis is cache only. Object storage holds files; the database stores the object key and checksum. Bounded contexts do not share tables as an integration style.",
      paragraphs: [
        "Topology: primary plus synchronous or semi-sync replica for failover, plus a read replica for reporting that is not used as a second writer. PITR via WAL shipping. RPO ≤ 15 minutes; restore drills each release train.",
        `Schemas: one (or a clearly owned set) per capability — ${modules.join("; ")}. Cross-context references use stable identifiers, not shared joins. Writes use a version column on user-edited aggregates.`,
        "Transactional outbox: the event row is committed in the same transaction as the aggregate. Consumers are idempotent. Cache invalidation is explicit on write; Redis loss must not lose committed data.",
        "Classification: public / internal / confidential / PII. Soft-delete plus legal-hold. Retention follows Client policy. Data subnet has no inbound internet.",
      ],
      diagramId: "database",
    },
    {
      heading: "7. Network architecture",
      body: `Target runtime is ${deployPhrase(brief.deployment)}. Dev, test/UAT, and production are isolated (separate clusters or namespaces, separate IdP apps, separate data). This section is the network architecture; application containers are in §3.`,
      paragraphs: [
        "North–south: users and partners hit DNS/CDN, then WAF, then load balancer, then the API gateway in a private app network. The data network accepts traffic only from the app network.",
        "East–west: service mesh or security groups with default-deny. Egress is pinned (NAT). Admin access is via bastion or PAM — not SSH from the internet. Backup and management sit on a separate path from user traffic.",
        "Infrastructure is described as code. Production change is a promoted artefact. Certificates are inventory-managed with expiry alerts. Secrets never travel on the data path as clear text in logs.",
      ],
      diagramId: "network",
    },
    {
      heading: "8. Reporting architecture",
      body: `Reporting is a first-class architecture, not a spreadsheet export from ${product}. PostgreSQL remains the system of record. A replica (or CDC stream from that replica) feeds a warehouse. Apache Superset and Microsoft Power BI are consumers of that warehouse — they are not writers of cases.`,
      paragraphs: [
        "Pipeline: OLTP primary → replica → CDC/ETL → dbt star schema → warehouse. Quality gates: row-count reconciliation, freshness, CDC lag. Failed loads page data engineering; they do not silently show yesterday’s numbers as today.",
        "Grain is declared per measure in a KPI dictionary (owner, source table, SQL/DAX). Complaint facts (intake, ack, decision, reopen, SLA breach) are first-class marts, not a side Excel.",
        "The read replica is not a second writer. Ad-hoc SQL Lab against OLTP is forbidden in production.",
      ],
      diagramId: "reporting",
    },
    {
      heading: "9. BI architecture",
      body: "Business intelligence is the consumption layer on the reporting warehouse. Apache Superset is self-hosted (pods or VMs plus metadata DB). Microsoft Power BI is SaaS (Premium/Fabric) with an on-premises data gateway cluster for private warehouse access. One semantic layer; two tools if the Client requires both.",
      paragraphs: [
        "Identity: Superset OIDC; Power BI Entra ID. Row-level security on organisation/tenant is in the dataset, not only a dashboard filter.",
        "Published workspace apps and certified Superset datasets are production. Personal .pbix files and uncertified SQL Lab queries are not. Cost estimator checkboxes size the VMs, pods, gateways, and licences; this view is the control design.",
        "KPI pack (minimum): throughput, backlog age p95, SLA attainment, exception/reject rate, CDC/refresh lag, licensed BI users, warehouse CPU p95, dashboard open p95.",
      ],
      diagramId: "bi",
    },
    {
      heading: "10. Complaints handling architecture",
      body: `${product} treats complaints as a case mechanism, not an inbox. Channels (portal, phone/email, walk-in, partner API, anonymous token where policy allows) converge on one intake API and one complaint_record aggregate for ${client}.`,
      paragraphs: [
        "Lifecycle: lodge → classify → ack (clock starts) → triage/queue → investigate → decision → notify → close. Reopen is a child event on the same case id. Evidence files go to object storage; the database stores key and checksum.",
        "Segregation of duties: the principal who submitted cannot give final decision on the same case. SLA clocks and escalations are system-derived. Contact-centre staff key walk-in/phone cases; they do not own a parallel register.",
        "Every privileged transition writes audit (actor, action, before/after, reason, correlation id). Warehouse facts power backlog and SLA dashboards. Notifications use the transactional outbox — not a fire-and-forget email from the UI.",
      ],
      diagramId: "complaints",
    },
    {
      heading: "11. Availability, DR, and capacity",
      body: `Concurrent design load is approximately ${Math.round(users * 0.1).toLocaleString()} sessions (10% of ${users.toLocaleString()} named users) unless discovery revises it. Horizontal pod/VM autoscaling covers diurnal peaks; data tier is scaled vertically or by read-replica for reporting.`,
      paragraphs: [
        "Availability target: 99.9% monthly for production APIs excluding agreed maintenance. That allows ~43 minutes/month of unplanned unavailability — incidents are still managed, not budgeted as a right to fail.",
        "RPO ≤ 15 minutes for transactional stores (WAL + backup). RTO ≤ 4 hours after the Client declares a disaster. Failover is a rehearsed runbook, not an improvisation. Restore drills run each release train.",
      ],
      diagramId: "dr",
    },
    {
      heading: "12. Security and compliance controls",
      body: `Control set is aligned to ISO 27001 practices and UAE PDPL for personal data. ${constraints}`,
      table: {
        caption: "Control mapping (planning)",
        headers: ["Theme", "Control in ${product}".replace("${product}", product), "Evidence"],
        rows: [
          ["Access", "OIDC + RBAC + MFA at IdP", "IdP logs, RBAC matrix"],
          ["Cryptography", "TLS; TDE/volume encryption; KMS/vault", "Config + scan"],
          ["Logging", "Central logs + audit ledger", "Retention job"],
          ["Vuln mgmt", "CI SAST/SCA + pre-go-live VA/PT", "Pipeline + PT report"],
          ["Privacy", "Classification, minimisation, DSAR process hook", "Data inventory"],
          ["Backup", "Daily full + PITR; isolated target", "Restore drill"],
        ],
      },
    },
    {
      heading: "13. Operations, SLOs, and evolution",
      body: "SLOs exported to the shared dashboard: availability, p95 latency, error rate, backup age, certificate days-to-expiry, queue lag. Runbooks: deploy, rollback, restore, certificate rotation, IdP outage, bus back-pressure, incident severity.",
      paragraphs: [
        `Evolution: MVP ships identity, audit, admin, and ${modules.slice(0, Math.min(3, modules.length)).join(", ")}. Remaining capabilities follow the Gantt. ADRs record splits (e.g. modular monolith → services) so the LLD does not thrash.`,
        `Ownership: ${vendor} holds design authority until final acceptance; ${client} holds production CAB. After hypercare, operational authority follows the support schedule.`,
      ],
      diagramId: "cicd",
    },
  ];
}

export function buildLld(
  product: string,
  client: string,
  brief: PlannerBrief,
  modules: string[],
  components: ComponentSpec[],
  apis: ApiContract[]
): DocSection[] {
  const core = modules[0] ?? "Core";
  return [
    {
      heading: "1. Purpose and how to use this LLD",
      body: `This Low-Level Design specifies how ${product} is built and operated at a level that engineering can implement without re-interpreting the HLD. It is not a substitute for OpenAPI files or migration scripts — those are generated as increment artefacts — but it freezes conventions, sequences, schemas-at-a-glance, and failure handling.`,
      paragraphs: [
        `Readers: lead engineers, QA, DevOps, Client technical counterpart. Related diagrams: software, network, security, database, reporting, BI, complaints, ERD of tables, sequence, identity, and DR. Client: ${client}. Deployment: ${deployPhrase(brief.deployment)}.`,
      ],
      diagramId: "sequence",
    },
    {
      heading: "2. Component catalogue and runtime responsibilities",
      body: "Each component below is a unit of deployment and of failure. Chatty coupling across components is forbidden; they communicate via APIs and events only.",
      paragraphs: [
        components.map((c) => `${c.name} [${c.layer}]: ${c.responsibility} Implemented with ${c.tech}. Exposed/consumed interfaces: ${c.interfaces}.`).join(" "),
      ],
      table: {
        caption: "Component × failure mode",
        headers: ["Component", "If it fails", "User impact", "Mitigation"],
        rows: [
          ["API gateway", "Process/node loss", "New sessions fail until replica/pod healthy (seconds)", "HA pair / HPA; health checks"],
          [`${core} service`, "Crash loop", "Writes to that capability fail", "3+ replicas; circuit in UI"],
          ["PostgreSQL primary", "Host loss", "Brief write freeze during promote", "Auto-failover; RPO clock"],
          ["Redis", "Cluster loss", "Slower reads; sessions may re-auth", "Sentinel/cluster; JWT still valid"],
          ["Message bus", "Partition", "Downstream lag; source of truth intact", "Outbox replay; alerting on lag"],
        ],
      },
    },
    {
      heading: "3. API conventions and catalogue",
      body: "Transport: HTTPS/JSON. Time: ISO-8601 UTC. Correlation: `X-Request-Id` generated at the gateway if absent. Errors: RFC 7807 (`application/problem+json`) — no stack traces to clients. Pagination: cursor preferred; page/size accepted. Mutations that create records require `Idempotency-Key`. Optimistic concurrency: `If-Match` / version field.",
      paragraphs: [
        "Auth: Bearer JWT (OIDC). Resource servers validate issuer, audience, expiry, and signature; then apply RBAC. Partner APIs may use mTLS + client credentials.",
        `Catalogue (planning): ${apis.length} operations. Representative contracts are tabulated; OpenAPI is the implementation source of truth after the first increment.`,
      ],
      table: {
        caption: "API catalogue (extract)",
        headers: ["Method", "Path", "Purpose", "Auth"],
        rows: apis.slice(0, 18).map((a) => [a.method, a.path, a.purpose, a.auth]),
      },
    },
    {
      heading: "4. Canonical write sequence (detailed)",
      body: `The sequence diagram is normative for ${core} and cloned for other modules. Engineers must not short-circuit the outbox.`,
      numbered: [
        "Portal obtains an access token via authorization code + PKCE (or UAE Pass / Client IdP equivalent).",
        "Gateway verifies JWT, attaches request-id, enforces rate limit and WAF headers, routes to the service.",
        "Service authorises (role + optional ABAC). Invalid → 403 + audit.",
        "Validate payload (schema + business invariants). Invalid → 400 problem+json; nothing persisted.",
        "BEGIN transaction: insert/update aggregate with version check; insert outbox row; insert audit row; COMMIT.",
        "Conflict on version → 409. Unique constraint → 409/422 as specified per resource.",
        "Publisher relays outbox to the bus at-least-once. Consumers are idempotent on event-id.",
        "201/200 with resource body and audit-id. Portal shows confirmation, never a blank success.",
      ],
      diagramId: "sequence",
    },
    {
      heading: "5. Data design",
      body: "Logical model: each capability owns an aggregate root, child entities, and domain events. Physical: PostgreSQL schemas per context (or prefix) to allow future split. Naming: snake_case columns, UUID primary keys, timestamptz, created_by/updated_by from the token subject.",
      table: {
        caption: `Illustrative aggregate for ${core} (adapt in discovery)`,
        headers: ["Column", "Type", "Notes"],
        rows: [
          ["id", "uuid PK", "Client-visible identifier"],
          ["status", "text + check", "State machine; transitions table-driven"],
          ["payload", "jsonb", "Non-PII extension attributes"],
          ["pii_ref", "uuid null", "Pointer to classified store / tokenised field"],
          ["version", "int", "Optimistic lock"],
          ["created_at / updated_at", "timestamptz", "UTC"],
          ["created_by / updated_by", "text", "IdP subject"],
          ["legal_hold", "bool", "Blocks purge"],
        ],
      },
      paragraphs: [
        "Indexes: status + updated_at for queues; gin on jsonb only where query patterns demand. Reporting replicas — not the primary — serve heavy export.",
        "Backup: daily full + continuous WAL; restore tested. Encryption at rest on volume/TDE. PII columns tokenised or in a restricted schema with separate grants.",
      ],
      diagramId: "dataflow",
    },
    {
      heading: "6. Entity-relationship diagram (tables)",
      body: `This section is the logical ERD of tables for ${product}. It is normative for naming and cardinality at freeze. Physical DDL (types, indexes, grants) follows this picture; migration scripts are increment artefacts.`,
      paragraphs: [
        "Crow’s-foot: org 1—N principal; principal N—N role via principal_role. Each capability has `{module}_record` (aggregate root) and `{module}_status_hist` (1—N). audit_event and outbox_event are written in the same transaction as the aggregate. object_ref stores file keys; the blob is not in PostgreSQL. notification is a consumer of the outbox, not a second writer of the case.",
        `Illustrated aggregates: ${modules.map((m) => m.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") + "_record").join(", ")}. Cross-context references are UUID columns only — application SQL does not join another context’s tables.`,
        "PII is not a column on the case row when it can be a pii_ref to a restricted schema. Soft-delete plus legal_hold on the aggregate. UUID PKs, timestamptz, version for optimistic lock.",
      ],
      table: {
        caption: "Table catalogue (planning)",
        headers: ["Table", "Kind", "PK", "Relationships", "Owner context"],
        rows: [
          ["org", "Shared kernel", "id uuid", "1—N principal", "Identity"],
          ["principal", "Shared kernel", "id uuid (IdP sub)", "N—1 org; N—N role", "Identity"],
          ["role", "Shared kernel", "id uuid", "N—N principal", "Identity"],
          ["principal_role", "Assoc", "(principal_id, role_id)", "FKs to principal, role", "Identity"],
          [`${(modules[0] ?? "core").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}_record`, "Aggregate", "id uuid", "N—1 org; 1—N status_hist, audit, outbox", modules[0] ?? "Core"],
          [`${(modules[0] ?? "core").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}_status_hist`, "Child", "id uuid", "N—1 record", modules[0] ?? "Core"],
          ["audit_event", "Append-only", "id uuid", "N—1 entity (polymorphic uuid)", "Shared kernel"],
          ["outbox_event", "Transactional outbox", "id uuid", "N—1 aggregate in same TX", "Shared kernel"],
          ["object_ref", "File pointer", "id uuid", "Referenced by record attachment uuid", "Shared kernel"],
          ["notification", "Projection", "id uuid", "From outbox; not SoR for the case", "Notifications"],
          ["complaint_record", "Aggregate", "id uuid", "N—1 org; 1—N event, attachment; channel + status", "Complaints"],
          ["complaint_event", "Child", "id uuid", "N—1 complaint_record (ack, triage, decide, reopen)", "Complaints"],
          ["kpi_definition", "Reference", "code unique", "grain, owner, warehouse source", "Reporting"],
        ],
      },
      diagramId: "erd",
    },
    {
      heading: "7. Complaints handling mechanism",
      body: `Complaints are implemented as ${brief.architectureStyle === "monolith-3tier" ? "application-tier packages with" : "a bounded context (or package) with"} OpenAPI resources under /api/v1/complaints. The UI and the contact-centre form are clients. There is one case identifier for every channel.`,
      numbered: [
        "POST /api/v1/complaints with Idempotency-Key, channel, classification, narrative, optional attachments (object keys), optional anonymous tracking token.",
        "Service authorises (public lodge vs staff key-in vs partner mTLS). Classify; start ack clock; persist complaint_record + audit + outbox in one transaction.",
        "201 returns case id and public tracking token. Ack notification is an outbox consumer, not an inline SMTP call that can roll back the case.",
        "GET list/detail with RBAC. Officer workbench shows SLA remaining. POST …/triage and POST …/decision require a different principal than the submitter (SoD).",
        "Reopen: POST …/reopen creates complaint_event; status returns to in-progress; warehouse fact_reopen increments. Do not insert a second complaint_record without parent_id.",
        "Breach of ack or decision SLO raises an ops page and an escalation task. Spreadsheet inboxes are out of architecture.",
      ],
      diagramId: "complaints",
    },
    {
      heading: "8. Reporting and BI mechanism",
      body: "Warehouse loads never use the OLTP primary. CDC or batch extract runs against the replica. dbt models produce facts (including complaint SLA) and dimensions. Apache Superset and Power BI bind only to certified datasets. Gateway VMs for Power BI are Windows, outbound 443, no inbound internet.",
      paragraphs: [
        "kpi_definition is the catalogue. Changing a measure is a versioned change, not an unnamed dashboard edit. Refresh lag is scraped as a metric and shown on the ops dashboard.",
        "Failure: stale warehouse → BI shows last-good with a freshness banner; it does not fall back to live OLTP.",
      ],
      diagramId: "reporting",
    },
    {
      heading: "9. Integration, timeouts, and resilience",
      body: "Synchronous egress timeout defaults to 3s (connect) / 10s (overall) unless the downstream SLA is documented otherwise. Retries: max 3, exponential jitter, only on idempotent or explicitly safe calls. Circuit breaker opens on error budget burn.",
      paragraphs: [
        "Anti-corruption adapters translate legacy payloads; the domain never leaks vendor-specific types. Mapping tables are versioned.",
        "Back-pressure: if the bus lag exceeds the SLO, the write API still succeeds (SoR + outbox) and operations are paged; the UI may show “processing” for side effects.",
      ],
    },
    {
      heading: "10. Runtime, HA, and environment topology",
      body:
        brief.deployment === "cloud"
          ? "Kubernetes (EKS/AKS/GKE) across three AZs. Gateway and domain Deployments with HPA on CPU and inbound RPS. Managed PostgreSQL Multi-AZ. Redis HA. Object storage with versioning and lifecycle. Nodes in private subnets; public entry only at WAF/ALB."
          : "Kubernetes or VM fleet on the Client hypervisor. Dedicated data VMs. Load-balancer pair. PostgreSQL primary + replica + backup node. Redis Sentinel. Backup array on a separate VLAN. Dual ToR. Jump host / PAM for admin.",
      diagramId: "deployment",
    },
    {
      heading: "11. Security engineering",
      body: "Default-deny network policy. Secrets from vault with short TTL. Images scanned in CI; unsigned images cannot deploy to UAT/prod. Input validation at gateway (size, content-type) and again in the service. Output encoding in the UI. File uploads: type sniffing, size cap, malware scan where the Client provides a scanner, stored outside the web root.",
      paragraphs: [
        "Threats considered: stolen session, CSRF on cookie sessions (SameSite + anti-CSRF if cookies used; Bearer header preferred), injection, IDOR (authorise on every fetch), replay (idempotency + exp), bus poison messages (schema + poison queue).",
        "VA/PT is a gate, not a surprise: scope includes gateway, portal, APIs, and a sample of privileged admin flows.",
      ],
      diagramId: "identity",
    },
    {
      heading: "12. Observability, SLOs, and runbooks",
      body: "Golden signals per service: rate, errors, duration, saturation. Trace every gateway→service→db span. Logs are JSON with request-id and subject (not full PII). Alerts page a human only when user-visible SLOs burn.",
      table: {
        caption: "Planning SLOs",
        headers: ["SLO", "Target", "Window"],
        rows: [
          ["Availability (prod APIs)", "99.9%", "30 days"],
          ["p95 interactive read", "< 2s", "5 min"],
          ["Write success (non-4xx)", "> 99.5%", "1 h"],
          ["Backup age", "< 24 h + WAL", "continuous"],
          ["Bus lag", "< 2 min typical", "5 min"],
        ],
      },
      diagramId: "dr",
    },
  ];
}

export function buildBrd(
  product: string,
  client: string,
  vendor: string,
  brief: PlannerBrief,
  modules: string[],
  users: number,
  constraints: string,
  briefing: string
): DocSection[] {
  return [
    {
      heading: "1. Business objective and problem statement",
      body: `${client} will use ${product} to run ${brief.industry || "enterprise"} operations with control, speed, and an evidence trail that paper or fragmented tools do not provide.`,
      paragraphs: [
        `Problem as understood: ${briefing}`,
        `Without a coherent ${kindLabel(brief.kind)}, ${client} absorbs delay, re-keying, weak audit, and integration risk. ${vendor} is engaged to deliver an operable production service for ~${users.toLocaleString()} named users, not a slide-ware prototype.`,
      ],
    },
    {
      heading: "2. Stakeholders, personas, and organisation impact",
      body: "Stakeholders include the business sponsor, product owner, operations, information security, infrastructure, end-user representatives, auditors, and the vendor delivery lead.",
      table: {
        caption: "Persona catalogue",
        headers: ["Persona", "Goal", "Frustration today", "Success on day 30"],
        rows: [
          ["End user / applicant", "Complete a journey without coaching", "Opaque status, repeat visits", "Self-service status + confirmation id"],
          [`${client} officer`, "Clear queue, complete cases", "Spreadsheet inbox, missing docs", "Queue by SLA, full case file"],
          ["Administrator", "Manage users, reference data", "Tickets to vendor for every change", "Self-serve config within policy"],
          ["Auditor", "Reconstruct who did what", "Scattered logs", "Filterable audit export"],
          ["Integrator", "Stable APIs", "Undocumented interfaces", "OpenAPI + sandbox"],
        ],
      },
      paragraphs: [
        `SOPs around ${modules.slice(0, 3).join(", ")} will change. Communications, training, and super-user nomination are part of go-live — they are Client-owned with Supplier support. Shadow-running against the old process is recommended for one cycle where legally possible.`,
      ],
    },
    {
      heading: "3. Current vs future process",
      body: "The future process is the swimlane in this pack: the user submits, the system validates and persists, integrations fire, an officer decides when a human gate is required, the system notifies. Status is always in the product, never only in email.",
      diagramId: "process",
      paragraphs: [
        "As-is (typical): intake on paper or disconnected forms; status by phone; approvals in email; weak evidence of who changed what. To-be: one case file, one identity, timed SLAs, and an audit row on every privileged act.",
      ],
    },
    {
      heading: "4. Business requirements",
      body: "Requirements are capability-level. Product behaviour and UX rules are in the PRD. Each BR is testable and maps to at least one P0/P1 test case.",
      table: {
        caption: "BR register",
        headers: ["ID", "Statement", "Module", "Priority"],
        rows: [
          ...modules.map((m, i) => [
            `BR-${String(i + 1).padStart(2, "0")}`,
            `Authorised users shall create, progress, search, and export ${m} records with RBAC and a complete audit trail.`,
            m,
            "Must",
          ]),
          ["BR-ID", `Staff shall authenticate via ${client} IdP; public users via the agreed federation (e.g. UAE Pass) when in scope.`, "Identity", "Must"],
          ["BR-NTF", "Parties shall be notified of state changes they are entitled to see, without leaking data to the wrong recipient.", "Notifications", "Must"],
          ["BR-SLA", "Supervisors shall see ageing work against agreed service levels.", "Reporting", "Should"],
          ["BR-CMP", "The public and staff shall lodge, track, and close complaints through one case mechanism across channels, with ack/decision SLOs and segregation of duties.", "Complaints", "Must"],
          ["BR-RPT", "Operations shall consume certified warehouse KPIs (not OLTP ad-hoc) via Apache Superset and/or Power BI.", "BI", "Must"],
          ["BR-INT", "The product shall exchange data with named upstream/downstream systems using versioned APIs or agreed files.", "Integration", "Must"],
        ],
      },
    },
    {
      heading: "5. Non-functional business needs",
      body: constraints,
      bullets: [
        `Availability consistent with 99.9% production APIs during Client business plus agreed online windows.`,
        "Personal data handled under PDPL-aligned controls; residency follows the chosen deployment model.",
        "Bilingual-ready for public-facing surfaces; officer UI language pack as directed in discovery.",
        "The organisation must be able to evidence access decisions to internal audit without Supplier presence.",
      ],
    },
    {
      heading: "6. Dependencies, constraints, and success metrics",
      body: "Dependencies: IdP metadata, sample data, integration sandboxes, CAB windows, UAT users. Constraints as above.",
      table: {
        caption: "Success metrics (steering + go-live)",
        headers: ["Metric", "Target"],
        rows: [
          ["UAT pass of P0/P1", "≥ 95% before go-live"],
          ["Open sev-1 at go-live", "Zero"],
          ["Hypercare sev-1 ack", "≤ 15 minutes in coverage"],
          ["Named users provisioned", `≥ 80% of ~${users.toLocaleString()} in 30 days`],
          ["Restore drill", "Pass in the release train before go-live"],
        ],
      },
    },
  ];
}

export function buildPrd(
  product: string,
  client: string,
  brief: PlannerBrief,
  modules: string[],
  users: number
): DocSection[] {
  return [
    {
      heading: "1. What we are building",
      body: `${product} is how ${client} runs ${modules.join(", ")} — one login, one record, one place to see status. It sits ${brief.deployment === "on-premise" ? "in your datacenter" : brief.deployment === "hybrid" ? "split between cloud edge and your data" : "in GCC-region cloud"}.`,
      paragraphs: [
        "If a job has no screen and no API, it is not in the product. Wireframes in this pack are the screens we mean; Stitch/Figma is how your design team can take them further without starting from a blank page.",
        `First production cut: identity, audit, admin, ${modules.slice(0, Math.min(3, modules.length)).join(", ")}. Later slices add the rest. We will not quietly drop audit or RBAC to hit a date — that takes a change request.`,
      ],
    },
    {
      heading: "2. Personas and jobs-to-be-done",
      body: "Jobs drive IA and RBAC. If a job has no screen and no API, it is not in the product.",
      table: {
        caption: "JTBD",
        headers: ["Persona", "Job", "Acceptance sketch"],
        rows: [
          ["End user", "Submit and track", "Reference number + status timeline"],
          ["Officer", "Work a queue", "SLA colour, filters, complete case file"],
          ["Supervisor", "Unblock and reassign", "Reason captured; audit"],
          ["Admin", "Manage roles and reference data", "Change without a code release"],
          ["Auditor", "Export activity", "Filter by actor, object, time"],
        ],
      },
    },
    {
      heading: "3. Epics, features, and user stories",
      body: "Each module is an epic. Stories below are the baseline; discovery may split them but must not delete the audit or validation stories.",
      bullets: modules.flatMap((m) => [
        `${m} — list/search with saved filters; create; update; status workflow; document attach; export; API parity.`,
        `${m} — validation of mandatory fields (UI + API); conflict on concurrent edit; notification on terminal states.`,
        `${m} — unauthorised user sees 403, not an empty list that looks like “no data”.`,
      ]),
      table: {
        caption: "Example stories (first epic)",
        headers: ["ID", "Story", "Acceptance"],
        rows: [
          ["US-01", `As an officer I progress a ${modules[0]} record so that the next party is unblocked`, "Valid transition only; invalid is explained; audit written"],
          ["US-02", "As a user I see why my submit failed", "Field-level messages; API problem+json matches"],
          ["US-03", "As an auditor I reconstruct a change", "Before/after or field diff + actor + time"],
          ["US-04", `As ${client} admin I disable a user without deleting history`, "Login blocked; records remain"],
        ],
      },
    },
    {
      heading: "4. Interaction design rules",
      body: "These rules are testable and appear in the test pack. They exist so the UI does not become a pile of forms with inconsistent behaviour.",
      numbered: [
        "Primary action is visually dominant; destructive actions are secondary and require confirm + reason.",
        "Tables: empty state explains how to create the first record; loading uses skeleton or spinner, never a flash of “no data”.",
        "Errors cite the field and how to fix; 5xx is apologetic and offers a request-id for support.",
        "Bilingual: strings externalised; EN default; AR layout-safe (logical properties, sufficient line-height, no truncated CTA).",
        "Keyboard: core officer flows reachable without a mouse; focus order follows reading order.",
        `WCAG 2.1 AA target for new UI. Concurrent users of ~${Math.round(users * 0.1)} must not see corrupted rows (version checks).`,
      ],
      diagramId: "process",
    },
    {
      heading: "5. Cross-cutting product requirements",
      body: "RBAC on every screen and API. Notifications respect entitlement. Files: size/type limits, malware scan when available, virus-clean only then linked to the record.",
      paragraphs: [
        `Non-functional: interactive p95 < 2s on a UAE broadband path for list/detail at the modelled user count. Offline is out of scope unless added. Accessibility as above.`,
        "Feature flags may hide unfinished modules in production; they must not hide security controls.",
      ],
    },
    {
      heading: "6. Release slices and analytics",
      body: `Slice 1 (MVP production): identity federation, RBAC, audit, admin, ${modules.slice(0, Math.min(3, modules.length)).join(", ")}. Slice 2: remaining modules. Slice 3: extra integrations from workshops.`,
      paragraphs: [
        "We will count submit-to-complete, queue age, complaint ack/decision SLA, warehouse freshness, and licensed BI users. We will not dump names into a third-party analytics tool or query the OLTP primary from a dashboard.",
      ],
      diagramId: "cicd",
    },
    {
      heading: "7. Wireframes, Google Stitch and Figma",
      body: "Eight desktop boards live under Wireframes: sign-in, queue, list, create, detail, admin, empty vs 403, public track. Grayscale on purpose.",
      paragraphs: [
        "Figma: drag each SVG onto a 1440×900 frame, then rebuild as Auto Layout. Google Stitch (stitch.withgoogle.com): paste the prompt on the board, generate, Send to Figma. This planner does not log into your Figma.",
        `Create screen for ${modules[0] ?? "the first module"}: title, organisation, category required; description optional; PDF/JPG 10 MB; submit stays off until valid; draft is allowed; SOP list on the right. Return-with-reason on detail is required text, stored on audit, shown to the applicant.`,
        "Public track uses a reference only. Unknown and known refs should take about the same time. EN/AR; Arabic is RTL.",
      ],
      numbered: [
        "Sign-in: IdP and UAE Pass. No local password box.",
        "Queue: oldest due first. Overdue is a word, not only a colour.",
        "List vs 403: no access is not an empty table.",
        "Create: errors under the field. Submit sends Idempotency-Key.",
        "Detail: one URL. Approve is hidden if you cannot approve.",
      ],
    },
  ];
}

export function buildArchitectureViews(
  product: string,
  client: string,
  brief: PlannerBrief,
  modules: string[]
): ArchitectureView[] {
  const deploy = deployPhrase(brief.deployment);
  return [
    {
      id: "software",
      title: "Software architecture",
      diagramId: "software",
      summary:
        brief.architectureStyle === "monolith-3tier"
          ? `${product} is a 3-tier monolith. Presentation reverse-proxies to one application binary covering ${modules.join(", ")}. PostgreSQL is the system of record.`
          : `${product} is API-first. The SPA, admin UI, and partners call the same OpenAPI surface. Business rules sit in domain services for ${modules.join(", ")}, not in the browser.`,
      bullets:
        brief.architectureStyle === "monolith-3tier"
          ? [
              "Tiers: presentation (proxy/static), application (one deployable), data (PostgreSQL, Redis, objects).",
              "Capabilities are packages in the same process. Schema ownership still applies.",
              "OpenAPI 3 is frozen at architecture freeze. UI is a client of the application tier.",
              "Scale by adding application VMs. Do not introduce Kubernetes in this design without a CR.",
            ]
          : [
              "C4 containers: SPA, BFF, gateway, identity adapter, notification adapter, one service per capability, shared kernel, PostgreSQL, Redis, object store, bus.",
              "Bounded contexts match the capability map. Shared kernel is libraries plus identity/audit — not one database for every module.",
              "OpenAPI 3 is frozen at architecture freeze. UI is a client, not a second business layer.",
              "East–west uses service identity. User JWTs are not reused as hop tokens without an audience restriction.",
            ],
      table: {
        caption: "Software building blocks",
        headers: ["Block", "Owns", "Does not own"],
        rows: [
          ["Web / admin SPA", "Presentation, client validation", "Durable business rules"],
          ["API gateway", "TLS termination at edge, JWT, rate limit", "Domain invariants"],
          ...modules.slice(0, 4).map((m) => [m, "Its aggregates and APIs", "Sibling tables"]),
          ["Shared kernel", "Audit, RBAC helpers, tracing", "Product workflows"],
        ],
      },
    },
    {
      id: "network",
      title: "Network architecture",
      diagramId: "network",
      summary: `Runtime is ${deploy}. Users never reach the database network. Dev, UAT, and production are isolated clusters or namespaces with separate IdP apps.`,
      bullets: [
        "North–south: DNS/CDN → WAF → load balancer → API gateway in a private app network.",
        "Data network: inbound only from the app network. No public IP on PostgreSQL, Redis, or the bus.",
        "East–west default-deny. Egress via NAT with pinned IPs. Admin via bastion or PAM only.",
        "Backup and management traffic is off the user path. Certificates are inventoried with expiry alerts.",
      ],
      table: {
        caption: "Network zones",
        headers: ["Zone", "What lives here", "Who may enter"],
        rows:
          brief.deployment === "on-premise"
            ? [
                ["Untrust / DMZ", "VIP, WAF, reverse proxy", "Internet and partner WAN"],
                ["App VLAN", "Gateway, services, mesh", "DMZ only, default-deny"],
                ["Data VLAN", "PostgreSQL, Redis, bus", "App VLAN only"],
                ["Backup / mgmt", "Backup target, vault, OOB", "Jump/PAM, not users"],
              ]
            : [
                ["Internet / edge", "DNS, CDN, WAF, public LB", "Users and partners"],
                ["Public subnet", "NAT, bastion if required", "Controlled ingress only"],
                ["Private app subnet", "Gateway, services, BFF", "Edge, no inbound to data"],
                ["Data subnet", "PostgreSQL, Redis, bus, objects", "App subnet only"],
              ],
      },
    },
    {
      id: "security",
      title: "Security architecture",
      diagramId: "security-arch",
      summary: `${product} federates staff login to ${client}’s IdP. No staff passwords are stored in the product. Controls follow ISO 27001 practice and UAE PDPL for personal data.`,
      bullets: [
        "Zero trust: a network zone is not an authorisation decision. RBAC + optional ABAC + segregation of duties in the service.",
        "Vault holds secrets, keys, and certificates. Break-glass is named and time-bounded.",
        "TLS 1.2+ in transit; disk and backup encryption at rest. Append-only audit on privileged change.",
        "SAST, SCA, and VA/PT are gates. 403 is not an empty list. 72-hour PDPL incident path.",
      ],
      table: {
        caption: "Security control plane",
        headers: ["Layer", "Control", "Evidence"],
        rows: [
          ["People / IdP", `OIDC/SAML / UAE Pass for ${client}`, "IdP logs, no local passwords"],
          ["Edge", "WAF, TLS, bot/geo, DDoS posture", "WAF policy + scan"],
          ["Gateway", "JWT validate, rate limit, request-id", "Gateway config"],
          ["Service", "RBAC/ABAC/SoD, mTLS", "RBAC matrix + tests"],
          ["Data", "Encryption, classification, audit", "TDE + audit export"],
        ],
      },
    },
    {
      id: "database",
      title: "Database architecture",
      diagramId: "database",
      summary: "PostgreSQL is the system of record. Redis is cache only. Files live in object storage with the key and checksum in the database. Contexts do not share tables as an API.",
      bullets: [
        "Primary + sync/semi-sync replica for failover; read replica for reporting only — never a second writer.",
        "One schema (or owned set) per capability. Cross-context links are identifiers, not shared joins.",
        "Outbox row committed in the same transaction as the aggregate. Consumers are idempotent.",
        "PITR, RPO ≤ 15 minutes, legal hold + soft delete, restore drill each release train.",
      ],
      table: {
        caption: "Data stores",
        headers: ["Store", "Role", "Rule"],
        rows: [
          ["PostgreSQL primary", "System of record", "One writer per aggregate"],
          ["Sync / semi-sync replica", "Failover", "Promote on runbook, not guesswork"],
          ["Read replica", "Reporting", "No application writes"],
          ["Redis", "TTL cache", "Loss must not lose committed data"],
          ["Object store", "Files / evidence", "DB holds key + hash, not the blob"],
          ["Warehouse", "Analytics SoR (derived)", "Loaded from replica/CDC only"],
        ],
      },
    },
    {
      id: "reporting",
      title: "Reporting architecture",
      diagramId: "reporting",
      summary: `${product} reports from a warehouse fed by the OLTP replica (CDC/ETL + dbt). The PostgreSQL writer is not a BI source. Complaint and operational facts are first-class marts.`,
      bullets: [
        "Primary → replica → CDC/ETL → star schema → columnar warehouse. Quality gates on freshness and row counts.",
        "KPI dictionary: name, grain, owner, warehouse source. No unnamed dashboard measures in production.",
        "Read replica is not a second writer. SQL Lab against OLTP in production is out of architecture.",
        "Failed loads page engineering and keep last-good with a freshness banner — they do not query the primary as fallback.",
      ],
      table: {
        caption: "Reporting pipeline",
        headers: ["Stage", "Lives on", "Rule"],
        rows: [
          ["OLTP replica", "Data tier", "CDC source only"],
          ["ETL / dbt", "Workers / pods", "Idempotent models"],
          ["Warehouse", "Dedicated VMs/pods", "Columnar; AZ replica"],
          ["KPI dictionary", "Metadata + git", "Versioned with the model"],
        ],
      },
    },
    {
      id: "bi",
      title: "BI architecture",
      diagramId: "bi",
      summary: `Apache Superset (self-hosted) and Microsoft Power BI (SaaS + on-premises gateway) consume the same certified warehouse for ${client}. They do not own cases.`,
      bullets: [
        "Superset: web, workers, metadata DB, dedicated Redis. Power BI: Premium/Fabric capacity + gateway cluster (Windows, outbound 443).",
        "RLS and IdP (OIDC / Entra) in the dataset. Published apps/datasets are production; personal files are not.",
        "One semantic layer if both tools are on so measures do not diverge.",
        "The cost estimator sizes this stack when the reporting checkboxes are ticked; Delivery planner remains a separate tab for the design pack.",
      ],
      table: {
        caption: "BI consumers",
        headers: ["Tool", "Runtime", "Must not"],
        rows: [
          ["Apache Superset", "Cluster or BI VMs", "Query OLTP primary"],
          ["Power BI Service", "SaaS + gateway VMs", "Open inbound ports to the warehouse"],
          ["KPI pack", "Certified datasets", "Live as unowned Excel"],
        ],
      },
    },
    {
      id: "complaints",
      title: "Complaints handling architecture",
      diagramId: "complaints",
      summary: `Every channel (portal, phone/email, walk-in, partner, anonymous token) becomes one complaint_record. SLA clocks, segregation of duties, audit, and warehouse facts are the mechanism — not a mailbox.`,
      bullets: [
        "Intake API with idempotency. Attachments in object storage. One public tracking id.",
        "Ack and decision SLOs are product clocks with escalation. Reopen is an event on the same case.",
        "Submitter cannot final-decide the same case. Contact centre keys walk-in/phone; it does not keep a second register.",
        "Notify and search follow the transactional outbox. Dashboards read warehouse facts, not the officer’s inbox.",
      ],
      table: {
        caption: "Complaints control points",
        headers: ["Step", "System behaviour", "Control"],
        rows: [
          ["Lodge", "POST /api/v1/complaints", "Idempotency-Key, classify"],
          ["Ack", "Clock + outbox notify", "SLO page on breach"],
          ["Decide", "POST …/decision", "SoD vs submitter"],
          ["Close / reopen", "complaint_event", "Same case id; warehouse fact"],
        ],
      },
    },
  ];
}
