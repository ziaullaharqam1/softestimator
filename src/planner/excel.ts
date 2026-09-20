import * as XLSX from "xlsx";
import { answerRfpQuestion } from "./generate";
import { infraSheetMatrices } from "./infra";
import { effortSheetMatrices } from "./effort";
import { grossOf, netOf, vatOf } from "./invoices";
import type { DeliveryPack, RfpPreviewRow } from "./types";

const QUESTION_RE = /question|requirement|criteria|specification|description|query|item|scope|rfp/i;
const ANSWER_RE = /answer|response|vendor.?resp|proposal|solution|compliance.?comment|remarks|comments|justification/i;
const COMPLY_RE = /compli|conform|meet|status|yes.?no/i;

function sheetMatrix(ws: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, { header: 1, defval: "", raw: false }) as string[][];
}

function scoreHeader(cell: string) {
  const c = cell.toLowerCase();
  let s = 0;
  if (QUESTION_RE.test(c)) s += 3;
  if (ANSWER_RE.test(c)) s += 3;
  if (COMPLY_RE.test(c)) s += 2;
  if (/id|s\.?no|sn\b|ref/i.test(c)) s += 1;
  return s;
}

function detectHeader(rows: string[][]) {
  let best = 0;
  let bestScore = -1;
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i++) {
    const score = rows[i].reduce((a, c) => a + (String(c).trim() ? scoreHeader(String(c)) : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function colIndex(header: string[], re: RegExp) {
  return header.findIndex((h) => re.test(String(h)));
}

export async function fillRfpWorkbook(file: File, pack: DeliveryPack): Promise<{ blob: Blob; preview: RfpPreviewRow[]; filled: number }> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const preview: RfpPreviewRow[] = [];
  let filled = 0;

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = sheetMatrix(ws);
    if (!rows.length) continue;
    const headerRow = detectHeader(rows);
    const header = rows[headerRow].map((c) => String(c ?? ""));
    let qCol = colIndex(header, QUESTION_RE);
    let aCol = colIndex(header, ANSWER_RE);
    let cCol = colIndex(header, COMPLY_RE);
    if (qCol < 0) {
      // widest text column after header
      let maxLen = 0;
      qCol = 0;
      for (let c = 0; c < header.length; c++) {
        const len = rows.slice(headerRow + 1, headerRow + 30).reduce((s, r) => s + String(r[c] ?? "").length, 0);
        if (len > maxLen) {
          maxLen = len;
          qCol = c;
        }
      }
    }
    if (aCol < 0 || aCol === qCol) {
      aCol = header.length;
      header.push("Vendor Response");
      rows[headerRow] = header;
    }
    if (cCol < 0 || cCol === qCol || cCol === aCol) {
      cCol = header.length;
      header.push("Compliance");
      rows[headerRow] = header;
    }

    for (let r = headerRow + 1; r < rows.length; r++) {
      while (rows[r].length < header.length) rows[r].push("");
      const question = String(rows[r][qCol] ?? "").trim();
      if (question.length < 8) continue;
      if (/^(id|s\.?no|total|note)/i.test(question) && question.length < 16) continue;
      const { answer, compliance } = answerRfpQuestion(question, pack);
      rows[r][aCol] = answer;
      rows[r][cCol] = compliance;
      filled += 1;
      if (preview.length < 40) preview.push({ sheet: name, question, answer, compliance });
    }

    const aoa = rows.map((row) => {
      const copy = [...row];
      while (copy.length < header.length) copy.push("");
      return copy;
    });
    wb.Sheets[name] = XLSX.utils.aoa_to_sheet(aoa);
    const range = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(aoa.length - 1, 0), c: Math.max(header.length - 1, 0) },
    });
    wb.Sheets[name]["!ref"] = range;
  }

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return {
    blob: new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    preview,
    filled,
  };
}

