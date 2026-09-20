import type { DocSection, PlannerBrief } from "./types";
import { deployPhrase } from "./content";

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
}

export function sowSchedules(
  product: string,
  client: string,
  vendor: string,
  brief: PlannerBrief,
  modules: string[],
  months: number,
  users: number
): DocSection[] {
  const start = brief.startDate || "TBC";
  return [
    {
      heading: "11. Period of performance and payment",
      body: `Period of performance: ${start} plus ${months} calendar months, excluding Client-caused delay (§5). This SOW is issued under the parties’ MSA if one exists; if not, the MSA terms in the bid cover take precedence over this SOW on law and liability, and this SOW takes precedence on scope and acceptance.`,
      paragraphs: [
        "Fees follow the BOQ / commercial offer. The split below is the default unless the offer says otherwise. An invoice is due only after the gate artefacts exist and the PO has accepted or the review window has closed (deemed acceptance, §8).",
        "Expenses (travel onshore) billed at cost with prior written approval. No success fee. No unlimited LDs in this SOW.",
      ],
      table: {
        caption: "Payment against gates (planning % of implementation fee)",
        headers: ["Gate", "%", "Trigger", "Holdback"],
        rows: [
          ["Kickoff / M0 pack", "10%", "PO named, RAID opened, environment request lodged", "None"],
          ["M1 architecture freeze", "15%", "HLD, LLD, wireframes, RBAC matrix accepted", "None"],
          ["Build increments (even splits)", "40%", "Each module slice demoed; P0/P1 of that slice pass or waived", "10% of this line until SIT"],
          ["UAT complete", "20%", "UAT sign-off or written waiver of remaining P1", "None"],
          ["Go-live + hypercare report", "15%", "Production release + 30-day report", "None"],
        ],
      },
    },
    {
      heading: "12. Review window and deemed acceptance",
      body: `${client} has five working days (GST) from submission of a deliverable to accept, reject with written defects, or request a round of comments. Two comment rounds are included per deliverable. Silence after five working days is deemed acceptance of that deliverable. Rejection must cite the requirement ID or test ID. Preference is not a defect.`,
      paragraphs: [
        "Software: accepted when mapped Must/P0 tests pass or are waived, Sev-1 = 0, Sev-2 has a dated fix-forward, OpenAPI for that slice is in the repo, and the PO records accept in email or the ticket tool.",
        "Documents: accepted when comments of substance are closed or parked as change requests. Typographical comments do not stop the clock.",
      ],
    },
    {
      heading: "13. Environments, access, and data",
      body: `Three environments minimum. Production data does not copy to dev. UAT may use masked production extracts if ${client} provides them.`,
      table: {
        caption: "Environment matrix",
        headers: ["Env", "Purpose", "Data", "Who can change", "Refresh"],
        rows: [
          ["dev", "Daily build", "Synthetic", vendor, "Continuous"],
          ["test / UAT", "SIT and UAT", "Masked or seeded", `${vendor} + ${client} testers`, "On slice drop"],
          ["prod", "Live", "Live; classified per HLD", `${client} CAB; ${vendor} with ticket`, "N/A"],
          [brief.deployment === "cloud" ? "DR region" : "DR site", "Failover", "Replica", `${client} + ${vendor} on drill`, "As HLD RPO"],
        ],
      },
      paragraphs: [
        `${client} supplies IdP metadata, VPN/jump, and firewall changes within ten working days of the environment request. ${vendor} does not hold standing production admin after hypercare unless a support SOW says so.`,
        `Named-user sizing ${users.toLocaleString()}. Peak concurrent for tests: 10% unless discovery measures otherwise.`,
      ],
    },
    {
      heading: "14. Integration register (in-scope systems)",
      body: "Only rows marked Must in this register are in this SOW. Anything else is a CR. Pattern and auth freeze at M1.",
      table: {
        caption: "INT — external systems",
        headers: ["ID", "System", "Dir", "Pattern", "Auth", "Must?", "Owner"],
        rows: [
          ["INT-01", `${client} IdP / UAE Pass`, "In", "OIDC (SAML if mandated)", "Federation", "Must", `${client} IAM`],
          ["INT-02", "SMTP / SMS gateway", "Out", "API or SMTP", "Credential in vault", "Must", `${client} comms`],
          ["INT-03", "Object / file store", "Both", "S3-compatible or NAS", "mTLS or IAM role", "Must", `${vendor}`],
          ...modules.slice(0, 4).map((m, i) => [
            `INT-${String(i + 4).padStart(2, "0")}`,
            `${m} upstream/downstream (named at workshop)`,
            "Both",
            "REST or file drop",
            "Client credentials",
            i === 0 ? "Must" : "Should",
            `${client} + ${vendor}`,
          ]),
        ],
      },
    },
    {
      heading: "15. IP, confidentiality, personal data",
      body: `Foreground IP in ${product} configuration and custom code built under this SOW vests in ${client} on payment of the related invoice. ${vendor} keeps background tools, libraries, and methods. Third-party licences stay with their owners. ${client} must have rights to any data it supplies.`,
      paragraphs: [
        "Personal data: processed only to deliver this SOW, on the residency in the HLD, deleted from Supplier laptops at hypercare end except what the MSA requires for disputes.",
        "Classification of this file: Confidential — Client and Supplier project team. Not for public RFP portals without redaction of prices.",
      ],
    },
    {
      heading: "16. Glossary",
      body: "Terms used with a fixed meaning in this SOW and the design pack.",
      table: {
        caption: "Glossary",
        headers: ["Term", "Meaning here"],
        rows: [
          ["PO", `${client} product owner who can accept increments`],
          ["P0 / P1", "Test priority. P0 blocks go-live. P1 should pass or have a written waiver"],
          ["Outbox", "DB table written in the same commit as the business row, then published to the bus"],
          ["Sev-1", "Service down, data loss, or active security incident"],
          ["CR", "Change request under §9"],
          ["IdP", "Identity provider. Staff passwords are not stored in " + product],
        ],
      },
    },
    {
      heading: "17. Document control and sign-off",
      body: `Title: Statement of Work — ${product}. Owner: ${vendor} delivery lead. Approver: ${client} PO. Version: 0.9 planning. Status: draft until both signs below.`,
      table: {
        caption: "Sign-off",
        headers: ["Role", "Name", "Date", "Signature"],
        rows: [
          [`${vendor} delivery lead`, "", "", ""],
          [`${client} product owner`, "", "", ""],
          [`${client} procurement (if required)`, "", "", ""],
        ],
      },
    },
    {
      heading: "18. Effort estimate and man-hour costing",
      body: `Professional services are estimated in the Effort Excel: role rate card (AED/hour and AED/man-day), FTE by phase, hours, man-days, and cost. A 10% management reserve sits on top of productive hours at 80% utilisation. Hardware, licences, and cloud run-rate remain on the BOQ — they are not in the man-hour total. ${vendor} will not treat that workbook as a PO until Schedule 1 / the Order Form incorporates named rates.`,
      paragraphs: [
        `Calendar for this SOW is ${months} months (~${users.toLocaleString()} named users; modules ${modules.join(", ")}). Discovery and architecture are time-boxed; build effort scales with the capability list.`,
        "Change control consumes reserve first. Additional man-hours after reserve are a CR.",
      ],
    },
  ];
}

