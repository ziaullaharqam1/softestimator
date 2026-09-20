import type { BoqLine, DocSection, Invoice, InvoiceLine } from "./types";

const VAT = 0.05;

const GATES: { gate: string; pct: number; trigger: string }[] = [
  { gate: "M0 Kickoff", pct: 0.1, trigger: "PO named, RAID opened, environment request lodged" },
  { gate: "M1 Architecture freeze", pct: 0.15, trigger: "HLD, LLD, wireframes, RBAC matrix accepted" },
  { gate: "Build increments", pct: 0.4, trigger: "Slice demos; P0/P1 of that slice pass or waived" },
  { gate: "UAT complete", pct: 0.2, trigger: "UAT sign-off or written waiver of remaining P1" },
  { gate: "Go-live + hypercare", pct: 0.15, trigger: "Production release + 30-day hypercare report" },
];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function line(description: string, qty: number, unit: string, unitAed: number, vatRate = VAT): InvoiceLine {
  return { description, qty, unit, unitAed: round2(unitAed), vatRate };
}

export function netOf(inv: Invoice) {
  return round2(inv.lines.reduce((s, l) => s + l.qty * l.unitAed, 0));
}

export function vatOf(inv: Invoice) {
  return round2(inv.lines.reduce((s, l) => s + l.qty * l.unitAed * l.vatRate, 0));
}

export function grossOf(inv: Invoice) {
  return round2(netOf(inv) + vatOf(inv));
}

export function implementationFeeAed(lines: BoqLine[]) {
  return round2(
    lines
      .filter(
        (l) =>
          l.category === "services" ||
          l.item.startsWith("Hypercare") ||
          l.item.startsWith("Training")
      )
      .reduce((s, l) => s + l.totalAed, 0)
  );
}

export function buildInvoices(
  product: string,
  client: string,
  vendor: string,
  slug: string,
  start: string,
  modules: string[],
  boqLines: BoqLine[],
  months: number
): Invoice[] {
  const impl = implementationFeeAed(boqLines);
  const yyyy = start.slice(0, 4);
  const code = slug.replace(/[^a-z0-9]/g, "").slice(0, 8).toUpperCase() || "PRJ";
  const sowRef = `SOW-001 ${product}`;
  const msaRef = `MSA ${product}`;
  const poRef = "[Customer PO / LPO number]";
  const notesCommon = [
    "DRAFT / PRO FORMA until a Customer PO is cited and the related SOW gate is accepted (or deemed accepted).",
    "UAE VAT 5% applied as standard-rated. Confirm TRN, place of supply, and reverse-charge with tax advisers before issue.",
    "Hardware / licence BOQ lines are not on these invoices unless the Order Form says the Supplier is the seller.",
    "Pay net of any written dispute per MSA clause 6. Bank details: [IBAN] [BANK] [SWIFT] in the name of the Supplier.",
    `In-scope capabilities (for narrative only): ${modules.join(", ")}. Calendar (planning): ${months} months from ${start}.`,
  ];

  const invoices: Invoice[] = [
    {
      id: "INV-00",
      number: `PF-${code}-${yyyy}-00`,
      kind: "proforma",
      status: "Pro forma",
      title: `Pro forma — ${product} implementation (all gates)`,
      issueDate: start,
      dueDate: addDays(start, 30),
      poRef,
      sowRef,
      msaRef,
      gate: "All SOW payment gates",
      trigger: "For budget / PO raising only. Not a tax invoice. Not a demand for payment until a tax invoice is issued.",
      lines: [
        line(
          `${product} implementation services as per SOW-001 (${vendor} / ${client}) — all five payment gates`,
          1,
          "lot",
          impl
        ),
      ],
      notes: [
        ...notesCommon,
        "This pro forma shows the planning implementation total (services, training, hypercare). Issue tax invoices INV-01 to INV-05 against gates.",
      ],
    },
  ];

  GATES.forEach((g, i) => {
    const issue = addDays(start, i === 0 ? 0 : Math.round((i / GATES.length) * months * 30));
    invoices.push({
      id: `INV-${String(i + 1).padStart(2, "0")}`,
      number: `INV-${code}-${yyyy}-${String(i + 1).padStart(2, "0")}`,
      kind: "tax",
      status: "Draft",
      title: `Tax invoice — ${g.gate}`,
      issueDate: issue,
      dueDate: addDays(issue, 30),
      poRef,
      sowRef,
      msaRef,
      gate: g.gate,
      trigger: g.trigger,
      lines: [
        line(
          `${product} — ${g.gate} (${Math.round(g.pct * 100)}% of implementation Fees). Trigger: ${g.trigger}.`,
          1,
          "lot",
          round2(impl * g.pct)
        ),
      ],
      notes: notesCommon,
    });
  });

  invoices.push({
    id: "CN-01",
    number: `CN-${code}-${yyyy}-01`,
    kind: "credit-note",
    status: "Template",
    title: "Credit note template (FTA)",
    issueDate: start,
    dueDate: start,
    poRef,
    sowRef,
    msaRef,
    gate: "Adjustment",
    trigger: "Use when a tax invoice must be reduced (scope drop, overbill, VAT correction).",
    lines: [line("Credit against invoice [INV-NUMBER] — [REASON]. Reverse the original VAT treatment.", 1, "lot", 0)],
    notes: [
      "Must reference the original tax invoice number and date.",
      "Show original net, original VAT, credit net, credit VAT.",
      "Sequential credit-note numbers. Do not reuse a tax invoice number.",
      "Not valid until amounts and original invoice id are completed.",
    ],
  });

  return invoices;
}

function aed(n: number) {
  return new Intl.NumberFormat("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function invoiceDocSections(invoices: Invoice[]): DocSection[] {
  return invoices.map((inv) => ({
    heading: `${inv.number} — ${inv.title}`,
    body: `${inv.kind.toUpperCase()}. Status: ${inv.status}. Issue ${inv.issueDate}. Due ${inv.dueDate}. Gate: ${inv.gate}. ${inv.trigger} PO: ${inv.poRef}. ${inv.sowRef}. ${inv.msaRef}.`,
    paragraphs: inv.notes,
    table: {
      caption: `Lines · net ${aed(netOf(inv))} · VAT ${aed(vatOf(inv))} · gross ${aed(grossOf(inv))} AED`,
      headers: ["Description", "Qty", "Unit", "Unit AED", "VAT %", "Net"],
      rows: inv.lines.map((l) => [
        l.description,
        String(l.qty),
        l.unit,
        aed(l.unitAed),
        String(Math.round(l.vatRate * 100)),
        aed(l.qty * l.unitAed),
      ]),
    },
  }));
}
