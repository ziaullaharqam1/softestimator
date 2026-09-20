import { flattenEffort } from "./effort";
import { flattenInfra } from "./infra";
import { grossOf, netOf, vatOf } from "./invoices";
import type { DeliveryPack, DocSection } from "./types";

export const ARTEFACTS: { id: ArtefactId; label: string }[] = [
  { id: "content", label: "Current tab / chosen artefact" },
  { id: "pack", label: "Whole pack (all artefacts)" },
  { id: "sow", label: "SOW" },
  { id: "nda", label: "NDA" },
  { id: "msa", label: "Contract (MSA)" },
  { id: "hld", label: "HLD" },
  { id: "lld", label: "LLD" },
  { id: "brd", label: "BRD" },
  { id: "prd", label: "PRD" },
  { id: "invoices", label: "Invoices" },
  { id: "boq", label: "BOQ" },
  { id: "effort", label: "Effort / man-hours" },
  { id: "infra", label: "Infrastructure" },
  { id: "tests", label: "Test cases" },
  { id: "gantt", label: "Gantt" },
];

export type ArtefactId =
  | "content"
  | "pack"
  | "sow"
  | "nda"
  | "msa"
  | "hld"
  | "lld"
  | "brd"
  | "prd"
  | "invoices"
  | "boq"
  | "effort"
  | "infra"
  | "tests"
  | "gantt";

export function flattenSections(sections: DocSection[]) {
  return sections
    .map((s) => {
      const bits = [`${s.heading}`, s.body, ...(s.paragraphs ?? [])];
      if (s.numbered?.length) bits.push(s.numbered.map((n, i) => `${i + 1}. ${n}`).join("\n"));
      if (s.bullets?.length) bits.push(s.bullets.map((n) => `• ${n}`).join("\n"));
      if (s.table) {
        bits.push(s.table.caption);
        bits.push(s.table.headers.join(" | "));
        bits.push(...s.table.rows.map((r) => r.join(" | ")));
      }
      return bits.filter(Boolean).join("\n\n");
    })
    .join("\n\n");
}

export function flattenArtefact(pack: DeliveryPack, id: Exclude<ArtefactId, "content">): string {
  if (id === "pack") {
    return [
      pack.executiveSummary,
      pack.rfpNarrative.join("\n"),
      flattenSections(pack.sow),
      flattenSections(pack.nda),
      flattenSections(pack.msa),
      flattenSections(pack.hld),
      flattenSections(pack.lld),
      flattenSections(pack.brd),
      flattenSections(pack.prd),
      flattenArtefact(pack, "invoices"),
      flattenArtefact(pack, "boq"),
      flattenArtefact(pack, "effort"),
      flattenArtefact(pack, "infra"),
      flattenArtefact(pack, "tests"),
      flattenArtefact(pack, "gantt"),
      pack.assumptions.join("\n"),
    ].join("\n\n");
  }
  if (id === "sow") return flattenSections(pack.sow);
  if (id === "nda") return flattenSections(pack.nda);
  if (id === "msa") return flattenSections(pack.msa);
  if (id === "hld") return flattenSections(pack.hld);
  if (id === "lld") return flattenSections(pack.lld);
  if (id === "brd") return flattenSections(pack.brd);
  if (id === "prd") return flattenSections(pack.prd);
  if (id === "invoices") {
    return pack.invoices
      .map(
        (inv) =>
          `${inv.number} ${inv.title}\n${inv.gate}. ${inv.trigger}\nIssue ${inv.issueDate} due ${inv.dueDate}\n` +
          inv.lines.map((l) => `${l.description} ${l.qty} × ${l.unitAed}`).join("\n") +
          `\nNet ${netOf(inv)} VAT ${vatOf(inv)} Gross ${grossOf(inv)} AED`
      )
      .join("\n\n");
  }
  if (id === "boq") {
    return pack.boq.lines.map((l) => `${l.item}\t${l.qty} ${l.unit}\t${l.totalAed} AED\t${l.notes}`).join("\n");
  }
  if (id === "effort") return flattenEffort(pack.effort);
  if (id === "infra") return flattenInfra(pack.infra);
  if (id === "tests") {
    return pack.testCases.map((t) => `${t.id} [${t.priority}] ${t.suite}/${t.module}: ${t.title}\nExpected: ${t.expected}`).join("\n\n");
  }
  return pack.milestones
    .map((m) => `${m.name} (${m.phase}) W${m.startWeek}+${m.durationWeeks}w ${m.owner}\n${m.deliverables.join("; ")}`)
    .join("\n\n");
}

export function tokenMap(pack: DeliveryPack, content: string): Record<string, string> {
  const p = pack.placeholders;
  const map: Record<string, string> = {
    ...p,
    productName: p.projectName,
    projectName: p.projectName,
    content,
    body: content,
    document: content,
    sow: flattenArtefact(pack, "sow"),
    nda: flattenArtefact(pack, "nda"),
    msa: flattenArtefact(pack, "msa"),
    contract: flattenArtefact(pack, "msa"),
    hld: flattenArtefact(pack, "hld"),
    lld: flattenArtefact(pack, "lld"),
    brd: flattenArtefact(pack, "brd"),
    prd: flattenArtefact(pack, "prd"),
    invoices: flattenArtefact(pack, "invoices"),
    boq: flattenArtefact(pack, "boq"),
    effort: flattenArtefact(pack, "effort"),
    infra: flattenArtefact(pack, "infra"),
    tests: flattenArtefact(pack, "tests"),
    gantt: flattenArtefact(pack, "gantt"),
    pack: flattenArtefact(pack, "pack"),
    rfpNarrative: pack.rfpNarrative.join("\n\n"),
    assumptions: pack.assumptions.join("\n"),
    kindLabel: pack.kindLabel,
    capex: String(pack.boq.capexAed),
    opex: String(pack.boq.opexYearAed),
  };
  return map;
}

export const TOKEN_HELP = [
  ["{{projectName}} / {{productName}}", "Solution name"],
  ["{{clientName}} / {{vendorName}}", "Parties"],
  ["{{date}} / {{industry}} / {{deployment}}", "Cover fields"],
  ["{{duration}} / {{users}} / {{scope}}", "Sizing"],
  ["{{executiveSummary}} / {{constraints}}", "Brief"],
  ["{{content}} or {{body}}", "The artefact you pick in the Template tab"],
  ["{{sow}} {{nda}} {{msa}} {{hld}} {{lld}} {{brd}} {{prd}}", "Full generated text"],
  ["{{invoices}} {{boq}} {{effort}} {{infra}} {{tests}} {{gantt}} {{pack}}", "Registers and whole pack"],
  ["{{effortSummary}} {{effortHours}} {{effortManDays}} {{effortCostAed}}", "Man-hour totals"],
  ["{{milestones}} {{nfr}} {{security}} {{architectureOverview}}", "Short fields"],
];
