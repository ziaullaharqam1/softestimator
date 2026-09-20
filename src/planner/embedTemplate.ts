import JSZip from "jszip";
import * as XLSX from "xlsx";
import type { DeliveryPack, DocSection } from "./types";
import { ARTEFACTS, flattenArtefact, tokenMap, type ArtefactId } from "./tokens";

export type EmbedResult = {
  blob: Blob;
  filename: string;
  filledKeys: string[];
  appended: boolean;
  format: string;
  message: string;
};

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xmlBreaks(s: string) {
  return escapeXml(s).replace(/\r?\n/g, "</w:t><w:br/><w:t xml:space=\"preserve\">");
}

function pptBreaks(s: string) {
  return escapeXml(s).replace(/\r?\n/g, "</a:t></a:r></a:p><a:p><a:r><a:t>");
}

const TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
const ALT_RE = /\[\[\s*([A-Za-z0-9_]+)\s*\]\]/g;

function lookup(map: Record<string, string>, raw: string) {
  const key = raw.replace(/\s+/g, "");
  if (map[key] != null) return map[key];
  const lower = Object.keys(map).find((k) => k.toLowerCase() === key.toLowerCase());
  return lower ? map[lower] : null;
}

function applyPlain(text: string, map: Record<string, string>, hit: Set<string>) {
  const sub = (_: string, inner: string) => {
    const v = lookup(map, inner);
    if (v == null) return `{{${inner}}}`;
    hit.add(inner.replace(/\s+/g, ""));
    return v;
  };
  return text.replace(TOKEN_RE, sub).replace(ALT_RE, sub);
}

function applyXml(xml: string, map: Record<string, string>, hit: Set<string>, kind: "word" | "ppt") {
  let out = xml.replace(/\{\{([\s\S]*?)\}\}/g, (full, inner: string) => {
    const key = inner.replace(/<[^>]+>/g, "").replace(/\s+/g, "").trim();
    const v = lookup(map, key);
    if (v == null) return full;
    hit.add(key);
    return kind === "word" ? xmlBreaks(v) : pptBreaks(v);
  });
  out = out.replace(/\[\[([\s\S]*?)\]\]/g, (full, inner: string) => {
    const key = inner.replace(/<[^>]+>/g, "").replace(/\s+/g, "").trim();
    const v = lookup(map, key);
    if (v == null) return full;
    hit.add(key);
    return kind === "word" ? xmlBreaks(v) : pptBreaks(v);
  });
  return out;
}

