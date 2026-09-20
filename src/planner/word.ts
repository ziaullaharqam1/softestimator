import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { invoiceDocSections } from "./invoices";
import { TOKEN_HELP } from "./tokens";
import { svgToPng } from "./diagrams";
import type { DeliveryPack, Diagram, DocSection } from "./types";

const teal = "0D7377";
const ink = "1B2430";
const muted = "5B6B7C";

const thin = { style: BorderStyle.SINGLE, size: 4, color: "D5DDE8" };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

type Kid = Paragraph | Table;

function p(text: string, opts?: { bold?: boolean; size?: number; color?: string; after?: number }) {
  return new Paragraph({
    spacing: { after: opts?.after ?? 160 },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        size: opts?.size ?? 22,
        bold: opts?.bold,
        color: opts?.color ?? ink,
      }),
    ],
  });
}

function h(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, font: "Calibri", bold: true, color: teal, size: level === HeadingLevel.TITLE ? 48 : 26 })],
  });
}

function bullets(items?: string[]) {
  return (items ?? []).map(
    (t) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: t, font: "Calibri", size: 22, color: ink })],
      })
  );
}

function numbered(items?: string[]) {
  return (items ?? []).map(
    (t, i) =>
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: `${i + 1}. ${t}`, font: "Calibri", size: 22, color: ink })],
      })
  );
}

async function pngMap(pack: DeliveryPack, ids: string[]) {
  const out = new Map<string, { data: Uint8Array; diagram: Diagram }>();
  const wanted = new Set(ids.filter(Boolean));
  for (const d of pack.diagrams) {
    if (!wanted.has(d.id)) continue;
    try {
      const data = await svgToPng(d.svg, d.width, d.height);
      out.set(d.id, { data, diagram: d });
    } catch {
      /* Word still has captions if raster fails */
    }
  }
  return out;
}

function imagePara(data: Uint8Array, diagram: Diagram) {
  const maxW = 620;
  const scale = Math.min(1, maxW / diagram.width);
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new ImageRun({
        type: "png",
        data,
        transformation: {
          width: Math.round(diagram.width * scale),
          height: Math.round(diagram.height * scale),
        },
      }),
    ],
  });
}

function renderSection(s: DocSection, pngs: Map<string, { data: Uint8Array; diagram: Diagram }>): Kid[] {
  const kids: Kid[] = [h(s.heading), p(s.body)];
  for (const para of s.paragraphs ?? []) kids.push(p(para));
  kids.push(...bullets(s.bullets));
  kids.push(...numbered(s.numbered));
  if (s.table) {
    kids.push(p(s.table.caption, { bold: true, size: 20, color: muted, after: 80 }));
    kids.push(table([s.table.headers, ...s.table.rows]));
  }
  if (s.diagramId) {
    const hit = pngs.get(s.diagramId);
    const diagram = hit?.diagram ?? undefined;
    if (diagram) kids.push(p(`Figure — ${diagram.title}. ${diagram.caption}`, { size: 18, color: muted, after: 80 }));
    if (hit) kids.push(imagePara(hit.data, hit.diagram));
  }
  return kids;
}

