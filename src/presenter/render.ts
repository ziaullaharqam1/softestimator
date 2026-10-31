import PptxGenJS from "pptxgenjs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { downloadBlob } from "../planner/word";
import { aed, type Block, type Deck, type Slide } from "./deck";
import { BRAND } from "./diagram";

export interface Logo {
  dataUrl: string;
  w: number;
  h: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SERIES = "#2F5D9E";
const NUMERIC = /^(AED -?[\d,.]+[kM]?|-?[\d,.]+%?)$/;

// ---------------------------------------------------------------- HTML (preview + PDF)

function barsSvg(items: { label: string; value: number; highlight?: boolean }[]) {
  const W = 560;
  const lw = 120;
  const bh = 34;
  const gap = 16;
  const max = Math.max(...items.map((i) => i.value), 1) * 1.35;
  const h = items.length * (bh + gap);
  return `<svg viewBox="0 0 ${W} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif">${items
    .map((it, i) => {
      const y = i * (bh + gap);
      const w = Math.max(4, (it.value / max) * (W - lw - 10));
      return `<text x="${lw - 10}" y="${y + bh / 2 + 5}" text-anchor="end" font-size="14" fill="${BRAND.ink2}">${esc(it.label)}</text>
<rect x="${lw}" y="${y}" width="${w}" height="${bh}" rx="4" fill="${it.highlight ? BRAND.green : SERIES}"/>
<text x="${lw + w + 8}" y="${y + bh / 2 + 5}" font-size="14" font-weight="700" fill="${BRAND.navy}">${esc(aed(it.value))}</text>`;
    })
    .join("")}</svg>`;
}

function blockHtml(b: Block): string {
  switch (b.kind) {
    case "bullets":
      return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
    case "note":
      return `<p class="note">${esc(b.text)}</p>`;
    case "kpis":
      return `<div class="kpis">${b.items.map((k) => `<div class="kpi"><div class="kl">${esc(k.label)}</div><div class="kv">${esc(k.value)}</div><div class="ks">${esc(k.sub ?? "")}</div></div>`).join("")}</div>`;
    case "table": {
      const num = (c: string) => NUMERIC.test(c);
      const numCol = b.headers.map((_, i) => b.rows.length > 0 && b.rows.every((r) => num(r[i] ?? "") || (r[i] ?? "") === ""));
      const row = (r: string[], tag: "td" | "th") => `<tr>${r.map((c, i) => `<${tag} class="${(tag === "td" && num(c)) || (tag === "th" && numCol[i]) ? "r" : ""}">${esc(c)}</${tag}>`).join("")}</tr>`;
      return `<table><thead>${row(b.headers, "th")}</thead><tbody>${b.rows.map((r) => row(r, "td")).join("")}${b.total ? `<tr class="total">${b.total.map((c) => `<td class="${num(c) ? "r" : ""}">${esc(c)}</td>`).join("")}</tr>` : ""}</tbody></table>`;
    }
    case "images":
      return `<div class="shots">${b.items.map((s) => `<figure><img src="${s.dataUrl}" alt="${esc(s.caption || s.name)}"><figcaption>${esc(s.caption || s.name)}</figcaption></figure>`).join("")}</div>`;
    case "diagram":
      return `<div class="diagram">${b.svg}</div>`;
    case "bars":
      return barsSvg(b.items);
    case "cols":
      return `<div class="cols"><div>${b.left.map(blockHtml).join("")}</div><div>${b.right.map(blockHtml).join("")}</div></div>`;
  }
}

function coverHtml(deck: Deck, logo: Logo | null) {
  const mark = logo
    ? `<img class="cover-logo" src="${logo.dataUrl}" alt="Client logo">`
    : `<div class="cover-mark"><span></span><span></span><span></span></div>`;
  return `<section class="slide cover"><div class="band"></div><div class="cover-inner">${mark}<div>
<div class="kicker">Cost estimate &amp; solution</div><h1>${esc(deck.title)}</h1><p class="lead">${esc(deck.subtitle)}</p><p class="meta">${esc(deck.meta)}</p></div></div></section>`;
}

function slideHtml(s: Slide, n: number, deck: Deck, logo: Logo | null) {
  return `<section class="slide"><header><div><div class="kicker">${esc(s.kicker)}</div><h2>${esc(s.title)}</h2></div>${
    logo ? `<img class="corner" src="${logo.dataUrl}" alt="">` : ""
  }</header><div class="body">${s.blocks.map(blockHtml).join("")}</div>
<footer><span>${esc(deck.footer)}</span><span>${esc(deck.meta)}</span><span>${n}</span></footer></section>`;
}

const CSS = `
*{box-sizing:border-box}html,body{margin:0;background:#fff;color:${BRAND.navy};font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}
.slide{width:1280px;height:720px;position:relative;overflow:hidden;background:#fff;padding:36px 56px 0;display:flex;flex-direction:column;page-break-after:always}
.slide header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${BRAND.green};padding-bottom:10px;margin-bottom:16px}
.slide h2{margin:2px 0 0;font-size:28px;letter-spacing:-.3px}
.kicker{font-size:12px;text-transform:uppercase;letter-spacing:1.4px;color:${BRAND.blue};font-weight:700}
.corner{height:44px;max-width:120px;object-fit:contain;border-radius:8px}
.body{flex:1;overflow:hidden;font-size:15px;color:${BRAND.ink2}}
.slide footer{height:38px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:${BRAND.muted};border-top:1px solid ${BRAND.rule}}
ul{margin:0 0 8px;padding-left:20px}li{margin:0 0 8px;line-height:1.42}
.note{font-size:12px;color:${BRAND.muted};margin:8px 0}
.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
.kpi{border:1px solid ${BRAND.rule};border-left:5px solid ${BRAND.green};border-radius:8px;padding:10px 14px}
.kl{font-size:11px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:.8px}.kv{font-size:22px;font-weight:700;margin:4px 0 2px;color:${BRAND.navy}}.ks{font-size:11px;color:${BRAND.muted}}
table{border-collapse:collapse;width:100%;font-size:11px;margin-bottom:8px}th{background:${BRAND.navy};color:#fff;text-align:left;padding:5px 7px;font-weight:600}th.r{text-align:right}
td{padding:4px 7px;border-bottom:1px solid ${BRAND.rule};vertical-align:top}tr:nth-child(even) td{background:#F7F9FB}
td.r{text-align:right;white-space:nowrap}tr.total td{font-weight:700;color:${BRAND.navy};background:#EEF6E8!important;border-top:2px solid ${BRAND.green}}
.shots{display:grid;grid-template-columns:1fr 1fr;gap:24px;height:100%}figure{margin:0;display:flex;flex-direction:column;align-items:center}
figure img{max-width:100%;max-height:520px;object-fit:contain;border:1px solid ${BRAND.rule};border-radius:8px}figcaption{font-size:13px;color:${BRAND.muted};margin-top:8px}
.diagram svg{width:100%;height:auto;max-height:540px}
.cover{padding:0}.band{position:absolute;left:0;top:0;bottom:0;width:18px;background:linear-gradient(${BRAND.blue} 0 33%,#fff 33% 34%,${BRAND.green} 34% 100%)}
.cover-inner{display:flex;gap:56px;align-items:center;height:100%;padding:0 100px}
.cover-logo{width:220px;height:220px;object-fit:contain;border-radius:36px;flex:none}
.cover-mark{display:flex;gap:14px;align-items:flex-end;height:160px;flex:none}.cover-mark span{width:34px;border-radius:17px}
.cover-mark span:nth-child(1){height:60px;background:${BRAND.blue}}.cover-mark span:nth-child(2){height:100px;background:${BRAND.navy}}.cover-mark span:nth-child(3){height:150px;background:${BRAND.green}}
.cover h1{font-size:46px;line-height:1.1;margin:10px 0 16px;letter-spacing:-.6px}.lead{font-size:19px;color:${BRAND.ink2};max-width:760px;line-height:1.45}.meta{font-size:13px;color:${BRAND.muted};margin-top:24px}
`;

export function deckHtml(deck: Deck, logo: Logo | null) {
  const body = [coverHtml(deck, logo), ...deck.slides.map((s, i) => slideHtml(s, i + 2, deck, logo))].join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(deck.title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

export async function downloadPdf(deck: Deck, logo: Logo | null, filename: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", left: "-14000px", top: "0", width: "1280px", height: "720px", border: "0" });
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("Could not create PDF frame.");
    doc.open();
    doc.write(deckHtml(deck, logo));
    doc.close();
    await Promise.all(Array.from(doc.images).map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = () => r(null); }))));
    await new Promise((r) => setTimeout(r, 150));
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1280, 720], hotfixes: ["px_scaling"], compress: true });
    const slides = Array.from(doc.querySelectorAll<HTMLElement>(".slide"));
    for (let i = 0; i < slides.length; i++) {
      const canvas = await html2canvas(slides[i], { scale: 1.5, backgroundColor: "#ffffff", logging: false, width: 1280, height: 720, windowWidth: 1280 });
      if (i > 0) pdf.addPage([1280, 720], "landscape");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 1280, 720);
    }
    downloadBlob(pdf.output("blob"), filename);
  } finally {
    iframe.remove();
  }
}