export function hldSchedules(
  product: string,
  client: string,
  vendor: string,
  brief: PlannerBrief,
  modules: string[],
  users: number,
  constraints: string
): DocSection[] {
  return [
    {
      heading: "11. Stakeholders (arc42 §1.3)",
      body: "Who cares about this design and what they need from it.",
      table: {
        caption: "Stakeholders",
        headers: ["Role", "Interest", "What they read"],
        rows: [
          [`${client} PO`, "Scope and dates", "SOW, BRD, Gantt"],
          [`${client} security`, "IdP, zones, audit, PDPL", "HLD §§5,7,9; LLD security"],
          [`${client} infrastructure`, "Racks or cloud accounts, DNS, backup", "HLD deployment, BOQ"],
          [`${vendor} engineering`, "Build without guessing", "LLD, OpenAPI, wireframes"],
          ["Operations after hypercare", "Runbooks, SLOs", "HLD §10, as-built"],
        ],
      },
    },
    {
      heading: "12. Constraints register (arc42 §2)",
      body: constraints,
      table: {
        caption: "CON",
        headers: ["ID", "Type", "Constraint", "Impact if ignored"],
        rows: [
          ["CON-01", "Legal", "UAE PDPL for personal data; residency as deployment model", "Unlawful processing"],
          ["CON-02", "Identity", `${client} IdP is source of staff accounts`, "Shadow passwords, audit gap"],
          ["CON-03", "Ops", "No standing prod admin for vendor after hypercare", "Support SOW needed"],
          ["CON-04", "Scale", `Design load ${Math.round(users * 0.1)} concurrent (10% of ${users.toLocaleString()} named)`, "Wrong hardware / HPA"],
          ["CON-05", "Deploy", deployPhrase(brief.deployment), "Wrong BOM"],
        ],
      },
    },
    {
      heading: "13. Architecture decisions (ADR)",
      body: "Status: accepted for planning. Change only with an ADR and PO copy.",
      table: {
        caption: "ADR",
        headers: ["ID", "Decision", "Why", "Consequence"],
        rows: [
          ["ADR-01", "HTTPS JSON APIs, OpenAPI 3", "One contract for UI and partners", "BFF allowed; no second business layer in the SPA"],
          ["ADR-02", "PostgreSQL is system of record", "Transactions, PITR, known ops", "No multi-writer on the same aggregate"],
          ["ADR-03", "Transactional outbox", "Avoid dual-write to DB and bus", "Consumers must be idempotent"],
          ["ADR-04", "Redis is cache only", "Survive Redis loss", "Sessions re-auth; JWT still valid"],
          ["ADR-05", brief.architectureStyle === "monolith-3tier" ? (brief.deployment === "cloud" ? "3-tier IaaS / App Service multi-AZ" : "HA 3-tier on Client hypervisor") : brief.deployment === "cloud" ? "Managed K8s multi-AZ" : "HA on Client hypervisor", "Match CON-05", "See network architecture"],
        ],
      },
    },
    {
      heading: "14. System context — people and systems (C4 L1)",
      body: `${product} is the box in the middle. People and systems outside the box are not ours to rewrite.`,
      table: {
        caption: "Context",
        headers: ["Actor / system", "Relates how", "Protocol"],
        rows: [
          [`${client} officer`, "Uses web UI", "HTTPS"],
          ["Applicant (if public)", "Track status / submit", "HTTPS"],
          [`${client} IdP`, "Authenticates staff", "OIDC/SAML"],
          ["UAE Pass", "Authenticates public if in scope", "OIDC"],
          ["Mail/SMS", "Outbound notice", "Provider API"],
          ...modules.slice(0, 3).map((m) => [`Legacy/${m} peer`, "Data in or out", "REST or file"]),
        ],
      },
    },
    {
      heading: "15. Building blocks mapped to runtime (arc42 §5/7)",
      body: "What runs where. Detail of SKUs is in the BOQ.",
      table: {
        caption: "Map",
        headers: ["Block", "Runs on", "State", "Scale"],
        rows: [
          ["SPA / BFF", "App nodes / pods", "None", "HPA on RPS"],
          ["API gateway", "Edge pair / ingress", "Config", "HA pair"],
          ...modules.slice(0, 5).map((m) => [`${m} service`, "App pool", "None (DB holds it)", "HPA"]),
          ["PostgreSQL", "Data VLAN or managed instance", "SoR", "Primary + replica"],
          ["Redis", "Data VLAN", "Ephemeral", "Sentinel/cluster"],
          ["Bus", "Data VLAN", "Queues", "HA"],
        ],
      },
    },
    {
      heading: "16. Risks and technical debt we already see",
      body: "Logged into RAID at kickoff. Residual after mitigation.",
      table: {
        caption: "RSK",
        headers: ["ID", "Risk", "Mitigation", "Residual"],
        rows: [
          ["RSK-01", "IdP metadata late", "Ten-day clock in SOW §5; mock IdP in dev", "Medium"],
          ["RSK-02", "Legacy mapping incomplete", "INT register freeze at M1; adapter per system", "Medium"],
          ["RSK-03", "UAT users unavailable", "Named UAT roster in M0", "High if ignored"],
          ["RSK-04", "Pen-test findings in week −2", "Scan in CI from sprint 1; PT scoped at M1", "Low"],
        ],
      },
    },
    {
      heading: "17. Glossary",
      body: "Same meanings as the SOW glossary, plus:",
      table: {
        caption: "Extra terms",
        headers: ["Term", "Meaning"],
        rows: [
          ["C4 L1", "Context: people and systems around " + product],
          ["ADR", "Architecture decision record"],
          ["RPO / RTO", "Minutes of data we can lose / hours to be back after a declared disaster"],
          ["ABAC", "Attribute check on top of role (org unit, classification)"],
        ],
      },
    },
  ];
}

