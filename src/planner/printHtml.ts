import type { DeliveryPack, DocSection, Invoice, RfpPreviewRow } from "./types";
import { grossOf, implementationFeeAed, netOf, vatOf } from "./invoices";

export type PrintKind =
  | "overview"
  | "rfp"
  | "boq"
  | "effort"
  | "infra"
  | "sow"
  | "nda"
  | "msa"
  | "hld"
  | "lld"
  | "gantt"
  | "arch"
  | "brd"
  | "prd"
  | "tests"
  | "deck"
  | "wires"
  | "invoices"
  | "template";

export function printTitle(kind: PrintKind, pack: DeliveryPack) {
  const map: Record<PrintKind, string> = {
    overview: "Delivery pack overview",
    rfp: "RFP response extract",
    boq: "Bill of quantities",
    effort: "Effort estimate and man-hour costing",
    infra: "Infrastructure (VMs, IPs, VLANs, policies)",
    sow: "Statement of Work",
    nda: "Mutual Non-Disclosure Agreement",
    msa: "Master Services Agreement",
    hld: "High-Level Design",
    lld: "Low-Level Design",
    gantt: "Delivery Gantt",
    arch: "Architecture (software, network, security, database, reporting, BI, complaints)",
    brd: "Business Requirements Document",
    prd: "Product Requirements Document",
    tests: "Test pack",
    deck: "Proposal slides",
    wires: "Wireframes",
    invoices: "Invoices (pro forma, tax, credit note)",
    template: "Template merge tokens",
  };
  return `${map[kind]} — ${pack.brief.productName}`;
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", minimumFractionDigits: 2 }).format(n);
}

const CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #c5cdd8; color: #1b2430; font: 12.5px/1.45 "Calibri", "Segoe UI", sans-serif; }
  .bar { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
    padding: 10px 16px; background: #0d7377; color: #fff; font-size: 13px; }
  .bar button { font: inherit; padding: 6px 12px; border: 0; border-radius: 6px; cursor: pointer; background: #fff; color: #0d7377; font-weight: 600; }
  .bar span { opacity: .9; }
  .wrap { padding: 18px 12px 48px; }
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 16px; background: #fff; padding: 16mm 16mm 18mm;
    box-shadow: 0 8px 24px rgba(0,0,0,.18); page-break-after: always; break-after: page; }
  .kicker { color: #0d7377; letter-spacing: .14em; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  h1 { font-size: 22px; margin: 4px 0 8px; }
  h2 { font-size: 14px; color: #0d7377; margin: 16px 0 6px; page-break-after: avoid; }
  p { margin: 0 0 8px; }
  .muted { color: #5b6b7c; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 10px 0 14px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 11px; }
  th, td { border: 1px solid #d5dde8; padding: 5px 7px; vertical-align: top; text-align: left; }
  th { background: #0d7377; color: #fff; font-weight: 600; }
  ol, ul { margin: 0 0 10px; padding-left: 18px; }
  li { margin: 3px 0; }
  .fig { margin: 8px 0; border: 1px solid #d5dde8; padding: 8px; }
  .fig svg { max-width: 100%; height: auto; display: block; }
  .totals { width: 280px; margin-left: auto; }
  .stamp { display: inline-block; border: 2px solid #b45309; color: #b45309; padding: 4px 10px; font-weight: 700;
    letter-spacing: .08em; transform: rotate(-6deg); float: right; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
  .box { border: 1px solid #d5dde8; padding: 10px 12px; min-height: 90px; }
  .box h3 { margin: 0 0 6px; font-size: 11px; color: #0d7377; text-transform: uppercase; letter-spacing: .06em; }
  .foot { margin-top: 18px; font-size: 10px; color: #5b6b7c; border-top: 1px solid #d5dde8; padding-top: 8px; }
  @media print {
    body { background: #fff; }
    .bar { display: none !important; }
    .wrap { padding: 0; }
    .sheet { box-shadow: none; margin: 0; }
  }
  @page { size: A4; margin: 12mm; }
`;

function sheet(inner: string) {
  return `<section class="sheet">${inner}</section>`;
}

function tableHtml(headers: string[], rows: string[][]) {
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function sectionsHtml(sections: DocSection[], pack: DeliveryPack) {
  return sections
    .map((s) => {
      const diagram = s.diagramId ? pack.diagrams.find((d) => d.id === s.diagramId) : undefined;
      const paras = (s.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join("");
      const ol = s.numbered?.length ? `<ol>${s.numbered.map((n) => `<li>${esc(n)}</li>`).join("")}</ol>` : "";
      const ul = s.bullets?.length ? `<ul>${s.bullets.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : "";
      const tbl = s.table ? `<p class="muted">${esc(s.table.caption)}</p>${tableHtml(s.table.headers, s.table.rows)}` : "";
      const fig = diagram
        ? `<p class="muted">Figure — ${esc(diagram.title)}. ${esc(diagram.caption)}</p><div class="fig">${diagram.svg}</div>`
        : "";
      return sheet(
        `<p class="kicker">${esc(pack.brief.vendorName)}</p><h2>${esc(s.heading)}</h2><p>${esc(s.body)}</p>${paras}${ol}${ul}${tbl}${fig}`
      );
    })
    .join("");
}

function cover(pack: DeliveryPack, title: string, blurb: string) {
  return sheet(`
    <p class="kicker">${esc(pack.brief.vendorName)}</p>
    <h1>${esc(title)}</h1>
    <p class="muted">${esc(pack.brief.productName)} · ${esc(pack.brief.clientName)} · ${esc(pack.generatedAt.slice(0, 10))} · Draft for print / PDF</p>
    ${tableHtml(
      ["Field", "Value"],
      [
        ["Customer", pack.brief.clientName],
        ["Supplier", pack.brief.vendorName],
        ["Deployment", pack.placeholders.deployment],
        ["Named users", pack.placeholders.users],
        ["Duration", pack.placeholders.duration],
      ]
    )}
    <p>${esc(blurb)}</p>
  `);
}

function invoiceSheet(pack: DeliveryPack, inv: Invoice) {
  const lineRows = inv.lines.map((l) => {
    const net = l.qty * l.unitAed;
    const vat = net * l.vatRate;
    return [
      l.description,
      String(l.qty),
      l.unit,
      money(l.unitAed),
      `${Math.round(l.vatRate * 100)}%`,
      money(net),
      money(vat),
    ];
  });
  return sheet(`
    <span class="stamp">${esc(inv.status.toUpperCase())}</span>
    <p class="kicker">${esc(pack.brief.vendorName)} · UAE tax invoice (planning draft)</p>
    <h1>${esc(inv.kind === "tax" ? "TAX INVOICE" : inv.kind === "proforma" ? "PRO FORMA INVOICE" : "CREDIT NOTE")}</h1>
    <p>${esc(inv.title)}</p>
    <div class="parties">
      <div class="box">
        <h3>Supplier (from)</h3>
        <p><strong>${esc(pack.brief.vendorName)}</strong><br/>[ADDRESS]<br/>TRN [SUPPLIER TRN]<br/>Trade licence [NUMBER]</p>
      </div>
      <div class="box">
        <h3>Customer (bill to)</h3>
        <p><strong>${esc(pack.brief.clientName)}</strong><br/>[ADDRESS]<br/>TRN [CUSTOMER TRN]<br/>Attn: Accounts payable / PO owner</p>
      </div>
    </div>
    ${tableHtml(
      ["", ""],
      [
        ["Invoice no.", inv.number],
        ["Issue date", inv.issueDate],
        ["Due date", inv.dueDate],
        ["Currency", "AED"],
        ["Place of supply", "United Arab Emirates"],
        ["PO / LPO", inv.poRef],
        ["MSA", inv.msaRef],
        ["SOW", inv.sowRef],
        ["Gate", inv.gate],
        ["Payment trigger", inv.trigger],
      ]
    )}
    ${tableHtml(["Description", "Qty", "Unit", "Unit AED", "VAT", "Net AED", "VAT AED"], lineRows)}
    <table class="totals">
      <tr><td>Taxable amount</td><td>${esc(money(netOf(inv)))}</td></tr>
      <tr><td>VAT 5%</td><td>${esc(money(vatOf(inv)))}</td></tr>
      <tr><th>Amount due</th><th>${esc(money(grossOf(inv)))}</th></tr>
    </table>
    <p><strong>Notes</strong></p>
    <ul>${inv.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
    <div class="foot">FTA sequential numbering must be used on live invoices. This file is a draft generated by SoftEstimator Planner. E-invoicing (Peppol / FTA) fields are not populated.</div>
  `);
}

export function buildPrintHtml(
  pack: DeliveryPack,
  kind: PrintKind,
  rfpPreview?: { preview: RfpPreviewRow[]; filled: number } | null
) {
  const title = printTitle(kind, pack);
  let body = "";
  if (kind === "overview") {
    body =
      cover(pack, title, pack.executiveSummary) +
      sheet(
        `<h2>RFP narrative</h2><ul>${pack.rfpNarrative.map((n) => `<li>${esc(n)}</li>`).join("")}</ul><h2>Assumptions</h2><ul>${pack.assumptions
          .map((n) => `<li>${esc(n)}</li>`)
          .join("")}</ul>`
      );
  } else if (kind === "rfp") {
    body = cover(
      pack,
      title,
      rfpPreview
        ? `Filled ${rfpPreview.filled} requirement rows. Extract below (first ${rfpPreview.preview.length}).`
        : "No workbook answered yet. Upload the issuer Excel in the briefing panel, then Answer uploaded Excel, then print."
    );
    if (rfpPreview?.preview.length) {
      body += sheet(
        tableHtml(
          ["Sheet", "Requirement", "Compliance", "Draft answer"],
          rfpPreview.preview.map((r) => [r.sheet, r.question, r.compliance, r.answer])
        )
      );
    }
  } else if (kind === "boq") {
    body =
      cover(pack, title, `Planning BOQ. Capex ${money(pack.boq.capexAed)}. Recurring ${money(pack.boq.opexYearAed)}. Not a quote.`) +
      sheet(
        tableHtml(
          ["Item", "Category", "Qty", "Unit", "Total AED", "Capex?", "Notes"],
          pack.boq.lines.map((l) => [
            l.item,
            l.category,
            String(l.qty),
            l.unit,
            money(l.totalAed),
            l.capex ? "Yes" : "Opex",
            l.notes,
          ])
        )
      );
  } else if (kind === "infra") {
    const i = pack.infra;
    body =
      cover(
        pack,
        title,
        `${i.vms.length} VMs · ${i.vlans.length} VLAN/subnets · ${i.policies.length} policies. ${i.hypervisor}. Planning IPAM.`
      ) +
      sheet(`<h2>Naming</h2><ul>${i.naming.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`) +
      sheet(
        `<h2>${i.runtime === "kubernetes" ? "Kubernetes masters and workers" : "Presentation and application VMs"}</h2>` +
          tableHtml(
            ["Node type", "Hostname", "Env", "Cluster", "vCPU", "RAM Gi", "IP", "Taints", "Schedulable"],
            i.vms
              .filter((v) =>
                i.runtime === "kubernetes" ? v.k8sRole === "master" || v.k8sRole === "worker" : v.role === "WEB" || v.role === "APP"
              )
              .map((v) => [
                v.k8sRole === "master" ? "Master (control plane)" : v.k8sRole === "worker" ? "Worker" : v.role === "WEB" ? "Presentation" : "Application",
                v.hostname,
                v.env,
                v.cluster,
                String(v.vcpu),
                String(v.ramGi),
                v.ip,
                v.k8sTaints,
                v.k8sRole === "master" ? "No" : "Yes",
              ])
          )
      ) +
      sheet(
        `<h2>Capacity</h2>` +
          tableHtml(
            ["Env", "VMs", "vCPU", "RAM Gi", "OS Gi", "Data Gi"],
            i.capacity.map((c) => [c.env, String(c.vmCount), String(c.vcpu), String(c.ramGi), String(c.osDiskGi), String(c.dataDiskGi)])
          )
      ) +
      sheet(
        `<h2>VLANs and subnets</h2>` +
          tableHtml(
            ["Env", "VLAN", "Name", "Zone", "CIDR", "Gateway", "Purpose"],
            i.vlans.map((v) => [v.env, String(v.vlanId), v.name, v.zone, v.cidr, v.gateway, v.purpose])
          )
      ) +
      sheet(
        `<h2>VM inventory</h2>` +
          tableHtml(
            ["Hostname", "Env", "K8s / role", "Function", "vCPU", "RAM Gi", "OS Gi", "Data Gi", "VLAN", "IP", "VIP", "HA"],
            i.vms.map((v) => [
              v.hostname,
              v.env,
              v.k8sRole ? `K8s ${v.k8sRole}` : v.role,
              v.function,
              String(v.vcpu),
              String(v.ramGi),
              String(v.osDiskGi),
              String(v.dataDiskGi),
              `${v.vlanId} ${v.vlanName}`,
              v.ip,
              v.vip,
              v.ha,
            ])
          )
      ) +
      sheet(
        `<h2>Security policies</h2>` +
          tableHtml(
            ["ID", "Env", "Name", "From", "To", "Source", "Destination", "Service", "Action"],
            i.policies.map((p) => [p.id, p.env, p.name, p.fromZone, p.toZone, p.source, p.destination, p.service, p.action])
          )
      ) +
      sheet(
        `<h2>Physical / node hosts</h2>` +
          tableHtml(
            ["Host", "Env", "Role", "CPU", "RAM Gi", "Mgmt IP"],
            i.hosts.map((h) => [h.name, h.env, h.role, h.cpu, String(h.ramGi), h.mgmtIp])
          )
      );
  } else if (kind === "effort") {
    const e = pack.effort;
    body =
      cover(
        pack,
        title,
        `${e.totalManDays} man-days · ${e.totalHours} hours · ${money(e.totalCostAed)} including ${Math.round(e.contingencyPct * 100)}% reserve. Planning rates. Not a quote.`
      ) +
      sheet(
        `<h2>By phase</h2>` +
          tableHtml(
            ["Phase", "Weeks", "Man-days", "Hours", "AED"],
            [
              ...e.byPhase.map((p) => [p.phase, String(p.weeks), String(p.manDays), String(p.hours), money(p.costAed)]),
              ["Management reserve", "", String(Math.round((e.contingencyHours / e.hoursPerDay) * 10) / 10), String(e.contingencyHours), money(e.contingencyAed)],
              ["Grand total", "", String(e.totalManDays), String(e.totalHours), money(e.totalCostAed)],
            ]
          )
      ) +
      sheet(
        `<h2>Rate card</h2>` +
          tableHtml(
            ["Role", "Discipline", "AED / hour", "AED / man-day", "Notes"],
            e.roles.map((r) => [r.role, r.discipline, money(r.aedPerHour), money(r.aedPerDay), r.notes])
          )
      ) +
      sheet(
        `<h2>By role</h2>` +
          tableHtml(
            ["Role", "Avg FTE", "Man-days", "Hours", "AED"],
            e.byRole.map((r) => [r.role, String(r.avgFte), String(r.manDays), String(r.hours), money(r.costAed)])
          )
      ) +
      sheet(
        `<h2>Man-hour costing</h2>` +
          tableHtml(
            ["Phase", "Role", "Hours", "Rate AED/h", "Amount AED"],
            [
              ...e.lines.map((l) => [l.phase, l.role, String(l.hours), money(l.aedPerHour), money(l.costAed)]),
              ["Management reserve", "Blended", String(e.contingencyHours), "", money(e.contingencyAed)],
              ["TOTAL", "", String(e.totalHours), "", money(e.totalCostAed)],
            ]
          )
      ) +
      sheet(`<h2>Assumptions</h2><ul>${e.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`);
  } else if (kind === "sow") body = cover(pack, title, pack.executiveSummary) + sectionsHtml(pack.sow, pack);
  else if (kind === "nda") body = cover(pack, title, "Draft for counsel. Complete [brackets] before signature.") + sectionsHtml(pack.nda, pack);
  else if (kind === "msa") body = cover(pack, title, "Draft MSA. Fees remain blank until Schedule 1 is priced.") + sectionsHtml(pack.msa, pack);
  else if (kind === "hld") body = cover(pack, title, pack.executiveSummary) + sectionsHtml(pack.hld, pack);
  else if (kind === "lld") body = cover(pack, title, pack.executiveSummary) + sectionsHtml(pack.lld, pack);
  else if (kind === "brd") body = cover(pack, title, pack.executiveSummary) + sectionsHtml(pack.brd, pack);
  else if (kind === "prd") body = cover(pack, title, pack.executiveSummary) + sectionsHtml(pack.prd, pack);
  else if (kind === "gantt") {
    body =
      cover(pack, title, `Kickoff ${pack.brief.startDate || pack.generatedAt.slice(0, 10)}.`) +
      sheet(
        tableHtml(
          ["Milestone", "Phase", "Owner", "Start week", "Weeks", "Deliverables"],
          pack.milestones.map((m) => [
            m.name,
            m.phase,
            m.owner,
            String(m.startWeek),
            String(m.durationWeeks),
            m.deliverables.join("; "),
          ])
        )
      );
  } else if (kind === "arch") {
    const primary = new Set(["software", "network", "security-arch", "database", "reporting", "bi", "complaints"]);
    const viewSheets = pack.architectureViews
      .map((v) => {
        const d = pack.diagrams.find((x) => x.id === v.diagramId);
        const ul = `<ul>${v.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
        const tbl = v.table ? `<p class="muted">${esc(v.table.caption)}</p>${tableHtml(v.table.headers, v.table.rows)}` : "";
        const fig = d
          ? `<p class="muted">Figure — ${esc(d.title)}. ${esc(d.caption)}</p><div class="fig">${d.svg}</div>`
          : "";
        return sheet(
          `<p class="kicker">${esc(pack.brief.vendorName)}</p><h2>${esc(v.title)}</h2><p>${esc(v.summary)}</p>${ul}${tbl}${fig}`
        );
      })
      .join("");
    const support = pack.diagrams
      .filter((d) => !primary.has(d.id))
      .map((d) =>
        sheet(
          `<h2>${esc(d.title)}</h2><p class="muted">Supporting view. ${esc(d.caption)}</p><div class="fig">${d.svg}</div>`
        )
      )
      .join("");
    body =
      cover(
        pack,
        title,
        "Seven separate architectures: software, network, security, database, reporting, BI, and complaints handling. Supporting diagrams follow."
      ) +
      viewSheets +
      support;
  } else if (kind === "tests") {
    body =
      cover(pack, title, `${pack.testCases.length} cases. P0 must pass or be waived before go-live.`) +
      sheet(
        tableHtml(
          ["ID", "Suite", "Module", "Title", "Priority", "Expected"],
          pack.testCases.map((t) => [t.id, t.suite, t.module, t.title, t.priority, t.expected])
        )
      );
  } else if (kind === "deck") {
    body =
      cover(pack, title, "Print of slide text. Download PPTX for Canva / PowerPoint.") +
      pack.slides
        .map((s) =>
          sheet(
            `<p class="kicker">${esc(s.kicker)}</p><h1>${esc(s.title)}</h1><ul>${s.bullets
              .map((b) => `<li>${esc(b)}</li>`)
              .join("")}</ul>`
          )
        )
        .join("");
  } else if (kind === "wires") {
    body =
      cover(pack, title, "1440×900 boards. SVG is in the zip for Figma.") +
      pack.wireframes
        .map((w) =>
          sheet(
            `<h2>${esc(w.name)}</h2><p class="muted">${esc(w.persona)} — ${esc(w.purpose)}</p><p>${esc(
              w.layoutNotes
            )}</p><div class="fig">${w.svg}</div>`
          )
        )
        .join("");
  } else if (kind === "invoices") {
    const impl = implementationFeeAed(pack.boq.lines);
    body =
      cover(
        pack,
        title,
        `Implementation planning total (ex-VAT) ${money(impl)}. Tax invoices follow SOW gates. Draft until PO and TRN are completed.`
      ) +
      sheet(
        `<h2>Invoice register</h2>` +
          tableHtml(
            ["Number", "Kind", "Status", "Gate", "Issue", "Due", "Net", "VAT", "Gross"],
            pack.invoices.map((inv) => [
              inv.number,
              inv.kind,
              inv.status,
              inv.gate,
              inv.issueDate,
              inv.dueDate,
              money(netOf(inv)),
              money(vatOf(inv)),
              money(grossOf(inv)),
            ])
          )
      ) +
      pack.invoices.map((inv) => invoiceSheet(pack, inv)).join("");
  } else if (kind === "template") {
    body =
      cover(pack, title, "Put these tokens in your house Word / PowerPoint / Excel / text file, then Embed & download.") +
      sheet(
        tableHtml(
          ["Token", "Fills with"],
          [
            ["{{projectName}}", pack.brief.productName],
            ["{{clientName}}", pack.brief.clientName],
            ["{{vendorName}}", pack.brief.vendorName],
            ["{{content}}", "The artefact selected on the Template tab"],
            ["{{sow}} {{nda}} {{msa}} {{hld}} {{lld}} {{brd}} {{prd}}", "Full generated documents"],
            ["{{invoices}} {{boq}} {{tests}} {{gantt}} {{pack}}", "Registers / whole pack"],
          ]
        )
      );
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${esc(title)}</title><style>${CSS}</style></head>
<body>
  <div class="bar no-print">
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
    <span>${esc(title)}</span>
  </div>
  <div class="wrap" id="print-root">${body}</div>
</body></html>`;
}
