import type { WireframeScreen } from "./types";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function chrome(product: string, nav: string[], active: string, user: string) {
  const items = nav
    .map((n, i) => {
      const y = 108 + i * 36;
      const on = n === active;
      return `<rect x="16" y="${y}" width="188" height="32" rx="4" fill="${on ? "#111111" : "transparent"}"/>
        <text x="28" y="${y + 21}" fill="${on ? "#ffffff" : "#333333"}" font-size="12" font-family="IBM Plex Sans, sans-serif">${esc(n)}</text>`;
    })
    .join("");
  return `
    <rect x="0" y="0" width="1440" height="56" fill="#ffffff" stroke="#111111"/>
    <text x="20" y="35" font-size="15" font-weight="600" font-family="IBM Plex Sans, sans-serif">${esc(product)}</text>
    <text x="1280" y="35" font-size="12" fill="#333" font-family="IBM Plex Sans, sans-serif">${esc(user)}  ▾</text>
    <rect x="0" y="56" width="220" height="844" fill="#f7f7f4" stroke="#111111"/>
    ${items}
    <rect x="220" y="56" width="1220" height="844" fill="#ffffff" stroke="#111111"/>
  `;
}

function callout(x: number, y: number, n: string, text: string) {
  return `<g>
    <circle cx="${x}" cy="${y}" r="9" fill="#111111"/>
    <text x="${x}" y="${y + 4}" text-anchor="middle" fill="#fff" font-size="10" font-family="IBM Plex Sans, sans-serif">${esc(n)}</text>
    <text x="${x + 16}" y="${y + 4}" fill="#111" font-size="11" font-family="IBM Plex Sans, sans-serif">${esc(text)}</text>
  </g>`;
}