export function lldSchedules(product: string, client: string, modules: string[]): DocSection[] {
  const core = modules[0] ?? "Record";
  const st = slug(core);
  return [
    {
      heading: "11. HTTP and problem+json",
      body: "Clients must key off `type` and status, not English `title`. No stack traces. Always `X-Request-Id`.",
      table: {
        caption: "Status used by " + product,
        headers: ["HTTP", "When", "Client action"],
        rows: [
          ["200 / 201", "Read OK / create OK", "Show body; keep id"],
          ["400", "Schema or field rule failed", "Map to field errors"],
          ["401", "No/expired token", "Re-auth"],
          ["403", "Token valid, not allowed", "Forbidden page — not empty list"],
          ["404", "Unknown id in this tenant", "Same timing as 403 for public track"],
          ["409", "Version conflict or duplicate idempotency", "Reload or open existing ref"],
          ["413", "Body too large", "Shrink upload"],
          ["429", "Rate limit", "Backoff"],
          ["5xx", "Our fault", "Show request id; retry safe GETs only"],
        ],
      },
    },
    {
      heading: `12. State machine — ${core}`,
      body: "Illegal transitions return 409 with the allowed next states. UI hides buttons the API would reject.",
      table: {
        caption: `${core} status`,
        headers: ["From", "To", "Who", "Audit?"],
        rows: [
          ["(new)", "draft", "Creator", "Yes"],
          ["draft", "submitted", "Creator", "Yes"],
          ["submitted", "in_review", "System or officer", "Yes"],
          ["in_review", "returned", "Officer with reason", "Yes + reason"],
          ["returned", "submitted", "Creator", "Yes"],
          ["in_review", "approved", "Approver role", "Yes"],
          ["in_review", "rejected", "Approver + reason", "Yes"],
          ["any except legal_hold", "cancelled", "Admin + reason", "Yes"],
        ],
      },
    },
    {
      heading: "13. Log and audit fields",
      body: "Application log is JSON. Audit table is append-only. Do not log full PAN, Emirates ID, or access tokens.",
      table: {
        caption: "Minimum fields",
        headers: ["Field", "Log", "Audit row"],
        rows: [
          ["timestamp", "ISO-8601 UTC", "timestamptz"],
          ["request_id", "Yes", "Yes"],
          ["subject", "IdP sub", "IdP sub"],
          ["action", "method+path", "domain action"],
          ["entity_id", "If any", "Yes"],
          ["version", "If write", "Yes"],
          ["reason", "No", "If return/reject/cancel"],
        ],
      },
    },
    {
      heading: "14. Config and secrets inventory",
      body: `Nothing in git. Names below are the keys ops will ask for on day 1. Product: ${product}. Client IdP: ${client}.`,
      table: {
        caption: "Secrets (vault)",
        headers: ["Key", "Used by", "Rotate"],
        rows: [
          ["OIDC_CLIENT_SECRET", "Gateway / BFF", "90 days or on incident"],
          ["DB_URL", "Services", "On staff change"],
          ["REDIS_URL", "Services", "On staff change"],
          ["BUS_URL", "Publisher / consumers", "On staff change"],
          ["SMTP_OR_SMS", "Notifier", "90 days"],
          ["OBJECT_STORE", "Files", "Yearly keys"],
        ],
      },
    },
    {
      heading: "15. Test data rules",
      body: `UAT data is Client-owned. Dev uses fixtures tagged ${st}-* so they can be wiped. Never copy production PII to dev.`,
      bullets: [
        "One happy-path fixture per Must status transition.",
        "One user per role: officer, approver, admin, auditor, forbidden.",
        "Idempotency tests reuse the same key twice.",
        "Public track: one real ref and one random ref; timing should match.",
      ],
    },
  ];
}

