import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { downloadBlob } from "./word";

export function openPrintPreview(html: string) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=980,height=1200");
  if (!w) throw new Error("Allow pop-ups to open print preview.");
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}

export async function downloadPdfFromHtml(html: string, filename: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-12000px";
  iframe.style.top = "0";
  iframe.style.width = "210mm";
  iframe.style.height = "297mm";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    throw new Error("Could not create PDF frame.");
  }
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    setTimeout(() => resolve(), 500);
  });
  await new Promise((r) => setTimeout(r, 120));

  const sheets = Array.from(doc.querySelectorAll<HTMLElement>(".sheet"));
  const root = doc.getElementById("print-root");
  const targets = sheets.length ? sheets : root ? [root] : [];
  if (!targets.length) {
    iframe.remove();
    throw new Error("Nothing to put in the PDF.");
  }

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const pageW = 210;
  const pageH = 297;
  let pageIndex = 0;
  for (const el of targets) {
    const canvas = await html2canvas(el, {
      scale: 1.6,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: Math.max(el.scrollWidth, 794),
      windowHeight: Math.max(el.scrollHeight, 200),
    });
    const img = canvas.toDataURL("image/jpeg", 0.86);
    const imgH = (canvas.height * pageW) / canvas.width;
    let heightLeft = imgH;
    let position = 0;
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(img, "JPEG", 0, position, pageW, imgH);
    pageIndex += 1;
    heightLeft -= pageH;
    while (heightLeft > 1) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, position, pageW, imgH);
      pageIndex += 1;
      heightLeft -= pageH;
    }
  }
  iframe.remove();
  downloadBlob(pdf.output("blob"), filename);
}