async function sectionsToDoc(
  title: string,
  pack: DeliveryPack,
  sections: DocSection[],
  extra: Kid[] = [],
  mode: "pack" | "legal" = "pack"
) {
  const ids = sections.map((s) => s.diagramId).filter((x): x is string => Boolean(x));
  const pngs = await pngMap(pack, ids);
  const kids: Kid[] =
    mode === "legal"
      ? [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 80 },
            children: [new TextRun({ text: "DRAFT FOR COUNSEL  ·  NOT EXECUTED  ·  NOT LEGAL ADVICE", font: "Calibri", size: 18, color: teal, bold: true, characterSpacing: 120 })],
          }),
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: title, font: "Calibri", bold: true, color: ink, size: 40 })],
          }),
          p(`${pack.brief.productName}  ·  ${pack.brief.clientName}  ·  ${pack.brief.vendorName}  ·  ${pack.generatedAt.slice(0, 10)}`, { color: muted, size: 20 }),
          p("Version 0.9 planning draft. Complete every [BRACKET] in Word (Find “[”). Delete OPTIONAL clauses you do not want. Execution requires authorised signatories. Generating this file does not form a contract."),
          table([
            ["Field", "Value"],
            ["Instrument", title],
            ["Programme", pack.brief.productName],
            ["Customer", pack.brief.clientName],
            ["Supplier", pack.brief.vendorName],
            ["Draft date", pack.generatedAt.slice(0, 10)],
            ["Classification", "Privileged — legal / commercial"],
            ["Status", "Draft — editable in Microsoft Word"],
          ]),
          ...extra,
        ]
      : [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 80 },
            children: [new TextRun({ text: pack.brief.vendorName.toUpperCase(), font: "Calibri", size: 18, color: teal, bold: true, characterSpacing: 240 })],
          }),
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: title, font: "Calibri", bold: true, color: ink, size: 44 })],
          }),
          p(`${pack.brief.productName}  ·  ${pack.brief.clientName}  ·  ${pack.generatedAt.slice(0, 10)}  ·  Confidential`, { color: muted, size: 20 }),
          p("Document control. Version 0.9 (planning). Status: draft until Client PO and Vendor delivery lead sign the last table in this file. Classification: Confidential — project team. Precedence: MSA (if any) on law and liability; this document on scope, design, and acceptance for its subject. After freeze, OpenAPI and running environments win over a picture."),
          table([
            ["Field", "Value"],
            ["Title", title],
            ["Product", pack.brief.productName],
            ["Client", pack.brief.clientName],
            ["Vendor", pack.brief.vendorName],
            ["Date", pack.generatedAt.slice(0, 10)],
            ["Deployment", pack.placeholders.deployment],
            ["Named users", pack.placeholders.users],
            ["Duration", pack.placeholders.duration],
          ]),
          p(pack.executiveSummary),
          p("Diagrams and wireframes in this file match the Architecture and Wireframes tabs."),
          ...extra,
        ];

  for (const s of sections) kids.push(...renderSection(s, pngs));

  if (mode === "pack") {
    kids.push(h("Assumptions"));
    kids.push(...bullets(pack.assumptions));
  } else {
    kids.push(h("Counsel checklist (not part of the operative terms)"));
    kids.push(
      ...bullets([
        "Replace every [BRACKET]. Do not execute with brackets remaining.",
        "Confirm forum: Dubai onshore / DIFC / ADGM / DIAC. Government issuers often mandate their courts and Arabic.",
        "Align liability caps and insurance with the Order Form Fees.",
        "PDPL Schedule 3 needs actual data types and sub-processors.",
        "This draft does not replace licensed UAE counsel.",
      ])
    );
  }

  return new Document({
    creator: pack.brief.vendorName,
    title,
    description: `${title} for ${pack.brief.productName}`,
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: `${title}  |  ${pack.brief.productName}`, font: "Calibri", size: 16, color: muted })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `${pack.brief.vendorName}  ·  confidential  ·  `, font: "Calibri", size: 16, color: muted }),
                  new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 16, color: muted }),
                ],
              }),
            ],
          }),
        },
        children: kids,
      },
    ],
  });
}

export async function sowDocx(pack: DeliveryPack) {
  return Packer.toBlob(await sectionsToDoc("Statement of Work", pack, pack.sow));
}

export async function ndaDocx(pack: DeliveryPack) {
  return Packer.toBlob(
    await sectionsToDoc("Mutual Non-Disclosure Agreement", pack, pack.nda, [], "legal")
  );
}

export async function msaDocx(pack: DeliveryPack) {
  return Packer.toBlob(
    await sectionsToDoc("Master Services Agreement", pack, pack.msa, [], "legal")
  );
}

export async function invoicesDocx(pack: DeliveryPack) {
  return Packer.toBlob(
    await sectionsToDoc("Invoices — pro forma, tax, credit note", pack, invoiceDocSections(pack.invoices), [], "legal")
  );
}

export async function hldDocx(pack: DeliveryPack) {
  return Packer.toBlob(await sectionsToDoc("High-Level Design", pack, pack.hld));
}