export function brdSchedules(
  product: string,
  client: string,
  vendor: string,
  modules: string[],
  users: number,
  constraints: string
): DocSection[] {
  const rows: string[][] = [];
  modules.forEach((m, i) => {
    const n = String(i + 1).padStart(2, "0");
    rows.push([
      `BR-${n}a`,
      "Must",
      `Authorised staff create, update, search and export ${m} records.`,
      "Workshop / RFP",
      `UAT: officer completes create→submit on ${m} with a ref issued`,
    ]);
    rows.push([
      `BR-${n}b`,
      "Must",
      `Every privileged change to ${m} is attributable (who, when, what).`,
      "Audit / PDPL",
      "Auditor exports a row for a known change within 365 days",
    ]);
    rows.push([
      `BR-${n}c`,
      i < 2 ? "Must" : "Should",
      `${m} notifies entitled parties on terminal states.`,
      "Ops SOP",
      "Mail/SMS or in-app notice received; wrong recipient gets nothing",
    ]);
  });
  rows.push(
    ["BR-ID", "Must", `Staff authenticate at ${client} IdP. No local staff password.`, "IAM", "Login without IdP fails; no password field on staff sign-in"],
    ["BR-403", "Must", "No access is 403, not an empty list.", "Security", "Forbidden role cannot scrape existence via empty tables"],
    ["BR-PUB", "Should", "Applicant can track by reference only.", "Public SOP", "Unknown ref does not leak whether the number exists by timing"],
    ["BR-MIG", "Could", "Open items from legacy migrate via template.", "Data owner", "Reconcile counts signed by data owner"],
    ["BR-AN", "Won't", "Full data warehouse / self-serve BI in this release.", "Scope", "n/a — CR later"]
  );
  return [
    {
      heading: "7. MoSCoW register",
      body: "Must = go-live. Should = same release if time. Could = if spare. Won't = not this SOW. IDs are stable; do not reuse.",
      table: {
        caption: "BR register — ID, priority, statement, source, acceptance",
        headers: ["ID", "MoSCoW", "Statement", "Source", "Acceptance (testable)"],
        rows,
      },
    },
    {
      heading: "8. Non-functional requirements (measurable)",
      body: constraints,
      table: {
        caption: "NFR",
        headers: ["ID", "Need", "Measure", "Where"],
        rows: [
          ["NFR-AV", "99.9% prod API monthly", "Synthetic + gateway metrics, exclude agreed window", "Ops dashboard"],
          ["NFR-P95", "p95 list/detail < 2s UAE broadband", `k6/JMeter 15 min, ~${Math.round(users * 0.1)} concurrent (10% of ${users.toLocaleString()} named)`, "Perf env"],
          ["NFR-RPO", "≤ 15 min data loss", "WAL + backup age alert", "Restore drill"],
          ["NFR-RTO", "≤ 4 h after disaster declared", "Timed drill", "DR runbook"],
          ["NFR-A11Y", "WCAG 2.1 AA on new UI", "Spot check + axe on wireframe flows", "UAT"],
          ["NFR-PDPL", "PII minimised, encrypted, residency as HLD", "Data inventory + config review", "Security"],
        ],
      },
    },
    {
      heading: "9. Data and migration",
      body: `In-scope: reference data and open ${modules[0] ?? "records"} at cutover. Out of scope: unbounded history cleanse.`,
      numbered: [
        `${client} names a data owner.`,
        `${vendor} issues templates (CSV/API). Rejects come back with row numbers.`,
        "Cutover reconcile: counts in = counts out ± agreed exceptions, signed.",
        "Rollback: keep legacy read-only for an agreed overlap (default 10 working days).",
      ],
    },
    {
      heading: "10. Business risks",
      body: `If UAT staff are not named in M0, go-live date is fiction. ${vendor} cannot sign UAT.`,
      table: {
        caption: "Business RAID (extract)",
        headers: ["ID", "Item", "Owner", "Due"],
        rows: [
          ["D-UAT", "Named UAT officers per persona", `${client} PO`, "M0+10d"],
          ["D-IDP", "IdP metadata and test users", `${client} IAM`, "M0+10d"],
          ["A-SOP", "SOPs match the state machine in LLD", `${client} ops`, "Before UAT"],
          ["R-LEG", "Legacy field meanings undocumented", `${client} data`, "M1"],
        ],
      },
    },
    {
      heading: "11. Sign-off",
      body: `BRD for ${product}. Must items in §7 are the acceptance set for UAT of this release. Version 0.9 draft.`,
      table: {
        caption: "Approvers",
        headers: ["Role", "Name", "Date"],
        rows: [
          [`${client} sponsor / PO`, "", ""],
          [`${client} information security (NFR-PDPL, BR-ID)`, "", ""],
          [`${vendor} BA / delivery`, "", ""],
        ],
      },
    },
  ];
}

