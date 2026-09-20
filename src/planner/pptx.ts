import PptxGenJS from "pptxgenjs";
import { svgToPng } from "./diagrams";
import type { DeliveryPack } from "./types";

const BG = "0B1020";
const CARD = "162038";
const TEAL = "3DD6C6";
const TEXT = "E8EEFC";
const MUTED = "9AA8C7";
const GOLD = "F0B429";

export async function presentationPptx(pack: DeliveryPack) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "wide", width: 13.333, height: 7.5 });
  pptx.layout = "wide";
  pptx.author = pack.brief.vendorName;
  pptx.title = `${pack.brief.productName} — proposal`;
  pptx.subject = "Canva-importable proposal deck";

  pack.slides.forEach((s, idx) => {
    const slide = pptx.addSlide();
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: BG } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: TEAL } });
    slide.addText(s.kicker.toUpperCase(), {
      x: 0.7,
      y: 0.35,
      w: 11,
      h: 0.35,
      fontFace: "Calibri",
      fontSize: 12,
      color: TEAL,
      bold: true,
      charSpacing: 3,
    });
    slide.addText(s.title, {
      x: 0.7,
      y: 0.75,
      w: 12,
      h: 1.1,
      fontFace: "Calibri",
      fontSize: idx === 0 ? 40 : 32,
      color: TEXT,
      bold: true,
    });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.7,
      y: 2.05,
      w: 11.9,
      h: 4.7,
      fill: { color: CARD },
      rectRadius: 0.12,
    });
    slide.addText(
      s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
      {
        x: 1.0,
        y: 2.25,
        w: 11.3,
        h: 4.3,
        fontFace: "Calibri",
        fontSize: 18,
        color: TEXT,
        paraSpaceAfter: 10,
      }
    );
    slide.addText(`${pack.brief.vendorName}  ·  ${idx + 1}/${pack.slides.length}`, {
      x: 0.7,
      y: 7.05,
      w: 12,
      h: 0.28,
      fontFace: "Calibri",
      fontSize: 11,
      color: MUTED,
    });
    if (idx === 0) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 10.4,
        y: 0.35,
        w: 2.4,
        h: 0.4,
        fill: { color: GOLD },
        rectRadius: 0.08,
      });
      slide.addText("PROPOSAL", {
        x: 10.4,
        y: 0.38,
        w: 2.4,
        h: 0.34,
        fontFace: "Calibri",
        fontSize: 12,
        color: BG,
        bold: true,
        align: "center",
      });
    }
  });

  const arch = pptx.addSlide();
  arch.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: BG } });
  arch.addText("ARCHITECTURE", { x: 0.7, y: 0.35, w: 12, h: 0.3, fontFace: "Calibri", fontSize: 12, color: TEAL, bold: true });
  arch.addText("Logical view", { x: 0.7, y: 0.65, w: 12, h: 0.5, fontFace: "Calibri", fontSize: 28, color: TEXT, bold: true });
  const layers = [
    { y: 1.4, label: "Channels", items: ["Web", "Mobile", "Partners"] },
    { y: 2.55, label: "Edge", items: ["WAF / CDN", "API gateway", "Identity"] },
    { y: 3.7, label: "Domain", items: pack.moduleList.slice(0, 5) },
    { y: 4.85, label: "Data", items: ["PostgreSQL HA", "Redis", "Bus", "Object store"] },
  ];
  layers.forEach((layer) => {
    arch.addText(layer.label, { x: 0.4, y: layer.y + 0.25, w: 1.3, h: 0.4, fontFace: "Calibri", fontSize: 11, color: MUTED });
    layer.items.forEach((item, i) => {
      const x = 1.8 + i * 2.2;
      arch.addShape(pptx.ShapeType.roundRect, {
        x,
        y: layer.y,
        w: 2.05,
        h: 0.9,
        fill: { color: CARD },
        rectRadius: 0.08,
        line: { color: TEAL, width: 1 },
      });
      arch.addText(item, {
        x,
        y: layer.y + 0.25,
        w: 2.05,
        h: 0.45,
        fontFace: "Calibri",
        fontSize: 12,
        color: TEXT,
        align: "center",
        bold: true,
      });
    });
  });
  arch.addText(pack.placeholders.deployment, { x: 0.7, y: 6.9, w: 12, h: 0.3, fontFace: "Calibri", fontSize: 12, color: MUTED });

  for (const id of ["software", "network", "security-arch", "database", "reporting", "bi", "complaints", "erd", "logical", "sequence", "process"] as const) {
    const d = pack.diagrams.find((x) => x.id === id);
    if (!d) continue;
    try {
      const png = await svgToPng(d.svg, d.width, d.height);
      const s = pptx.addSlide();
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: BG } });
      s.addText(d.title.toUpperCase(), { x: 0.5, y: 0.25, w: 12, h: 0.28, fontFace: "Calibri", fontSize: 12, color: TEAL, bold: true });
      s.addText(d.caption, { x: 0.5, y: 0.52, w: 12.3, h: 0.35, fontFace: "Calibri", fontSize: 12, color: MUTED });
      const data = uint8ToBase64(png);
      s.addImage({ data: `image/png;base64,${data}`, x: 0.45, y: 0.95, w: 12.4, h: 6.2 });
    } catch {
      /* skip raster failure */
    }
  }

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  return blob;
}

function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
