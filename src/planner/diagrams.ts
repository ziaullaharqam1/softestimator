import type { ArchitectureStyle } from "../architecture";
import type { Diagram, PlannerBrief } from "./types";

export function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function frame(w: number, h: number, title: string, inner: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#0b1020"/>
  <text x="28" y="28" fill="#3dd6c6" font-size="13" font-family="IBM Plex Sans, sans-serif" font-weight="600">${esc(title)}</text>
  ${inner}
</svg>`;
}

function box(x: number, y: number, w: number, h: number, t1: string, t2: string, fill = "#1e3a5f") {
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="#3dd6c6" stroke-width="1.2"/>
    <text x="${x + 10}" y="${y + 22}" fill="#e8eefc" font-size="12" font-weight="600" font-family="IBM Plex Sans, sans-serif">${esc(t1)}</text>
    <text x="${x + 10}" y="${y + 40}" fill="#9aa8c7" font-size="11" font-family="IBM Plex Sans, sans-serif">${esc(t2)}</text>
  </g>`;
}

function arrow(x1: number, y1: number, x2: number, y2: number, label = "") {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return `<g>
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#f0b429" stroke-width="1.6" marker-end="url(#ah)"/>
    ${label ? `<text x="${mx + 6}" y="${my - 6}" fill="#f0b429" font-size="10" font-family="IBM Plex Sans, sans-serif">${esc(label)}</text>` : ""}
  </g>`;
}

const marker = `<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#f0b429"/></marker></defs>`;