export function boqWorkbook(pack: DeliveryPack) {
  const wb = XLSX.utils.book_new();
  const rows = [
    ["BOQ — on-premise / run-rate planning", pack.brief.productName, pack.brief.clientName],
    ["Generated", pack.generatedAt.slice(0, 10), pack.placeholders.deployment],
    [],
    ["Item", "Category", "Qty", "Unit", "Unit AED", "Total AED", "Capex?", "Notes"],
    ...pack.boq.lines.map((l) => [l.item, l.category, l.qty, l.unit, l.unitAed, l.totalAed, l.capex ? "Yes" : "Opex", l.notes]),
    [],
    ["Capex total (AED)", pack.boq.capexAed],
    ["Opex / recurring lines (AED)", pack.boq.opexYearAed],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "BOQ");
  const basis = [
    ["Basis of estimate — planning class, not a bid"],
    ["Class", "AACE Class 4 / 5 planning. Accuracy typically −30% / +50% until site survey and RFP commercials freeze."],
    ["Currency", "AED. No VAT, customs, or FX. Unit rates are UAE 2026 planning, not supplier quotes."],
    ["Users", pack.placeholders.users, "Named users from the brief. Concurrent load for capacity = 10% unless discovery measures otherwise."],
    ["Deployment", pack.placeholders.deployment],
    ["What is in a line", "Qty × unit rate. N+1 already in qty for HA pairs. Cloud lines are monthly run-rate, not 36-month TCO unless noted."],
    ["What is not in the BOQ", "Client existing licences, data-centre power/space opex, pen-test firm, UAE Pass commercial, legal review, unbounded history migration."],
    ["Services sprints", "BOQ still shows a lump implementation line. Role-level man-hours and AED sit on the Effort sheets in this workbook and the standalone Effort Excel."],
    ["AMC", "20% of hardware + license capex for on-prem. Cloud AMC is in the monthly lines."],
    ["Change", "A CR that adds a Must integration or a module re-opens this sheet. Do not treat this file as a PO."],
    [],
    ["Line notes (copy of BOQ notes)"],
    ["Item", "Notes"],
    ...pack.boq.lines.map((l) => [l.item, l.notes]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(basis), "Basis of estimate");
  const pay = [
    ["Gate", "% of implementation fee", "Trigger (SOW)"],
    ["Kickoff / M0 pack", "10%", "PO named, RAID opened, environment request lodged"],
    ["M1 architecture freeze", "15%", "HLD, LLD, wireframes, RBAC matrix accepted"],
    ["Build increments", "40%", "Slice demos; P0/P1 of that slice pass or waived"],
    ["UAT complete", "20%", "UAT sign-off or written waiver of remaining P1"],
    ["Go-live + hypercare report", "15%", "Production release + 30-day report"],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pay), "Payment gates");
  appendInfraSheets(wb, pack);
  appendEffortSheets(wb, pack);
  return writeXlsx(wb);
}

export function effortWorkbook(pack: DeliveryPack) {
  const wb = XLSX.utils.book_new();
  appendEffortSheets(wb, pack);
  return writeXlsx(wb);
}

export function infraWorkbook(pack: DeliveryPack) {
  const wb = XLSX.utils.book_new();
  appendInfraSheets(wb, pack);
  return writeXlsx(wb);
}

export function testWorkbook(pack: DeliveryPack) {
  const wb = XLSX.utils.book_new();
  const suites = ["Functional", "Integration", "Security", "NFR", "UAT"] as const;
  for (const suite of suites) {
    const cases = pack.testCases.filter((t) => t.suite === suite);
    const aoa = [
      ["ID", "Module", "Title", "Preconditions", "Steps", "Expected", "Priority"],
      ...cases.map((t) => [t.id, t.module, t.title, t.preconditions, t.steps, t.expected, t.priority]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), suite);
  }
  const cover = [
    ["Test pack", pack.brief.productName],
    ["Client", pack.brief.clientName],
    ["Cases", pack.testCases.length],
    ["P0 count", pack.testCases.filter((t) => t.priority === "P0").length],
    ["Pass rule", "Go-live: all P0 pass or written waiver. P1: pass or dated fix-forward. Evidence: request-id, screenshot or log, tester name, date."],
    ["Environment", "Execute in test/UAT. Production is not a test bed except for agreed smoke after CAB."],
    ["Traceability", "See RTM sheet. Requirement IDs match BRD MoSCoW (BR-*) and NFR-*."],
  ];
  wb.SheetNames.unshift("Cover");
  wb.Sheets["Cover"] = XLSX.utils.aoa_to_sheet(cover);

  const modules = pack.brief.modules
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const mods = modules.length ? modules.slice(0, 12) : ["Core"];
  const rtm: (string | number)[][] = [
    ["Req ID", "MoSCoW", "Requirement (short)", "Tests", "Priority of tests", "UAT evidence"],
  ];
  mods.forEach((m, i) => {
    const n = String(i + 1).padStart(2, "0");
    const fn = pack.testCases.filter((t) => t.module === m).map((t) => t.id);
    rtm.push([
      `BR-${n}a`,
      "Must",
      `Staff CRUD / search ${m}`,
      fn.join(", ") || "TC-FN pending",
      "P0/P1",
      "Create→submit with issued ref",
    ]);
    rtm.push([`BR-${n}b`, "Must", `Audit on ${m} privileged change`, "TC-SEC-02, module functional", "P0", "Auditor export of known change"]);
  });
  rtm.push(
    ["BR-ID", "Must", "Staff IdP only", "TC-IN-IDP, TC-SEC-01", "P0", "No password field; login fails if IdP down"],
    ["BR-403", "Must", "Forbidden is 403 not empty list", pack.testCases.filter((t) => t.id.includes("D")).map((t) => t.id).join(", "), "P0", "Forbidden persona"],
    ["NFR-P95", "Must", "p95 list/detail < 2s", "TC-NFR-01", "P1", "k6/JMeter 15 min report"],
    ["NFR-RPO", "Must", "≤ 15 min data loss", "TC-NFR-02", "P1", "Restore drill minutes"],
    ["NFR-AV", "Must", "99.9% monthly API", "TC-NFR-03", "P0", "Synthetic + gateway metrics"]
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rtm), "RTM");

  const nfr = [
    ["ID", "Need", "Measure", "Test"],
    ["NFR-AV", "99.9% prod API monthly", "Synthetic + gateway; exclude agreed window", "TC-NFR-03 + ops dashboard"],
    ["NFR-P95", "p95 < 2s UAE broadband", "15 min load, ~10% concurrent of named users", "TC-NFR-01"],
    ["NFR-RPO", "≤ 15 min", "WAL + backup age", "TC-NFR-02"],
    ["NFR-RTO", "≤ 4 h after disaster declared", "Timed drill", "TC-NFR-02 (timed)"],
    ["NFR-A11Y", "WCAG 2.1 AA new UI", "Keyboard + axe on queue/create", "TC-NFR-04"],
    ["NFR-PDPL", "PII minimised, encrypted, residency as HLD", "Inventory + config review", "Security suite + LLD secrets"],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(nfr), "NFR");
  return writeXlsx(wb);
}