function wP(text: string, heading = false) {
  const pr = heading
    ? `<w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0D7377"/></w:rPr>`
    : `<w:r><w:rPr><w:sz w:val="22"/></w:rPr>`;
  return `<w:p>${pr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function wTbl(headers: string[], rows: string[][]) {
  const cell = (t: string, hdr: boolean) =>
    `<w:tc><w:tcPr><w:shd w:val="clear" w:fill="${hdr ? "0D7377" : "FFFFFF"}"/></w:tcPr><w:p><w:r><w:rPr>${
      hdr ? `<w:b/><w:color w:val="FFFFFF"/>` : ""
    }</w:rPr><w:t xml:space="preserve">${escapeXml(t)}</w:t></w:r></w:p></w:tc>`;
  const row = (cells: string[], hdr: boolean) => `<w:tr>${cells.map((c) => cell(c, hdr)).join("")}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr>${row(headers, true)}${rows
    .map((r) => row(r, false))
    .join("")}</w:tbl>`;
}

function sectionsToWordXml(sections: DocSection[]) {
  const parts: string[] = [];
  for (const s of sections) {
    parts.push(wP(s.heading, true));
    parts.push(wP(s.body));
    for (const para of s.paragraphs ?? []) parts.push(wP(para));
    for (const n of s.numbered ?? []) parts.push(wP(n));
    for (const n of s.bullets ?? []) parts.push(wP(`• ${n}`));
    if (s.table) {
      parts.push(wP(s.table.caption));
      parts.push(wTbl(s.table.headers, s.table.rows));
    }
  }
  return parts.join("");
}

function artefactXml(pack: DeliveryPack, id: Exclude<ArtefactId, "content">): string {
  if (id === "sow") return sectionsToWordXml(pack.sow);
  if (id === "nda") return sectionsToWordXml(pack.nda);
  if (id === "msa") return sectionsToWordXml(pack.msa);
  if (id === "hld") return sectionsToWordXml(pack.hld);
  if (id === "lld") return sectionsToWordXml(pack.lld);
  if (id === "brd") return sectionsToWordXml(pack.brd);
  if (id === "prd") return sectionsToWordXml(pack.prd);
  if (id === "pack") {
    return ARTEFACTS.filter((a) => a.id !== "content" && a.id !== "pack")
      .map((a) => artefactXml(pack, a.id as Exclude<ArtefactId, "content">))
      .join("");
  }
  const text = flattenArtefact(pack, id);
  return text.split(/\n{2,}/).map((p) => wP(p)).join("");
}

function artefactForHint(tabHint?: string): Exclude<ArtefactId, "content"> {
  if (tabHint && tabHint !== "content" && ARTEFACTS.some((a) => a.id === tabHint)) {
    return tabHint as Exclude<ArtefactId, "content">;
  }
  return "pack";
}

function resolveContent(pack: DeliveryPack, artefact: ArtefactId, tabHint?: string) {
  const id = artefact === "content" ? artefactForHint(tabHint) : artefact;
  return flattenArtefact(pack, id);
}

function resolveXml(pack: DeliveryPack, artefact: ArtefactId, tabHint?: string) {
  const id = artefact === "content" ? artefactForHint(tabHint) : artefact;
  return artefactXml(pack, id);
}

async function embedDocx(file: File, pack: DeliveryPack, map: Record<string, string>, artefact: ArtefactId, tabHint?: string): Promise<EmbedResult> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const targets = Object.keys(zip.files).filter((n) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n));
  const hit = new Set<string>();
  let hadToken = false;
  for (const name of targets) {
    const f = zip.file(name);
    if (!f) continue;
    const xml = await f.async("string");
    if (TOKEN_RE.test(xml) || ALT_RE.test(xml) || /\{\{/.test(xml)) hadToken = true;
    TOKEN_RE.lastIndex = 0;
    zip.file(name, applyXml(xml, map, hit, "word"));
  }
  let appended = false;
  const docFile = zip.file("word/document.xml");
  if (docFile && hit.size === 0 && !hadToken) {
    const xml = await docFile.async("string");
    const inject =
      wP("Embedded from SoftEstimator (template had no {{placeholders}} — original cover, headers and styles kept)", true) +
      resolveXml(pack, artefact, tabHint);
    if (xml.includes("</w:body>")) {
      zip.file("word/document.xml", xml.replace("</w:body>", `${inject}</w:body>`));
      appended = true;
    }
  }
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  return {
    blob,
    filename: file.name.replace(/\.docx$/i, "") + "-filled.docx",
    filledKeys: [...hit],
    appended,
    format: "docx",
    message: appended
      ? `No {{placeholders}} in ${file.name}. Appended ${artefact === "content" ? tabHint ?? "pack" : artefact} before the end of the body. Cover and styles kept.`
      : hit.size
        ? `Filled ${hit.size} placeholder${hit.size === 1 ? "" : "s"} in ${file.name}: ${[...hit].slice(0, 12).join(", ")}.`
        : `Opened ${file.name}. Placeholders were present but none matched known keys — file unchanged except scan. Use {{content}} or {{sow}} / {{hld}} / {{nda}}.`,
  };
}

async function embedPptx(file: File, map: Record<string, string>): Promise<EmbedResult> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const targets = Object.keys(zip.files).filter((n) => /^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+|slideMasters\/slideMaster\d+|slideLayouts\/slideLayout\d+)\.xml$/.test(n));
  const hit = new Set<string>();
  for (const name of targets) {
    const f = zip.file(name);
    if (!f) continue;
    zip.file(name, applyXml(await f.async("string"), map, hit, "ppt"));
  }
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  return {
    blob,
    filename: file.name.replace(/\.pptx$/i, "") + "-filled.pptx",
    filledKeys: [...hit],
    appended: false,
    format: "pptx",
    message: hit.size
      ? `Filled ${hit.size} placeholder(s) in ${file.name}.`
      : `No matching {{placeholders}} on slides. Add {{content}} or {{projectName}} on a slide, then embed again.`,
  };
}

async function embedXlsx(file: File, pack: DeliveryPack, map: Record<string, string>, artefact: ArtefactId, tabHint?: string): Promise<EmbedResult> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const hit = new Set<string>();
  let hadToken = false;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const ref = ws["!ref"];
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell || cell.v == null) continue;
        const raw = String(cell.v);
        if (TOKEN_RE.test(raw) || ALT_RE.test(raw)) hadToken = true;
        TOKEN_RE.lastIndex = 0;
        const next = applyPlain(raw, map, hit);
        if (next !== raw) {
          cell.v = next;
          cell.t = "s";
          if (cell.w) delete cell.w;
        }
      }
    }
  }
  let appended = false;
  if (hit.size === 0 && !hadToken) {
    const text = resolveContent(pack, artefact, tabHint);
    const rows: string[][] = [["Embedded from SoftEstimator"], ["Artefact", artefact], [], ...text.split("\n").map((line: string) => [line])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Embedded");
    appended = true;
  }
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return {
    blob: new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename: file.name.replace(/\.xlsx?$/i, "") + "-filled.xlsx",
    filledKeys: [...hit],
    appended,
    format: "xlsx",
    message: appended
      ? `No {{placeholders}} in cells. Added an Embedded sheet with ${artefact === "content" ? tabHint ?? "pack" : artefact}.`
      : `Filled ${hit.size} cell placeholder(s) in ${file.name}.`,
  };
}

function embedText(file: File, text: string, map: Record<string, string>, pack: DeliveryPack, artefact: ArtefactId, tabHint?: string): EmbedResult {
  const hit = new Set<string>();
  const hadToken = TOKEN_RE.test(text) || ALT_RE.test(text);
  TOKEN_RE.lastIndex = 0;
  let next = applyPlain(text, map, hit);
  let appended = false;
  if (hit.size === 0 && !hadToken) {
    next = `${text}\n\n----- Embedded (${artefact}) -----\n\n${resolveContent(pack, artefact, tabHint)}`;
    appended = true;
  }
  const name = file.name.replace(/(\.[^.]+)?$/, "") + "-filled" + (file.name.match(/\.[^.]+$/)?.[0] ?? ".txt");
  return {
    blob: new Blob([next], { type: "text/plain;charset=utf-8" }),
    filename: name,
    filledKeys: [...hit],
    appended,
    format: "text",
    message: appended ? `Appended generated ${artefact} to ${file.name}.` : `Filled ${hit.size} placeholder(s) in ${file.name}.`,
  };
}

export async function embedTemplate(
  file: File,
  pack: DeliveryPack,
  artefact: ArtefactId,
  tabHint?: string
): Promise<EmbedResult> {
  const content = resolveContent(pack, artefact, tabHint);
  const map = tokenMap(pack, content);
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return embedDocx(file, pack, map, artefact, tabHint);
  if (name.endsWith(".pptx")) return embedPptx(file, map);
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".xlsm")) {
    return embedXlsx(file, pack, map, artefact, tabHint);
  }
  if (name.endsWith(".pdf")) {
    throw new Error("PDF templates cannot be merged in the browser. Upload .docx, .pptx, .xlsx, or .txt/.md with {{placeholders}}.");
  }
  const text = await file.text();
  return embedText(file, text, map, pack, artefact, tabHint);
}

export async function fillDocxTemplate(file: File, pack: DeliveryPack) {
  const result = await embedTemplate(file, pack, "hld", "hld");
  return { blob: result.blob, usedPlaceholders: result.filledKeys.length > 0 || result.appended, result };
}