export function prdSchedules(product: string, client: string, modules: string[], users: number): DocSection[] {
  const core = modules[0] ?? "Record";
  return [
    {
      heading: `8. Screen–field matrix (create ${core})`,
      body: `Fields the ${product} create wireframe must implement. API names match LLD. * = required to submit (draft may omit).`,
      table: {
        caption: `${core} create`,
        headers: ["Field", "UI", "API", "Rules"],
        rows: [
          ["title", "text 120", "title", "* 3–120 chars"],
          ["organisation", "typeahead", "org_id", "* must exist"],
          ["category", "select", "category", "* from admin list"],
          ["description", "textarea 4000", "description", "optional"],
          ["attachments", "multi file", "files[]", "PDF/JPG, 10 MB, scanned if scanner exists"],
          ["status", "system", "status", "draft on save; submitted on submit"],
        ],
      },
    },
    {
      heading: "9. Edge cases (product)",
      body: "If it is not listed, engineers still must not guess a silent success.",
      numbered: [
        "Double-click Submit: one record (Idempotency-Key).",
        "Two officers, one record: 409, show who saved.",
        "Session expires on Submit: keep draft if it existed; do not claim success.",
        "Attachment virus: reject file, keep the rest of the draft.",
        "Approver is also creator: hide Approve if SoD says so.",
        `Public track: ${Math.round(users * 0.1)} lookups/min/IP then 429.`,
      ],
    },
    {
      heading: "10. Product metrics (this release)",
      body: "Guardrails: we do not slow officers to collect vanity numbers.",
      table: {
        caption: "KPI",
        headers: ["Metric", "Target (90 days after go-live)", "Source"],
        rows: [
          ["Time submit → first officer open", "Median < 1 business day", "Timestamps"],
          ["UAT P0 pass", "100% or waived", "Test pack"],
          ["Sev-1 in hypercare", "Trend down week-over-week", "Incident log"],
          ["Empty vs 403 confusion tickets", "Zero repeats after fix", "Service desk"],
        ],
      },
    },
    {
      heading: "11. Open questions (parking lot)",
      body: `Close in discovery or convert to CR. ${client} PO owns the answer date.`,
      table: {
        caption: "Q",
        headers: ["ID", "Question", "Default if unanswered"],
        rows: [
          ["Q-01", "Is UAE Pass in MVP or slice 2?", "Staff IdP only in MVP"],
          ["Q-02", "Arabic copy: Client linguist or vendor?", "Client linguist; we externalise strings"],
          ["Q-03", "Legacy history depth to migrate?", "Open items only"],
          ["Q-04", "24×7 hypercare?", "Business hours GST unless CR"],
        ],
      },
    },
  ];
}