export async function lldDocx(pack: DeliveryPack) {
  const extra: Kid[] = [];
  extra.push(h("Annex A — Component catalogue"));
  extra.push(
    table([
      ["Component", "Layer", "Responsibility", "Technology", "Interfaces"],
      ...pack.components.map((c) => [c.name, c.layer, c.responsibility, c.tech, c.interfaces]),
    ])
  );
  extra.push(h("Annex B — API catalogue"));
  extra.push(
    table([
      ["Method", "Path", "Purpose", "Auth"],
      ...pack.apis.map((a) => [a.method, a.path, a.purpose, a.auth]),
    ])
  );
  return Packer.toBlob(await sectionsToDoc("Low-Level Design", pack, pack.lld, extra));
}

export async function brdDocx(pack: DeliveryPack) {
  return Packer.toBlob(await sectionsToDoc("Business Requirements Document", pack, pack.brd));
}

export async function prdDocx(pack: DeliveryPack) {
  const extra: Kid[] = [];
  extra.push(h("Annex — wireframe boards"));
  extra.push(
    p(
      "Import the SVG zip into Figma (Place) or paste each Stitch prompt at stitch.withgoogle.com and send to Figma. Boards are 1440×900."
    )
  );
  const pngs = await pngMap(
    { ...pack, diagrams: pack.wireframes.map((w) => ({ id: w.id, title: w.name, caption: w.purpose, width: w.width, height: w.height, svg: w.svg })) },
    pack.wireframes.map((w) => w.id)
  );
  for (const w of pack.wireframes.slice(0, 8)) {
    extra.push(p(`${w.name} — ${w.persona}. ${w.purpose}`, { size: 18, color: muted }));
    extra.push(p(w.layoutNotes, { size: 18, color: muted }));
    const hit = pngs.get(w.id);
    if (hit) extra.push(imagePara(hit.data, hit.diagram));
  }
  return Packer.toBlob(await sectionsToDoc("Product Requirements Document", pack, pack.prd, extra));
}

export async function defaultHouseTemplateDocx(pack?: DeliveryPack) {
  const doc = new Document({
    creator: "SoftEstimator Planner",
    title: "House document template",
    sections: [
      {
        children: [
          p("HOUSE TEMPLATE", { bold: true, size: 32, color: teal }),
          p("Keep each {{token}} in one Word run (avoid splitting with bold/colour mid-token). After you upload this file on the Template tab, generated text replaces the tokens. If a file has no tokens, the chosen artefact is appended at the end and your cover/headers stay."),
          p("Project: {{projectName}}"),
          p("Client: {{clientName}}"),
          p("Vendor: {{vendorName}}"),
          p("Date: {{date}}  ·  {{industry}}  ·  {{deployment}}"),
          p("Duration: {{duration}}  ·  Users: {{users}}"),
          p("Scope: {{scope}}"),
          h("Executive summary"),
          p("{{executiveSummary}}"),
          h("Chosen artefact (Template tab)"),
          p("{{content}}"),
          h("Constraints"),
          p("{{constraints}}"),
          h("Milestones"),
          p("{{milestones}}"),
          p("Effort: {{effortSummary}}"),
          ...TOKEN_HELP.map(([tok, meaning]) => p(`${tok} — ${meaning}`)),
          ...(pack ? [p(`Sample values generated for ${pack.brief.productName}.`)] : []),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}

export async function defaultHldTemplateDocx(pack?: DeliveryPack) {
  return defaultHouseTemplateDocx(pack);
}

function table(rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (r, i) =>
        new TableRow({
          children: r.map(
            (cell) =>
              new TableCell({
                borders,
                width: { size: Math.round(100 / r.length), type: WidthType.PERCENTAGE },
                shading: i === 0 ? { fill: "0D7377" } : undefined,
                children: [
                  new Paragraph({
                    spacing: { after: 40, before: 40 },
                    children: [
                      new TextRun({
                        text: cell,
                        font: "Calibri",
                        size: 17,
                        bold: i === 0,
                        color: i === 0 ? "FFFFFF" : ink,
                      }),
                    ],
                  }),
                ],
              })
          ),
        })
    ),
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