export function buildDiagrams(product: string, modules: string[], deployment: PlannerBrief["deployment"], client: string, architectureStyle: ArchitectureStyle = "microservices"): Diagram[] {
  const mods = modules.slice(0, 6);
  const core = mods[0] ?? "Core";
  const second = mods[1] ?? "Admin";
  const micro = architectureStyle !== "monolith-3tier";

  const logicalW = 1180;
  const logicalH = 660;
  const layerY = [40, 150, 280, 430, 550];
  const domainW = Math.min(180, Math.floor(1080 / Math.max(mods.length, 1)) - 10);
  const domainBoxes = micro
    ? mods.map((m, i) => box(48 + i * (domainW + 10), layerY[2], domainW, 88, m, "Domain service")).join("")
    : box(48, layerY[2], 1084, 88, "Application tier (monolith)", mods.join(" · ") || "Packages in one binary");
  const plat =
    deployment === "on-premise"
      ? micro
        ? "On-prem K8s/VMs · dual ToR · backup VLAN · vault"
        : "On-prem 3-tier VMs · dual ToR · backup VLAN · vault"
      : deployment === "hybrid"
        ? "Cloud control plane · on-prem data plane · encrypted overlay"
        : micro
          ? "Managed K8s multi-AZ · private subnets · IaC"
          : "App + web + DB VMs · private subnets · IaC";
  const logicalInner = `${marker}
    <rect x="32" y="${layerY[0] - 16}" width="1116" height="96" rx="14" fill="#16324a" opacity="0.55"/>
    <rect x="32" y="${layerY[1] - 16}" width="1116" height="110" rx="14" fill="#1a3a42" opacity="0.55"/>
    <rect x="32" y="${layerY[2] - 16}" width="1116" height="122" rx="14" fill="#1b3348" opacity="0.55"/>
    <rect x="32" y="${layerY[3] - 16}" width="1116" height="100" rx="14" fill="#182e44" opacity="0.55"/>
    <rect x="32" y="${layerY[4] - 16}" width="1116" height="92" rx="14" fill="#152536" opacity="0.55"/>
    ${box(70, layerY[0], 300, 64, "Web portal", "Staff + public browsers")}
    ${box(430, layerY[0], 300, 64, "Mobile", "iOS / Android (optional)")}
    ${box(790, layerY[0], 300, 64, "Partner / B2B", "mTLS client credentials")}
    ${box(70, layerY[1], 300, 72, "WAF / CDN", "TLS 1.2+, bot, DDoS, geo")}
    ${box(430, layerY[1], 300, 72, micro ? "API gateway" : "Reverse proxy", micro ? "OIDC JWT, rate limit, WAF headers" : "TLS, reverse-proxy to app tier")}
    ${box(790, layerY[1], 300, 72, `${client} IdP`, "OIDC / SAML federation")}
    ${domainBoxes}
    ${box(48, layerY[3], 250, 70, "PostgreSQL HA", "SoR + PITR + replica")}
    ${box(324, layerY[3], 250, 70, "Redis", "cache, session, limits")}
    ${box(600, layerY[3], 250, 70, "Message bus", "commands + domain events")}
    ${box(876, layerY[3], 250, 70, "Object store", "files, evidence, backups")}
    ${box(48, layerY[4], 1100, 70, `Platform — ${product}`, plat)}
    ${arrow(220, 104, 220, 150, "HTTPS")}
    ${arrow(580, 104, 580, 150)}
    ${arrow(580, 222, 580, 280, "JWT")}
  `;

  const seqW = 1180;
  const seqH = 520;
  const cols = [
    { x: 50, n: "User" },
    { x: 250, n: "Portal" },
    { x: 450, n: "Gateway" },
    { x: 650, n: `${core} svc` },
    { x: 850, n: "PostgreSQL" },
    { x: 1030, n: "Bus" },
  ];
  const lifelines = cols
    .map(
      (c) =>
        `<text x="${c.x}" y="56" fill="#e8eefc" font-size="12" font-weight="600" font-family="IBM Plex Sans, sans-serif">${esc(c.n)}</text>
         <line x1="${c.x + 28}" y1="70" x2="${c.x + 28}" y2="490" stroke="#3d4d6a" stroke-dasharray="4 6"/>`
    )
    .join("");
  const msg = (y: number, x1: number, x2: number, label: string, back = false) => {
    const a = x1 + 28;
    const b = x2 + 28;
    return `<line x1="${a}" y1="${y}" x2="${b}" y2="${y}" stroke="${back ? "#3dd6c6" : "#f0b429"}" stroke-width="1.5" marker-end="url(#ah)"/>
      <text x="${Math.min(a, b) + 8}" y="${y - 6}" fill="#9aa8c7" font-size="10" font-family="IBM Plex Sans, sans-serif">${esc(label)}</text>`;
  };
  const seqInner = `${marker}${lifelines}
    ${msg(100, 50, 250, "1. Open journey")}
    ${msg(140, 250, 450, "2. API + session cookie")}
    ${msg(180, 450, 250, "3. 401 → redirect IdP", true)}
    ${msg(220, 250, 450, "4. Authorization code + JWT")}
    ${msg(260, 450, 650, `5. POST /${core.toLowerCase().slice(0, 12)}`)}
    ${msg(300, 650, 850, "6. BEGIN; insert; COMMIT")}
    ${msg(340, 850, 650, "7. row + version", true)}
    ${msg(380, 650, 1030, "8. Domain event")}
    ${msg(420, 650, 250, "9. 201 + id", true)}
    ${msg(460, 250, 50, "10. Confirmation + audit id", true)}
  `;

  const idW = 1180;
  const idH = 420;
  const idInner = `${marker}
    ${box(40, 70, 200, 70, "Browser", "RP / SPA")}
    ${box(320, 70, 220, 70, "API gateway", "OIDC relying party")}
    ${box(620, 70, 240, 70, `${client} IdP`, "UAE Pass / AD / Entra")}
    ${box(920, 70, 220, 70, "Token service", "JWT + refresh")}
    ${box(40, 250, 260, 80, "RBAC store", "roles, duties, SoD")}
    ${box(360, 250, 280, 80, "Domain services", "enforce scopes + ABAC")}
    ${box(700, 250, 280, 80, "Audit ledger", "who / what / when / why")}
    ${arrow(240, 105, 320, 105, "1 login")}
    ${arrow(540, 105, 620, 105, "2 authn")}
    ${arrow(860, 105, 920, 105, "3 code")}
    ${arrow(140, 140, 140, 250, "4 entitlements")}
    ${arrow(490, 140, 500, 250)}
    ${arrow(820, 320, 980, 140, "5 audit")}
  `;

  const dataW = 1180;
  const dataH = 400;
  const dataInner = `${marker}
    ${box(40, 80, 200, 80, "Channel", "UI / partner API")}
    ${box(320, 80, 200, 80, "Command API", "sync write")}
    ${box(600, 80, 200, 80, `${core}`, "aggregate")}
    ${box(880, 80, 240, 80, "System of record", "PostgreSQL")}
    ${box(320, 250, 200, 80, "Outbox", "atomic with SoR")}
    ${box(600, 250, 200, 80, "Message bus", "at-least-once")}
    ${box(880, 250, 240, 80, `${second} / search / notify`, "idempotent consumers")}
    ${arrow(240, 120, 320, 120, "HTTPS")}
    ${arrow(520, 120, 600, 120)}
    ${arrow(800, 120, 880, 120, "tx")}
    ${arrow(700, 160, 420, 250, "outbox poll")}
    ${arrow(520, 290, 600, 290)}
    ${arrow(800, 290, 880, 290, "event")}
  `;

  const depW = 1180;
  const depH = 480;
  const z = (x: number, y: number, w: number, h: number, title: string, items: string) =>
    `<g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#132033" stroke="#3dd6c6" stroke-dasharray="5 4"/>
      <text x="${x + 14}" y="${y + 24}" fill="#3dd6c6" font-size="12" font-weight="600" font-family="IBM Plex Sans, sans-serif">${esc(title)}</text>
      <text x="${x + 14}" y="${y + 48}" fill="#9aa8c7" font-size="11" font-family="IBM Plex Sans, sans-serif">${esc(items)}</text>
    </g>`;
  const depInner =
    deployment === "cloud"
      ? `${z(40, 60, 1100, 90, "Internet / partners", "Users · CDN · public DNS")}
         ${z(40, 170, 1100, 100, "Public subnet", "WAF · ALB/NLB · NAT")}
         ${z(40, 290, 520, 150, "Private app subnet (multi-AZ)", "Gateway · domain pods · HPA")}
         ${z(580, 290, 560, 150, "Data subnet (no inbound internet)", "PostgreSQL · Redis · bus")}`
      : `${z(40, 60, 360, 380, "Untrust / DMZ", "WAF · reverse proxy · jump")}
         ${z(420, 60, 360, 380, "App VLAN", `K8s/VMs · gateway · ${core}`)}
         ${z(800, 60, 340, 180, "Data VLAN", "PG HA · Redis · bus")}
         ${z(800, 260, 340, 180, "Backup / mgmt VLAN", "Immutable backup · vault · ILO")}`;

  const swimW = 1180;
  const swimH = 460;
  const lanes = ["End user", `${client} officer`, product, "Integrations"];
  const laneH = 90;
  const swimInner = lanes
    .map((lane, i) => {
      const y = 50 + i * laneH;
      return `<rect x="20" y="${y}" width="1140" height="${laneH - 8}" fill="${i % 2 ? "#132033" : "#162038"}" rx="8"/>
        <text x="32" y="${y + 28}" fill="#3dd6c6" font-size="12" font-weight="600" font-family="IBM Plex Sans, sans-serif">${esc(lane)}</text>`;
    })
    .join("");
  const sb = (x: number, lane: number, t: string) => box(x, 62 + lane * laneH, 200, 52, t, "", "#1e3a5f");
  const swimBoxes = `${marker}
    ${swimInner}
    ${sb(180, 0, "1. Submit request")}
    ${sb(420, 2, "2. Validate + persist")}
    ${sb(660, 3, "3. Downstream call")}
    ${sb(420, 1, "4. Review / decide")}
    ${sb(900, 2, "5. State + notify")}
    ${sb(900, 0, "6. Confirmation")}
    ${arrow(380, 88, 420, 88)}
    ${arrow(620, 300, 660, 300)}
    ${arrow(860, 300, 900, 300)}
  `;

  const cicdW = 1180;
  const cicdH = 280;
  const cicdInner = `${marker}
    ${box(30, 90, 160, 80, "Commit", "MR + review")}
    ${box(220, 90, 160, 80, "CI", "test · SAST · SCA")}
    ${box(410, 90, 160, 80, "Image", "signed artefact")}
    ${box(600, 90, 160, 80, "Dev", "auto deploy")}
    ${box(790, 90, 160, 80, "UAT", "gated")}
    ${box(980, 90, 170, 80, "Prod", "change ticket")}
    ${arrow(190, 130, 220, 130)}
    ${arrow(380, 130, 410, 130)}
    ${arrow(570, 130, 600, 130)}
    ${arrow(760, 130, 790, 130)}
    ${arrow(950, 130, 980, 130)}
  `;

  const drW = 1180;
  const drH = 320;
  const drInner = `${marker}
    ${box(60, 80, 420, 160, "Primary site / region", "Active writes · RPO clock")}
    ${box(700, 80, 420, 160, "DR site / second AZ", "Warm standby · replica")}
    ${arrow(480, 140, 700, 140, "async / sync replica")}
    <text x="60" y="280" fill="#9aa8c7" font-size="12" font-family="IBM Plex Sans, sans-serif">Failover: DNS/VIP cut · RTO target ≤ 4h · restore drill each release train</text>
  `;

  const netH = 560;
  const netBand = (y: number, h: number, title: string) =>
    `<rect x="28" y="${y}" width="1124" height="${h}" rx="12" fill="#132033" stroke="#3dd6c6" stroke-dasharray="5 4"/>
     <text x="44" y="${y + 22}" fill="#3dd6c6" font-size="12" font-weight="600" font-family="IBM Plex Sans, sans-serif">${esc(title)}</text>`;
  const netInner =
    deployment === "cloud"
      ? `${marker}
      ${netBand(48, 88, "Internet / partners")}
      ${box(60, 64, 240, 56, "Users / DNS", "Public HTTPS")}
      ${box(330, 64, 240, 56, "CDN", "Anycast, TLS")}
      ${box(600, 64, 240, 56, "Partner WAN", "mTLS / VPN")}
      ${box(870, 64, 250, 56, "IdP / UAE Pass", "OIDC")}
      ${netBand(156, 100, "Edge / public subnet")}
      ${box(60, 180, 250, 56, "WAF", "L7, bot, geo")}
      ${box(340, 180, 250, 56, "Load balancer", "TLS offload, HC")}
      ${box(620, 180, 250, 56, "NAT / egress", "Pinned IPs")}
      ${box(900, 180, 220, 56, "Bastion", "Break-glass only")}
      ${netBand(276, 120, "Private app subnet (multi-AZ)")}
      ${box(60, 304, 250, 68, "API gateway", "No public data")}
      ${box(340, 304, 250, 68, "Domain services", mods.slice(0, 2).join(" · ") || "App")}
      ${box(620, 304, 250, 68, "BFF / SPA hosts", "Stateless")}
      ${box(900, 304, 220, 68, "East-west mesh", "mTLS")}
      ${netBand(416, 120, "Data subnet — no inbound internet")}
      ${box(60, 444, 250, 68, "PostgreSQL", "Primary + replica")}
      ${box(340, 444, 250, 68, "Redis", "Cache only")}
      ${box(620, 444, 250, 68, "Bus", "Private NLB")}
      ${box(900, 444, 220, 68, "Object / backup", "Private endpoint")}
      ${arrow(180, 120, 180, 180, "443")}
      ${arrow(460, 236, 460, 304)}
      ${arrow(185, 372, 185, 444)}`
      : `${marker}
      ${netBand(48, 100, "Untrust / DMZ")}
      ${box(60, 72, 220, 56, "Internet VIP", "Public DNS")}
      ${box(310, 72, 220, 56, "WAF / reverse proxy", "TLS, IPS")}
      ${box(560, 72, 220, 56, "Jump / PAM", "No direct SSH")}
      ${box(810, 72, 300, 56, "Site-to-site / partner", "IPsec or mTLS")}
      ${netBand(168, 140, "App VLAN")}
      ${box(60, 200, 250, 80, "ToR HA pair", "25Gb east-west")}
      ${box(340, 200, 250, 80, "API gateway", "OIDC at edge")}
      ${box(620, 200, 250, 80, "App / K8s nodes", mods.slice(0, 2).join(" · "))}
      ${box(900, 200, 220, 80, "LB pair", "L4/L7")}
      ${netBand(328, 100, "Data VLAN")}
      ${box(60, 360, 250, 52, "PostgreSQL HA", "Not internet-routable")}
      ${box(340, 360, 250, 52, "Redis / bus", "Same VLAN ACL")}
      ${box(620, 360, 250, 52, "Object / NAS", "NFS or S3-compat")}
      ${box(900, 360, 220, 52, "NACL default-deny", "App→data only")}
      ${netBand(448, 88, "Backup / mgmt VLAN")}
      ${box(60, 476, 340, 44, "Backup target", "Isolated, immutable if licensed")}
      ${box(430, 476, 340, 44, "Vault / PKI", "No prod data path")}
      ${box(800, 476, 320, 44, "ILO / oob", "Out of band")}
      ${arrow(170, 128, 170, 200)}
      ${arrow(170, 280, 170, 360)}`;

  const secH = 540;
  const secInner = `${marker}
    ${box(40, 56, 200, 70, "People", "Staff · applicants")}
    ${box(280, 56, 220, 70, `${client} IdP`, "OIDC / SAML / UAE Pass")}
    ${box(540, 56, 200, 70, "WAF", "TLS, WAF rules, DDoS")}
    ${box(780, 56, 220, 70, "API gateway", "JWT validate · rate limit")}
    ${box(1020, 56, 120, 70, "SIEM", "Logs + alerts")}
    ${box(40, 200, 250, 90, "Zero-trust edge", "No VLAN = trust")}
    ${box(320, 200, 250, 90, "Service identity", "mTLS / SPIFFE / mesh")}
    ${box(600, 200, 250, 90, "RBAC + ABAC + SoD", "Authorise in service")}
    ${box(880, 200, 260, 90, "Vault", "Secrets, keys, certs")}
    ${box(40, 350, 250, 90, "TLS 1.2+ in transit", "HSTS, modern ciphers")}
    ${box(320, 350, 250, 90, "At-rest encryption", "Disk + backup")}
    ${box(600, 350, 250, 90, "Audit ledger", "Who / what / when / why")}
    ${box(880, 350, 260, 90, "VA/PT + SCA + SAST", "CI gate + pre-go-live")}
    ${arrow(240, 91, 280, 91, "login")}
    ${arrow(500, 91, 540, 91)}
    ${arrow(740, 91, 780, 91, "JWT")}
    ${arrow(890, 126, 890, 200)}
    ${arrow(165, 126, 165, 200)}
    ${arrow(445, 290, 445, 350)}
    ${arrow(725, 290, 725, 350)}
    <text x="40" y="480" fill="#9aa8c7" font-size="12" font-family="IBM Plex Sans, sans-serif">${esc(
      "PDPL: minimise PII, residency as deployment, 72h incident notice. Break-glass named and time-bounded."
    )}</text>
    <text x="40" y="502" fill="#9aa8c7" font-size="12" font-family="IBM Plex Sans, sans-serif">${esc(
      "403 not empty-list. No staff passwords in " + product + "."
    )}</text>
  `;

  const swH = 640;
  const swMods = mods
    .map((m, i) => box(48 + (i % 6) * 186, 300 + Math.floor(i / 6) * 100, 176, 84, m, "Bounded context / service"))
    .join("");
  const swInner = `${marker}
    <text x="48" y="58" fill="#9aa8c7" font-size="12" font-family="IBM Plex Sans, sans-serif">C4 containers — UI is a client of the same APIs as partners</text>
    ${box(48, 76, 260, 70, "Web SPA", "React · no business rules")}
    ${box(340, 76, 260, 70, "BFF", "Session, BFF-for-SPA only")}
    ${box(632, 76, 260, 70, "Admin SPA", "Same API contract")}
    ${box(924, 76, 208, 70, "Partner clients", "mTLS + client creds")}
    ${box(48, 176, 360, 80, "API gateway", "Authn, rate limit, OpenAPI edge")}
    ${box(440, 176, 360, 80, "Identity adapter", `${client} IdP · UAE Pass`)}
    ${box(832, 176, 300, 80, "Notification adapter", "Mail / SMS / outbox")}
    ${swMods}
    ${box(48, 520, 360, 80, "Shared kernel", "Audit, RBAC, errors, tracing")}
    ${box(440, 520, 360, 80, "OpenAPI 3", "Source of truth after freeze")}
    ${box(832, 520, 300, 80, "CI artefacts", "Signed images · IaC")}
    ${arrow(178, 146, 178, 176)}
    ${arrow(228, 256, 228, 300, "HTTPS JSON")}
  `;

  const dbH = 560;
  const dbInner = `${marker}
    ${box(40, 56, 280, 80, "App writes", "One aggregate owner")}
    ${box(360, 56, 280, 80, "PostgreSQL primary", "SoR · WAL · version col")}
    ${box(680, 56, 220, 80, "Sync / semi-sync replica", "Failover")}
    ${box(930, 56, 210, 80, "Read replica", "Reporting only")}
    ${box(40, 180, 280, 80, "Outbox table", "Same TX as aggregate")}
    ${box(360, 180, 280, 80, "Schema per context", mods.slice(0, 3).join(" · ") || "modules")}
    ${box(680, 180, 460, 80, "No shared DB as integration", "IDs across contexts, not joins")}
    ${box(40, 300, 280, 80, "Redis", "TTL cache · never SoR")}
    ${box(360, 300, 280, 80, "Object store", "Files; DB holds key+hash")}
    ${box(680, 300, 460, 80, "PITR + backup VLAN", "RPO ≤ 15 min · restore drill")}
    ${box(40, 420, 540, 80, "Classification", "Public / internal / confidential / PII")}
    ${box(610, 420, 530, 80, "Legal hold + soft delete", "Retention per Client policy")}
    ${arrow(320, 96, 360, 96, "COMMIT")}
    ${arrow(640, 96, 680, 96, "stream")}
    ${arrow(500, 136, 180, 180, "outbox")}
    ${arrow(180, 260, 180, 300)}
  `;

  const tbl = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 22) || "record";
  const erBox = (x: number, y: number, w: number, name: string, attrs: string[]) => {
    const h = 36 + attrs.length * 16 + 10;
    return `<g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#132033" stroke="#3dd6c6" stroke-width="1.2"/>
      <rect x="${x}" y="${y}" width="${w}" height="28" rx="8" fill="#1e3a5f"/>
      <rect x="${x}" y="${y + 20}" width="${w}" height="10" fill="#1e3a5f"/>
      <text x="${x + 10}" y="${y + 19}" fill="#3dd6c6" font-size="12" font-weight="600" font-family="IBM Plex Sans, sans-serif">${esc(name)}</text>
      ${attrs
        .map(
          (a, i) =>
            `<text x="${x + 10}" y="${y + 46 + i * 16}" fill="#e8eefc" font-size="11" font-family="IBM Plex Mono, ui-monospace, monospace">${esc(a)}</text>`
        )
        .join("")}
    </g>`;
  };
  const crow = (x1: number, y1: number, x2: number, y2: number, card: string) =>
    `${arrow(x1, y1, x2, y2, card)}`;
  const coreTbl = tbl(core);
  const erMods = mods.slice(0, 4);
  const erW = 1180;
  const erH = 720;
  const modBoxes = erMods
    .map((m, i) => {
      const x = 40 + (i % 4) * 285;
      const t = tbl(m);
      return erBox(x, 280, 270, `${t}_record`, [
        "PK id uuid",
        "FK org_id → org",
        "status text",
        "version int",
        "created_by text",
      ]);
    })
    .join("");
  const histBoxes = erMods
    .map((m, i) => {
      const x = 40 + (i % 4) * 285;
      const t = tbl(m);
      return erBox(x, 430, 270, `${t}_status_hist`, ["PK id uuid", `FK record_id → ${t}_record`, "from_status / to_status", "actor, reason, at"]);
    })
    .join("");
  const erInner = `${marker}
    <text x="40" y="52" fill="#9aa8c7" font-size="12" font-family="IBM Plex Sans, sans-serif">Crow’s-foot logical ERD — PostgreSQL. Shared kernel left/top; capability aggregates centre; audit/outbox/files bottom. No shared joins as an API.</text>
    ${erBox(40, 68, 250, "org", ["PK id uuid", "code unique", "name", "classification"])}
    ${erBox(310, 68, 270, "principal", ["PK id uuid (IdP sub)", "FK org_id → org", "email, display_name", "disabled_at"])}
    ${erBox(600, 68, 250, "role", ["PK id uuid", "code unique", "name"])}
    ${erBox(870, 68, 270, "principal_role", ["PK (principal_id, role_id)", "FK → principal", "FK → role", "granted_at"])}
    ${crow(290, 110, 310, 110, "1")}
    ${crow(580, 110, 600, 110, "N")}
    ${crow(850, 110, 870, 110, "N")}
    ${modBoxes}
    ${histBoxes}
    ${erBox(40, 560, 250, "audit_event", ["PK id uuid", "actor, action", "entity_type, entity_id", "before/after hash", "request_id"])}
    ${erBox(310, 560, 270, "outbox_event", ["PK id uuid", "aggregate_id", "topic, payload jsonb", "published_at null"])}
    ${erBox(600, 560, 250, "object_ref", ["PK id uuid", "bucket, object_key", "sha256, mime", "size_bytes"])}
    ${erBox(870, 560, 270, "notification", ["PK id uuid", "channel, to_ref", "template, payload", "sent_at"])}
    ${crow(165, 248, 165, 280, "1:N")}
    ${crow(175, 400, 175, 430, "1:N")}
    ${crow(175, 530, 165, 560, "N")}
    <text x="40" y="700" fill="#9aa8c7" font-size="12" font-family="IBM Plex Sans, sans-serif">${esc(
      `Core aggregate: ${coreTbl}_record. Cross-context FKs are UUIDs only — not cross-schema joins in application SQL.`
    )}</text>
  `;

  const rptH = 540;
  const rptInner = `${marker}
    ${box(40, 56, 260, 80, "OLTP primary", "PostgreSQL writer · not for BI")}
    ${box(360, 56, 260, 80, "OLTP replica", "CDC / snapshot source")}
    ${box(680, 56, 460, 80, "Complaint + domain events", "Outbox → bus, never a second writer")}
    ${box(40, 180, 340, 88, "CDC / ETL", "Debezium / Airbyte · scheduled + stream")}
    ${box(420, 180, 340, 88, "dbt / star schema", "Facts + dimensions · one grain per measure")}
    ${box(800, 180, 340, 88, "KPI dictionary", "Name, grain, owner, SQL/DAX")}
    ${box(40, 320, 540, 88, "Warehouse", "Columnar (ClickHouse or equivalent) · AZ replica")}
    ${box(620, 320, 520, 88, "Quality gates", "Freshness, row counts, CDC lag SLO")}
    ${arrow(300, 96, 360, 96, "async replica")}
    ${arrow(490, 136, 490, 180)}
    ${arrow(210, 268, 210, 320)}
    ${arrow(590, 268, 800, 364)}
    <text x="40" y="450" fill="#9aa8c7" font-size="12" font-family="IBM Plex Sans, sans-serif">Reporting architecture: warehouse is not the system of record. BI tools query certified datasets only.</text>
    <text x="40" y="478" fill="#9aa8c7" font-size="12" font-family="IBM Plex Sans, sans-serif">${esc(product)} — lag SLO is an operations KPI, not a UI timeout.</text>
  `;

  const biH = 540;
  const biInner = `${marker}
    ${box(40, 56, 1100, 64, "Certified warehouse / semantic layer", "Same facts for every tool — no spreadsheet as source of truth")}
    ${box(40, 160, 340, 100, "Apache Superset", micro ? "In-cluster web + workers + metadata DB" : "BI VMs + metadata PostgreSQL")}
    ${box(420, 160, 340, 100, "Power BI", "Service / Fabric + Windows on-premises gateway")}
    ${box(800, 160, 340, 100, "IdP / RLS", `${client} Entra/OIDC · tenant & org filters`)}
    ${box(40, 300, 340, 88, "Workspace apps", "Published packs, not personal .pbix as prod")}
    ${box(420, 300, 340, 88, "SQL Lab / datasets", "Virtual datasets, no OLTP ad-hoc")}
    ${box(800, 300, 340, 88, "KPI pack", "Throughput, SLA, backlog, lag")}
    ${arrow(590, 120, 210, 160)}
    ${arrow(590, 120, 590, 160)}
    ${arrow(590, 120, 970, 160)}
    <text x="40" y="430" fill="#9aa8c7" font-size="12" font-family="IBM Plex Sans, sans-serif">BI architecture: consumers, not a second warehouse. Gateways outbound 443 only. Row-level security in the model, not only in the UI.</text>
    <text x="40" y="458" fill="#9aa8c7" font-size="12" font-family="IBM Plex Sans, sans-serif">Cost estimator sizes VMs/pods when Superset and/or Power BI are ticked; this view is the design contract.</text>
  `;

  const cmpH = 580;
  const cmpInner = `${marker}
    ${box(40, 52, 200, 72, "Portal", "Public / staff lodge")}
    ${box(260, 52, 200, 72, "Phone / email", "Contact-centre capture")}
    ${box(480, 52, 200, 72, "Walk-in / paper", "Officer key-in")}
    ${box(700, 52, 200, 72, "Partner / API", "mTLS intake")}
    ${box(920, 52, 220, 72, "Anonymous?", "Policy + tracking token")}
    ${box(40, 160, 1100, 70, "Complaints intake API", "Idempotency-Key · classify · attach evidence to object store")}
    ${box(40, 260, 340, 88, "Case aggregate", "complaint_record SoR · version · legal_hold")}
    ${box(420, 260, 340, 88, "SLA / triage engine", "Clock, queue, escalate, SoD")}
    ${box(800, 260, 340, 88, "Officer workbench", "Cannot decide own submission")}
    ${box(40, 380, 340, 80, "Decision + notify", "Outbox in same TX")}
    ${box(420, 380, 340, 80, "Audit ledger", "Who / what / when / why")}
    ${box(800, 380, 340, 80, "Warehouse facts", "Backlog, SLA %, reopen rate")}
    ${arrow(140, 124, 140, 160)}
    ${arrow(590, 230, 210, 260)}
    ${arrow(590, 230, 590, 260)}
    ${arrow(210, 348, 210, 380)}
    ${arrow(590, 348, 590, 380)}
    ${arrow(970, 348, 970, 380)}
    <text x="40" y="490" fill="#9aa8c7" font-size="12" font-family="IBM Plex Sans, sans-serif">Complaints handling: one case identifier across channels. Spreadsheet inboxes are not the mechanism. Reopen is a new event on the same case, not a duplicate SoR row without a parent.</text>
    <text x="40" y="518" fill="#9aa8c7" font-size="12" font-family="IBM Plex Sans, sans-serif">${esc(`Ack SLO and decision SLO are ${client} policy; product clocks them and pages on breach.`)}</text>
  `;

  return [
    { id: "logical", title: "Logical architecture", caption: "Channel → edge → domain → data → platform for " + product, width: logicalW, height: logicalH, svg: frame(logicalW, logicalH, `Logical architecture — ${product}`, logicalInner) },
    { id: "software", title: "Software architecture", caption: `C4 containers and bounded contexts for ${product}. UI is a client of the same APIs.`, width: 1180, height: swH, svg: frame(1180, swH, `Software architecture — ${product}`, swInner) },
    { id: "network", title: "Network architecture", caption: deployPhraseShort(deployment) + " North–south and east–west paths; data has no inbound internet.", width: 1180, height: netH, svg: frame(1180, netH, `Network architecture — ${deployment}`, netInner) },
    { id: "security-arch", title: "Security architecture", caption: `Federation, zero trust, vault, audit, PDPL controls for ${client}.`, width: 1180, height: secH, svg: frame(1180, secH, `Security architecture — ${product}`, secInner) },
    { id: "database", title: "Database architecture", caption: "PostgreSQL as system of record, outbox, replica topology, cache and object store.", width: 1180, height: dbH, svg: frame(1180, dbH, `Database architecture — ${product}`, dbInner) },
    { id: "erd", title: "Entity-relationship diagram (tables)", caption: `Logical ERD of PostgreSQL tables for ${product}: shared kernel, ${core} aggregate, audit, outbox, files.`, width: erW, height: erH, svg: frame(erW, erH, `ERD — tables — ${product}`, erInner) },
    { id: "sequence", title: "End-to-end write sequence", caption: `Authenticated create on ${core}, transactional persist, then domain event.`, width: seqW, height: seqH, svg: frame(seqW, seqH, `Sequence — happy-path write (${core})`, seqInner) },
    { id: "identity", title: "Identity and access flow", caption: `Federation with ${client} IdP, local RBAC, and immutable audit.`, width: idW, height: idH, svg: frame(idW, idH, "Identity, RBAC and audit", idInner) },
    { id: "dataflow", title: "Transactional + event data flow", caption: "Synchronous command path with transactional outbox into async consumers.", width: dataW, height: dataH, svg: frame(dataW, dataH, "Data and integration flow", dataInner) },
    { id: "deployment", title: "Deployment / trust zones", caption: deployPhraseShort(deployment), width: depW, height: depH, svg: frame(depW, depH, `Deployment zones — ${deployment}`, depInner) },
    { id: "process", title: "Business process (swimlanes)", caption: `Canonical journey spanning user, ${client} officer, ${product}, and integrations.`, width: swimW, height: swimH, svg: frame(swimW, swimH, "Process flow — submit, decide, notify", swimBoxes) },
    { id: "cicd", title: "Release pipeline", caption: "Progressive delivery with security gates before production.", width: cicdW, height: cicdH, svg: frame(cicdW, cicdH, "CI/CD and environment promotion", cicdInner) },
    { id: "dr", title: "Resilience and DR", caption: "Primary/DR topology with stated RPO/RTO.", width: drW, height: drH, svg: frame(drW, drH, "High availability and disaster recovery", drInner) },
    { id: "reporting", title: "Reporting architecture", caption: `OLTP replica → CDC/ETL → warehouse and KPI dictionary for ${product}. BI never queries the writer.`, width: 1180, height: rptH, svg: frame(1180, rptH, `Reporting architecture — ${product}`, rptInner) },
    { id: "bi", title: "BI architecture", caption: "Apache Superset and Microsoft Power BI consume one certified warehouse. Gateways and RLS are part of the design.", width: 1180, height: biH, svg: frame(1180, biH, `BI architecture — ${product}`, biInner) },
    { id: "complaints", title: "Complaints handling architecture", caption: `Multi-channel intake, case SLA, segregation of duties, audit, and warehouse facts for ${client}.`, width: 1180, height: cmpH, svg: frame(1180, cmpH, `Complaints handling — ${product}`, cmpInner) },
  ];
}

function deployPhraseShort(d: PlannerBrief["deployment"]) {
  if (d === "on-premise") return "Customer DC VLANs: DMZ, app, data, backup.";
  if (d === "hybrid") return "Cloud edge with on-premise data stores.";
  return "Public-cloud multi-AZ private subnets.";
}

export function svgToPng(svg: string, width: number, height: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * 1.5);
      canvas.height = Math.round(height * 1.5);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (png) => {
        URL.revokeObjectURL(url);
        if (!png) {
          reject(new Error("png"));
          return;
        }
        resolve(new Uint8Array(await png.arrayBuffer()));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("svg image"));
    };
    img.src = url;
  });
}