export function ganttWorkbook(pack: DeliveryPack) {
  const start = new Date(pack.brief.startDate || pack.generatedAt.slice(0, 10));
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x.toISOString().slice(0, 10);
  };
  const rows = [
    ["Milestone", "Phase", "Owner", "Start week", "Duration (weeks)", "Start date", "End date", "Deliverables"],
    ...pack.milestones.map((m) => [
      m.name,
      m.phase,
      m.owner,
      m.startWeek,
      m.durationWeeks,
      addDays(start, (m.startWeek - 1) * 7),
      addDays(start, (m.startWeek + m.durationWeeks - 1) * 7 - 1),
      m.deliverables.join("; "),
    ]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Gantt");
  return writeXlsx(wb);
}

export function invoiceWorkbook(pack: DeliveryPack) {
  const wb = XLSX.utils.book_new();
  const register = [
    ["Invoice register — drafts", pack.brief.productName, pack.brief.clientName],
    ["Supplier", pack.brief.vendorName],
    ["VAT", "5% standard-rated (planning). Confirm TRN before issue."],
    [],
    ["Number", "Kind", "Status", "Gate", "Issue", "Due", "Net AED", "VAT AED", "Gross AED", "Trigger"],
    ...pack.invoices.map((inv) => [
      inv.number,
      inv.kind,
      inv.status,
      inv.gate,
      inv.issueDate,
      inv.dueDate,
      netOf(inv),
      vatOf(inv),
      grossOf(inv),
      inv.trigger,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(register), "Register");
  for (const inv of pack.invoices) {
    const name = inv.number.replace(/[\\/?*[\]]/g, "-").slice(0, 31);
    const aoa = [
      ["TAX / PRO FORMA / CREDIT — DRAFT"],
      ["Number", inv.number],
      ["Title", inv.title],
      ["Supplier", pack.brief.vendorName, "TRN", "[SUPPLIER TRN]"],
      ["Customer", pack.brief.clientName, "TRN", "[CUSTOMER TRN]"],
      ["Issue", inv.issueDate, "Due", inv.dueDate],
      ["PO", inv.poRef],
      ["MSA", inv.msaRef],
      ["SOW", inv.sowRef],
      ["Gate", inv.gate],
      ["Trigger", inv.trigger],
      [],
      ["Description", "Qty", "Unit", "Unit AED", "VAT %", "Net AED", "VAT AED"],
      ...inv.lines.map((l) => [
        l.description,
        l.qty,
        l.unit,
        l.unitAed,
        l.vatRate * 100,
        l.qty * l.unitAed,
        l.qty * l.unitAed * l.vatRate,
      ]),
      [],
      ["Net", netOf(inv)],
      ["VAT", vatOf(inv)],
      ["Gross", grossOf(inv)],
      [],
      ["Notes"],
      ...inv.notes.map((n) => [n]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  }
  return writeXlsx(wb);
}

function appendInfraSheets(wb: XLSX.WorkBook, pack: DeliveryPack) {
  for (const s of infraSheetMatrices(pack.infra)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name.slice(0, 31));
  }
}

function appendEffortSheets(wb: XLSX.WorkBook, pack: DeliveryPack) {
  for (const s of effortSheetMatrices(pack.effort)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name.slice(0, 31));
  }
}

function writeXlsx(wb: XLSX.WorkBook) {
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