// ---------------------------------------------------------------- PPTX (Canva import)

const C = { navy: "0B1F3B", blue: "2A9FC6", green: "4CB819", gold: "D9A21B", ink2: "3D4B5E", muted: "6B7685", rule: "E3E8EE", series: "2F5D9E", zebra: "F7F9FB", totalBg: "EEF6E8" };
const FONT = "Arial";
const X0 = 0.6;
const W0 = 12.13;
const Y0 = 1.45;
const YMAX = 6.85;

function svgPng(svg: string, w: number, h: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = w * 2;
      cv.height = h * 2;
      const ctx = cv.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("diagram render failed"));
    };
    img.src = url;
  });
}

const lines = (text: string, widthIn: number, pt: number) => Math.max(1, Math.ceil(text.length / Math.max(8, (widthIn * 120) / pt)));

type PSlide = ReturnType<PptxGenJS["addSlide"]>;

async function drawBlock(pptx: PptxGenJS, slide: PSlide, b: Block, x: number, y: number, w: number, png: Map<string, string>): Promise<number> {
  const room = YMAX - y;
  switch (b.kind) {
    case "note": {
      slide.addText(b.text, { x, y, w, h: 0.35, fontFace: FONT, fontSize: 10, color: C.muted, valign: "top" });
      return y + 0.4;
    }
    case "bullets": {
      let pt = 14;
      const est = (p: number) => b.items.reduce((a, t) => a + lines(t, w - 0.3, p), 0) * (p / 72) * 1.55 + 0.1;
      while (pt > 10 && est(pt) > room) pt -= 1;
      const h = Math.min(room, est(pt));
      slide.addText(
        b.items.map((t) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: true, paraSpaceAfter: 6 } })),
        { x, y, w, h, fontFace: FONT, fontSize: pt, color: C.ink2, valign: "top" }
      );
      return y + h + 0.1;
    }
    case "kpis": {
      const n = b.items.length;
      const cw = (w - 0.2 * (n - 1)) / n;
      b.items.forEach((k, i) => {
        const cx = x + i * (cw + 0.2);
        slide.addShape(pptx.ShapeType.rect, { x: cx, y, w: cw, h: 1.0, fill: { color: "FFFFFF" }, line: { color: C.rule, width: 1 } });
        slide.addShape(pptx.ShapeType.rect, { x: cx, y, w: 0.07, h: 1.0, fill: { color: C.green }, line: { color: C.green, width: 0 } });
        slide.addText(k.label.toUpperCase(), { x: cx + 0.18, y: y + 0.06, w: cw - 0.25, h: 0.25, fontFace: FONT, fontSize: 9, color: C.muted, charSpacing: 1 });
        slide.addText(k.value, { x: cx + 0.18, y: y + 0.3, w: cw - 0.25, h: 0.4, fontFace: FONT, fontSize: 18, bold: true, color: C.navy, fit: "shrink" });
        if (k.sub) slide.addText(k.sub, { x: cx + 0.18, y: y + 0.68, w: cw - 0.25, h: 0.26, fontFace: FONT, fontSize: 9, color: C.muted });
      });
      return y + 1.2;
    }
    case "table": {
      const cols = b.headers.length;
      const rel = b.widths ?? Array(cols).fill(1);
      const sum = rel.reduce((a, v) => a + v, 0);
      const colW = rel.map((v) => (v / sum) * w);
      const all = [b.headers, ...b.rows, ...(b.total ? [b.total] : [])];
      let pt = cols > 5 ? 9 : 10;
      const rowH = (r: string[], p: number) => Math.max(...r.map((c, i) => lines(c, colW[i] - 0.1, p))) * (p / 72) * 1.35 + 0.08;
      const height = (p: number) => all.reduce((a, r) => a + rowH(r, p), 0);
      while (pt > 7 && height(pt) > room) pt -= 1;
      const isNum = (s: string) => NUMERIC.test(s);
      const numCol = b.headers.map((_, i) => b.rows.length > 0 && b.rows.every((r) => isNum(r[i] ?? "") || (r[i] ?? "") === ""));
      const rows: PptxGenJS.TableRow[] = all.map((r, ri) =>
        r.map((cell, ci) => {
          const head = ri === 0;
          const total = !!b.total && ri === all.length - 1;
          return {
            text: cell,
            options: {
              bold: head || total,
              color: head ? "FFFFFF" : total ? C.navy : C.ink2,
              fill: { color: head ? C.navy : total ? C.totalBg : ri % 2 === 0 ? C.zebra : "FFFFFF" },
              align: (head && numCol[ci]) || (!head && isNum(cell)) ? "right" : "left",
            },
          };
        })
      );
      const h = Math.min(room, height(pt));
      slide.addTable(rows, { x, y, w, colW, fontFace: FONT, fontSize: pt, border: { type: "solid", pt: 0.5, color: C.rule }, margin: 0.04, valign: "top", autoPage: false });
      return y + h + 0.15;
    }
    case "bars": {
      const lw = 1.3;
      const bh = 0.42;
      const gap = 0.22;
      const max = Math.max(...b.items.map((i) => i.value), 1) * 1.4;
      b.items.forEach((it, i) => {
        const by = y + i * (bh + gap);
        const bw = Math.max(0.05, (it.value / max) * (w - lw - 0.1));
        slide.addText(it.label, { x, y: by, w: lw - 0.1, h: bh, fontFace: FONT, fontSize: 12, color: C.ink2, align: "right", valign: "middle" });
        slide.addShape(pptx.ShapeType.rect, { x: x + lw, y: by, w: bw, h: bh, fill: { color: it.highlight ? C.green : C.series }, line: { color: it.highlight ? C.green : C.series, width: 0 } });
        slide.addText(aed(it.value), { x: x + lw + bw + 0.05, y: by, w: 1.8, h: bh, fontFace: FONT, fontSize: 12, bold: true, color: C.navy, valign: "middle" });
      });
      return y + b.items.length * (bh + gap) + 0.1;
    }
    case "images": {
      const n = b.items.length;
      const cw = n === 1 ? w : (w - 0.3) / 2;
      const ch = room - 0.4;
      b.items.forEach((s, i) => {
        const r = Math.min(cw / s.w, ch / s.h);
        const iw = s.w * r;
        const ih = s.h * r;
        const cx = x + i * (cw + 0.3) + (cw - iw) / 2;
        slide.addImage({ data: s.dataUrl, x: cx, y, w: iw, h: ih });
        slide.addText(s.caption || s.name, { x: x + i * (cw + 0.3), y: y + ih + 0.05, w: cw, h: 0.3, fontFace: FONT, fontSize: 11, color: C.muted, align: "center" });
      });
      return YMAX;
    }
    case "diagram": {
      const data = png.get(b.svg) ?? (await svgPng(b.svg, b.w, b.h));
      const r = Math.min(w / b.w, (room - 0.45) / b.h);
      slide.addImage({ data, x: x + (w - b.w * r) / 2, y, w: b.w * r, h: b.h * r });
      return y + b.h * r + 0.1;
    }
    case "cols": {
      const half = (w - 0.35) / 2;
      let yl = y;
      for (const lb of b.left) yl = await drawBlock(pptx, slide, lb, x, yl, half, png);
      let yr = y;
      for (const rb of b.right) yr = await drawBlock(pptx, slide, rb, x + half + 0.35, yr, half, png);
      return Math.max(yl, yr);
    }
  }
}