function screen(title: string, inner: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">
  <rect width="1440" height="900" fill="#e8e6df"/>
  <text x="16" y="18" fill="#555" font-size="11" font-family="IBM Plex Sans, sans-serif">${esc(title)} — wireframe 1440×900 · import SVG to Figma (Place image / drag)</text>
  ${inner}
</svg>`;
}

export function buildWireframes(product: string, client: string, modules: string[], industry: string): WireframeScreen[] {
  const nav = ["Home", ...modules.slice(0, 5), "Admin", "Help"];
  const core = modules[0] ?? "Cases";
  const officer = `${client} officer`;
  const userChip = "A. Rahman";

  const loginSvg = screen(`${product} / Sign in`, `
    <rect x="420" y="180" width="600" height="480" fill="#fff" stroke="#111"/>
    <text x="450" y="230" font-size="22" font-weight="600" font-family="IBM Plex Sans, sans-serif">Sign in to ${esc(product)}</text>
    <text x="450" y="258" font-size="13" fill="#444" font-family="IBM Plex Sans, sans-serif">You will be sent to ${esc(client)} identity (OIDC). This app does not keep a password.</text>
    <rect x="450" y="300" width="540" height="44" fill="#111"/>
    <text x="720" y="328" text-anchor="middle" fill="#fff" font-size="14" font-family="IBM Plex Sans, sans-serif">Continue with ${esc(client)} sign-in</text>
    <rect x="450" y="360" width="540" height="44" fill="#fff" stroke="#111"/>
    <text x="720" y="388" text-anchor="middle" font-size="14" font-family="IBM Plex Sans, sans-serif">UAE Pass (public users)</text>
    <text x="450" y="440" font-size="12" fill="#555" font-family="IBM Plex Sans, sans-serif">Help · Privacy · Accessibility</text>
    ${callout(390, 200, "1", "No local username field")}
    ${callout(1050, 322, "2", "Primary: staff IdP")}
    ${callout(1050, 382, "3", "Secondary: public federation")}
  `);

  const queueSvg = screen(`${product} / Work queue`, `
    ${chrome(product, nav, "Home", userChip)}
    <text x="248" y="96" font-size="20" font-weight="600" font-family="IBM Plex Sans, sans-serif">My queue</text>
    <text x="248" y="118" font-size="12" fill="#555" font-family="IBM Plex Sans, sans-serif">${esc(officer)} · SLA clock on each row · default sort: oldest due first</text>
    <rect x="248" y="136" width="140" height="32" rx="2" fill="#fff" stroke="#111"/><text x="258" y="157" font-size="12" font-family="IBM Plex Sans, sans-serif">Status ▾</text>
    <rect x="398" y="136" width="160" height="32" rx="2" fill="#fff" stroke="#111"/><text x="408" y="157" font-size="12" font-family="IBM Plex Sans, sans-serif">Due in 48h</text>
    <rect x="568" y="136" width="280" height="32" rx="2" fill="#fff" stroke="#111"/><text x="578" y="157" font-size="12" fill="#888" font-family="IBM Plex Sans, sans-serif">Search ref / name</text>
    <rect x="248" y="184" width="1160" height="36" fill="#f0f0ea" stroke="#111"/>
    ${["Ref", "Type", "Citizen / org", "Status", "Due", "Age", ""].map((h, i) => `<text x="${260 + i * 160}" y="208" font-size="11" font-weight="600" font-family="IBM Plex Sans, sans-serif">${h}</text>`).join("")}
    ${[0, 1, 2, 3, 4, 5].map((r) => {
      const y = 220 + r * 44;
      return `<rect x="248" y="${y}" width="1160" height="44" fill="${r % 2 ? "#fafaf7" : "#fff"}" stroke="#ddd"/>
        <text x="260" y="${y + 28}" font-size="12" font-family="IBM Plex Sans, sans-serif">NLP-2026-0${r + 14}</text>
        <text x="420" y="${y + 28}" font-size="12" font-family="IBM Plex Sans, sans-serif">${esc(core)}</text>
        <text x="580" y="${y + 28}" font-size="12" font-family="IBM Plex Sans, sans-serif">Al Noor LLC</text>
        <rect x="740" y="${y + 12}" width="88" height="22" rx="2" stroke="#111"/><text x="750" y="${y + 28}" font-size="11" font-family="IBM Plex Sans, sans-serif">${r < 2 ? "Overdue" : "In review"}</text>
        <text x="900" y="${y + 28}" font-size="12" font-family="IBM Plex Sans, sans-serif">${r < 2 ? "−1d" : `${2 + r}d`}</text>`;
    }).join("")}
    ${callout(230, 150, "1", "Filters persist per user")}
    ${callout(230, 200, "2", "Colour is not the only SLA cue — also text")}
  `);

  const listSvg = screen(`${product} / ${core} list`, `
    ${chrome(product, nav, core, userChip)}
    <text x="248" y="96" font-size="20" font-weight="600" font-family="IBM Plex Sans, sans-serif">${esc(core)}</text>
    <rect x="1240" y="76" width="140" height="36" fill="#111"/><text x="1310" y="99" text-anchor="middle" fill="#fff" font-size="13" font-family="IBM Plex Sans, sans-serif">New</text>
    <rect x="248" y="128" width="1160" height="40" fill="#fff" stroke="#111"/>
    <text x="264" y="154" font-size="12" fill="#888" font-family="IBM Plex Sans, sans-serif">Filter: open · assigned to me · all</text>
    ${[0, 1, 2, 3, 4, 5, 6].map((r) => `<rect x="248" y="${184 + r * 48}" width="1160" height="48" fill="#fff" stroke="#ccc"/>
      <text x="264" y="${214 + r * 48}" font-size="13" font-family="IBM Plex Sans, sans-serif">Record ${r + 1} — short title wraps to two lines max</text>
      <text x="1100" y="${214 + r * 48}" font-size="12" fill="#555" font-family="IBM Plex Sans, sans-serif">Draft / Submitted</text>`).join("")}
    ${callout(1180, 94, "1", "New is role-gated; hidden if no create")}
    ${callout(230, 148, "2", "Empty filter: “No matches. Clear filters.” — never a blank white page")}
  `);

  const formSvg = screen(`${product} / ${core} create`, `
    ${chrome(product, nav, core, userChip)}
    <text x="248" y="96" font-size="20" font-weight="600" font-family="IBM Plex Sans, sans-serif">New ${esc(core)}</text>
    <text x="248" y="118" font-size="12" fill="#555" font-family="IBM Plex Sans, sans-serif">Save is disabled until required fields pass. Autosave draft every 30s once a title exists.</text>
    ${["Title *", "Organisation *", "Category *", "Description"].map((lab, i) => {
      const y = 140 + i * 88;
      return `<text x="248" y="${y}" font-size="12" font-family="IBM Plex Sans, sans-serif">${lab}</text>
        <rect x="248" y="${y + 8}" width="${i === 3 ? 900 : 560}" height="${i === 3 ? 96 : 40}" fill="#fff" stroke="#111"/>`;
    }).join("")}
    <text x="248" y="520" font-size="12" font-family="IBM Plex Sans, sans-serif">Attachments (PDF, JPG — 10 MB each)</text>
    <rect x="248" y="532" width="560" height="72" fill="#fafaf7" stroke="#111" stroke-dasharray="5 4"/>
    <text x="264" y="574" font-size="12" fill="#555" font-family="IBM Plex Sans, sans-serif">Drop files or browse</text>
    <rect x="248" y="640" width="120" height="40" fill="#111"/><text x="308" y="665" text-anchor="middle" fill="#fff" font-size="13" font-family="IBM Plex Sans, sans-serif">Submit</text>
    <rect x="380" y="640" width="120" height="40" fill="#fff" stroke="#111"/><text x="440" y="665" text-anchor="middle" font-size="13" font-family="IBM Plex Sans, sans-serif">Save draft</text>
    <rect x="980" y="140" width="400" height="280" fill="#f7f7f4" stroke="#111"/>
    <text x="996" y="168" font-size="12" font-weight="600" font-family="IBM Plex Sans, sans-serif">Need from SOP</text>
    <text x="996" y="196" font-size="12" fill="#333" font-family="IBM Plex Sans, sans-serif">• Trade licence copy</text>
    <text x="996" y="220" font-size="12" fill="#333" font-family="IBM Plex Sans, sans-serif">• Authorised signatory</text>
    <text x="996" y="244" font-size="12" fill="#333" font-family="IBM Plex Sans, sans-serif">Inline error under the field, not a toast only.</text>
    ${callout(230, 652, "1", "Submit = POST with Idempotency-Key")}
  `);

  const detailSvg = screen(`${product} / ${core} detail`, `
    ${chrome(product, nav, core, userChip)}
    <text x="248" y="92" font-size="13" fill="#666" font-family="IBM Plex Sans, sans-serif">${esc(core)} / NLP-2026-014</text>
    <text x="248" y="120" font-size="22" font-weight="600" font-family="IBM Plex Sans, sans-serif">Al Noor LLC — renewal</text>
    <rect x="248" y="136" width="72" height="22" stroke="#111"/><text x="256" y="152" font-size="11" font-family="IBM Plex Sans, sans-serif">In review</text>
    <rect x="248" y="176" width="720" height="36" fill="#f0f0ea" stroke="#111"/>
    ${["Overview", "Documents", "Timeline", "Audit"].map((t, i) => `<text x="${268 + i * 140}" y="200" font-size="13" font-family="IBM Plex Sans, sans-serif">${t}</text>`).join("")}
    <rect x="248" y="228" width="720" height="400" fill="#fff" stroke="#111"/>
    <text x="268" y="260" font-size="13" font-family="IBM Plex Sans, sans-serif">Summary fields in two columns. Long text expands; do not truncate mid-word.</text>
    <rect x="1000" y="176" width="380" height="452" fill="#fff" stroke="#111"/>
    <text x="1016" y="208" font-size="13" font-weight="600" font-family="IBM Plex Sans, sans-serif">Actions</text>
    <rect x="1016" y="224" width="348" height="40" fill="#111"/><text x="1190" y="249" text-anchor="middle" fill="#fff" font-size="13" font-family="IBM Plex Sans, sans-serif">Approve</text>
    <rect x="1016" y="276" width="348" height="40" fill="#fff" stroke="#111"/><text x="1190" y="301" text-anchor="middle" font-size="13" font-family="IBM Plex Sans, sans-serif">Return with reason</text>
    <text x="1016" y="348" font-size="12" fill="#555" font-family="IBM Plex Sans, sans-serif">Return opens a required reason. That reason is stored on the audit row and shown to the applicant.</text>
    ${callout(230, 190, "1", "Tabs keep the case file in one URL")}
    ${callout(980, 244, "2", "Approve is hidden without the role")}
  `);

  const adminSvg = screen(`${product} / Admin roles`, `
    ${chrome(product, nav, "Admin", userChip)}
    <text x="248" y="96" font-size="20" font-weight="600" font-family="IBM Plex Sans, sans-serif">Roles and access</text>
    <text x="248" y="118" font-size="12" fill="#555" font-family="IBM Plex Sans, sans-serif">Users come from ${esc(client)} IdP. This screen does not create passwords. Disable leaves history in place.</text>
    <rect x="248" y="140" width="560" height="480" fill="#fff" stroke="#111"/>
    <text x="264" y="168" font-size="13" font-weight="600" font-family="IBM Plex Sans, sans-serif">Directory (search)</text>
    ${[0, 1, 2, 3, 4].map((i) => `<text x="264" y="${210 + i * 36}" font-size="12" font-family="IBM Plex Sans, sans-serif">user${i}@${esc(client.toLowerCase().replace(/\s/g, ""))}.ae  — Officer</text>`).join("")}
    <rect x="840" y="140" width="540" height="480" fill="#fff" stroke="#111"/>
    <text x="856" y="168" font-size="13" font-weight="600" font-family="IBM Plex Sans, sans-serif">Role: Officer</text>
    <text x="856" y="200" font-size="12" font-family="IBM Plex Sans, sans-serif">☑ ${esc(core)} read / write queue</text>
    <text x="856" y="228" font-size="12" font-family="IBM Plex Sans, sans-serif">☐ Approve (supervisor only)</text>
    <text x="856" y="256" font-size="12" font-family="IBM Plex Sans, sans-serif">☐ Admin</text>
    <text x="856" y="300" font-size="12" fill="#555" font-family="IBM Plex Sans, sans-serif">SoD: submit + final approve cannot sit on the same person for one record.</text>
    ${callout(230, 154, "1", "SCIM later; CSV import is out of MVP unless asked")}
  `);

  const emptySvg = screen(`${product} / Empty and forbidden`, `
    ${chrome(product, nav, core, userChip)}
    <rect x="400" y="200" width="720" height="280" fill="#fff" stroke="#111"/>
    <text x="760" y="280" text-anchor="middle" font-size="18" font-weight="600" font-family="IBM Plex Sans, sans-serif">No ${esc(core)} yet</text>
    <text x="760" y="312" text-anchor="middle" font-size="13" fill="#444" font-family="IBM Plex Sans, sans-serif">When you have create rights, New is in the top right. If you expected data, check filters or ask admin for access.</text>
    <rect x="680" y="340" width="160" height="40" fill="#111"/><text x="760" y="365" text-anchor="middle" fill="#fff" font-size="13" font-family="IBM Plex Sans, sans-serif">New ${esc(core)}</text>
    <rect x="400" y="520" width="720" height="160" fill="#fafaf7" stroke="#111"/>
    <text x="760" y="580" text-anchor="middle" font-size="16" font-weight="600" font-family="IBM Plex Sans, sans-serif">You don’t have access</text>
    <text x="760" y="608" text-anchor="middle" font-size="12" fill="#444" font-family="IBM Plex Sans, sans-serif">HTTP 403. Request id shown for support. Do not render an empty table that looks like “no records”.</text>
    ${callout(380, 220, "1", "Empty ≠ forbidden")}
  `);

  const publicSvg = screen(`${product} / Public status`, `
    <rect x="0" y="0" width="1440" height="64" fill="#fff" stroke="#111"/>
    <text x="24" y="40" font-size="16" font-weight="600" font-family="IBM Plex Sans, sans-serif">${esc(product)}</text>
    <text x="1200" y="40" font-size="13" font-family="IBM Plex Sans, sans-serif">EN | AR</text>
    <text x="80" y="140" font-size="28" font-weight="600" font-family="IBM Plex Sans, sans-serif">Track an application</text>
    <text x="80" y="172" font-size="14" fill="#444" font-family="IBM Plex Sans, sans-serif">Use the reference from your confirmation SMS / email. No other personal data on this page.</text>
    <rect x="80" y="200" width="400" height="48" fill="#fff" stroke="#111"/><text x="96" y="230" fill="#888" font-size="14" font-family="IBM Plex Sans, sans-serif">NLP-2026-014</text>
    <rect x="500" y="200" width="140" height="48" fill="#111"/><text x="570" y="230" text-anchor="middle" fill="#fff" font-size="14" font-family="IBM Plex Sans, sans-serif">Track</text>
    <rect x="80" y="280" width="800" height="280" fill="#fff" stroke="#111"/>
    <text x="104" y="320" font-size="14" font-family="IBM Plex Sans, sans-serif">Submitted → In review → Decision</text>
    <line x1="120" y1="360" x2="720" y2="360" stroke="#111"/>
    <circle cx="120" cy="360" r="8" fill="#111"/><circle cx="400" cy="360" r="8" fill="#111"/><circle cx="720" cy="360" r="8" fill="#fff" stroke="#111"/>
    <text x="104" y="420" font-size="13" fill="#333" font-family="IBM Plex Sans, sans-serif">Last update: 18 Sep 2026, 14:10 GST. Documents outstanding are listed; do not show internal notes.</text>
    ${callout(900, 224, "1", "Rate-limit this page")}
    ${callout(900, 360, "2", "RTL layout when AR is selected")}
  `);

  const meta = [
    {
      id: "wf-signin",
      name: "Sign in",
      persona: "Staff and public",
      purpose: "Hand the user to the IdP. No local password form.",
      layoutNotes: "Centered card, 600px. Two buttons stacked. Footer links only.",
      regions: ["IdP CTA", "UAE Pass CTA", "Help / privacy"],
      emptyState: "n/a",
      errorState: "IdP down: apology + retry + request id. Do not dump stack traces.",
      svg: loginSvg,
    },
    {
      id: "wf-queue",
      name: "Officer work queue",
      persona: officer,
      purpose: "See what is due, oldest first, without a spreadsheet.",
      layoutNotes: "App chrome. Filter row. Dense table. SLA as text plus optional colour.",
      regions: ["Filters", "Queue table", "Row open → detail"],
      emptyState: "Caught up. Nothing in this filter.",
      errorState: "Queue failed to load: retry. Keep chrome visible.",
      svg: queueSvg,
    },
    {
      id: "wf-list",
      name: `${core} list`,
      persona: officer,
      purpose: `Browse ${core} the user is allowed to see.`,
      layoutNotes: "List + New. Role without create: hide New, do not disable-and-tease.",
      regions: ["Title", "New", "Filters", "Rows"],
      emptyState: `No ${core} yet — with an explanation, not a void.`,
      errorState: "Forbidden uses the 403 screen, not an empty list.",
      svg: listSvg,
    },
    {
      id: "wf-create",
      name: `${core} create`,
      persona: officer,
      purpose: "Capture a valid record. Draft allowed. Submit is the legal act.",
      layoutNotes: "Single column form + SOP rail. Errors under fields.",
      regions: ["Fields", "Attachments", "Submit / draft", "SOP checklist"],
      emptyState: "n/a",
      errorState: "409 if someone submitted the same idempotency key; show the existing ref.",
      svg: formSvg,
    },
    {
      id: "wf-detail",
      name: `${core} detail`,
      persona: officer,
      purpose: "One URL for the case file: overview, files, timeline, audit.",
      layoutNotes: "Main 720 / actions 380. Approve/return depend on role and state.",
      regions: ["Identity header", "Tabs", "Body", "Actions"],
      emptyState: "Unknown id → 404 copy, not a spinner forever.",
      errorState: "Stale version on save: reload and explain.",
      svg: detailSvg,
    },
    {
      id: "wf-admin",
      name: "Roles and access",
      persona: "Administrator",
      purpose: "Map IdP users to product roles. No password reset here.",
      layoutNotes: "Split directory / role matrix.",
      regions: ["Search", "User list", "Permissions"],
      emptyState: "No directory match.",
      errorState: "Cannot remove the last admin.",
      svg: adminSvg,
    },
    {
      id: "wf-empty",
      name: "Empty vs 403",
      persona: "Any",
      purpose: "Stop empty tables being used as a security message.",
      layoutNotes: "Two stacked states on one board for workshop use.",
      regions: ["Empty", "Forbidden"],
      emptyState: "Shown.",
      errorState: "Shown.",
      svg: emptySvg,
    },
    {
      id: "wf-public",
      name: "Public track status",
      persona: "Applicant",
      purpose: "Status with a reference only. No PII fishing.",
      layoutNotes: "Marketing-light public page. EN/AR toggle. Timeline.",
      regions: ["Lang", "Lookup", "Timeline"],
      emptyState: "Unknown ref: generic not-found, same timing as found (anti-enumeration).",
      errorState: "Too many lookups: slow down.",
      svg: publicSvg,
    },
  ];

  return meta.map((m) => ({
    ...m,
    width: 1440,
    height: 900,
    stitchPrompt: stitchPrompt(product, client, industry, m.name, m.purpose, m.layoutNotes, m.regions),
    figmaNotes: `Frame "${m.id}" 1440×900. Desktop. 8pt grid. Left nav 220 if chrome is present. Type: IBM Plex Sans 13/20. Do not use color as the only SLA signal. Import the SVG, then outline strokes and rebuild as Auto Layout so engineering can inspect spacing.`,
  }));
}

function stitchPrompt(
  product: string,
  client: string,
  industry: string,
  name: string,
  purpose: string,
  layout: string,
  regions: string[]
) {
  return `Design a desktop web wireframe (1440×900) for "${product}", a government/enterprise ${industry || "operations"} system for ${client}.
Screen: ${name}.
Job: ${purpose}.
Layout: ${layout}.
Regions: ${regions.join("; ")}.
Style: low-fidelity wireframe, grayscale, real labels not lorem ipsum, English UI, room for Arabic (RTL) later. IBM Plex or Inter. Dense officer UI, not a marketing landing page (except public track-status).
Accessibility: text SLA states, visible focus, no information by colour alone.
Export to Figma when done.`;
}

export function wireframeHtml(product: string, screens: WireframeScreen[]) {
  const nav = screens
    .map((s, i) => `<a href="#${s.id}" class="${i === 0 ? "on" : ""}">${esc(s.name)}</a>`)
    .join("");
  const panels = screens
    .map(
      (s) => `<section id="${s.id}">
      <h2>${esc(s.name)}</h2>
      <p class="meta">${esc(s.persona)} — ${esc(s.purpose)}</p>
      <div class="frame">${s.svg}</div>
      <h3>Stitch prompt</h3>
      <pre>${esc(s.stitchPrompt)}</pre>
      <h3>Figma</h3>
      <p>${esc(s.figmaNotes)}</p>
    </section>`
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${esc(product)} wireframes</title>
<style>
body{margin:0;font:14px/1.45 "IBM Plex Sans",system-ui,sans-serif;background:#e8e6df;color:#111}
nav{position:sticky;top:0;background:#111;color:#fff;display:flex;gap:8px;flex-wrap:wrap;padding:10px 16px;z-index:2}
nav a{color:#ccc;text-decoration:none;padding:6px 10px;border-radius:4px}
nav a:hover,nav a.on{background:#333;color:#fff}
section{padding:24px 16px 48px;max-width:1480px;margin:0 auto}
.frame{background:#fff;border:1px solid #111;overflow:auto}
.frame svg{display:block;width:100%;height:auto}
pre{white-space:pre-wrap;background:#fff;border:1px solid #111;padding:12px}
.meta{color:#444}
h3{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#555}
</style></head><body>
<nav>${nav}</nav>
${panels}
<script>document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('nav a').forEach(x=>x.classList.remove('on'));a.classList.add('on')}));</script>
</body></html>`;
}

export function stitchMarkdown(product: string, client: string, screens: WireframeScreen[]) {
  const body = screens
    .map(
      (s) => `## ${s.name} (\`${s.id}\`)

${s.purpose}

Paste into [Google Stitch](https://stitch.withgoogle.com) (or the Stitch experiment in Google Labs), generate, then use **Send to Figma**.

\`\`\`
${s.stitchPrompt}
\`\`\`
`
    )
    .join("\n");
  return `# ${product} — Stitch + Figma wireframes

Client: ${client}

These prompts rebuild each screen in Stitch. Stitch talks to Figma; you do not need a Figma API token in this planner.

Also drag the SVG files onto a Figma page (one frame per file, 1440×900). Rebuild as Auto Layout before handoff.

${body}
`;
}