export async function downloadPptx(deck: Deck, logo: Logo | null, filename: string) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "WIDE";
  pptx.title = deck.title;
  pptx.subject = "Cost estimation & solution deck (Canva-importable)";
  pptx.company = deck.footer;

  const png = new Map<string, string>();
  for (const s of deck.slides) for (const b of s.blocks) if (b.kind === "diagram") png.set(b.svg, await svgPng(b.svg, b.w, b.h));

  // Cover
  const cover = pptx.addSlide();
  cover.background = { color: "FFFFFF" };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.19, h: 2.45, fill: { color: C.blue }, line: { color: C.blue, width: 0 } });
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 2.55, w: 0.19, h: 4.95, fill: { color: C.green }, line: { color: C.green, width: 0 } });
  let tx = 1.0;
  if (logo) {
    const r = Math.min(2.3 / logo.w, 2.3 / logo.h);
    cover.addImage({ data: logo.dataUrl, x: 1.0 + (2.3 - logo.w * r) / 2, y: 2.6 + (2.3 - logo.h * r) / 2, w: logo.w * r, h: logo.h * r });
    tx = 3.9;
  }
  cover.addText("COST ESTIMATE & SOLUTION", { x: tx, y: 2.35, w: 9, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: C.blue, charSpacing: 2 });
  cover.addText(deck.title, { x: tx, y: 2.75, w: 13.0 - tx, h: 1.4, fontFace: FONT, fontSize: 36, bold: true, color: C.navy, valign: "top", fit: "shrink" });
  cover.addText(deck.subtitle, { x: tx, y: 4.2, w: 13.0 - tx, h: 0.8, fontFace: FONT, fontSize: 16, color: C.ink2, valign: "top" });
  cover.addText(deck.meta, { x: tx, y: 5.2, w: 13.0 - tx, h: 0.3, fontFace: FONT, fontSize: 11, color: C.muted });

  for (let i = 0; i < deck.slides.length; i++) {
    const s = deck.slides[i];
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addText(s.kicker.toUpperCase(), { x: X0, y: 0.35, w: 10, h: 0.28, fontFace: FONT, fontSize: 11, bold: true, color: C.blue, charSpacing: 2 });
    slide.addText(s.title, { x: X0, y: 0.62, w: logo ? 10.9 : W0, h: 0.55, fontFace: FONT, fontSize: 24, bold: true, color: C.navy, fit: "shrink" });
    slide.addShape(pptx.ShapeType.line, { x: X0, y: 1.25, w: W0, h: 0, line: { color: C.green, width: 2.5 } });
    if (logo) {
      const r = Math.min(0.6 / logo.w, 0.6 / logo.h);
      slide.addImage({ data: logo.dataUrl, x: X0 + W0 - logo.w * r, y: 0.45, w: logo.w * r, h: logo.h * r });
    }
    let y = Y0;
    for (const b of s.blocks) y = await drawBlock(pptx, slide, b, X0, y, W0, png);
    slide.addShape(pptx.ShapeType.line, { x: X0, y: 7.0, w: W0, h: 0, line: { color: C.rule, width: 0.75 } });
    slide.addText(deck.footer, { x: X0, y: 7.05, w: 4.5, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted });
    slide.addText(deck.meta, { x: X0 + 4.5, y: 7.05, w: 5.5, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted, align: "center" });
    slide.addText(String(i + 2), { x: X0 + W0 - 1, y: 7.05, w: 1, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted, align: "right" });
  }

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  downloadBlob(blob, filename);
}
