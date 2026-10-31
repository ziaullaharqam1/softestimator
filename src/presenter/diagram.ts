import type { ArchitectureStyle } from "../architecture";
import { option, serviceName, type FilterKey, type Hosting, type Selections } from "./catalog";
import type { Block } from "./deck";

export const BRAND = { navy: "#0B1F3B", blue: "#2A9FC6", green: "#4CB819", gold: "#D9A21B", ink2: "#3D4B5E", muted: "#6B7685", rule: "#E3E8EE" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function box(x: number, y: number, w: number, h: number, title: string, sub = "", fill = "#FFFFFF", stroke = BRAND.blue) {
  const t = esc(title.length > 30 ? `${title.slice(0, 29)}…` : title);
  const st = esc(sub.length > 36 ? `${sub.slice(0, 35)}…` : sub);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
<text x="${x + w / 2}" y="${y + h / 2 + (sub ? -3 : 5)}" text-anchor="middle" font-size="13" font-weight="600" fill="${BRAND.navy}">${t}</text>${
    sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="11" fill="${BRAND.muted}">${st}</text>` : ""
  }`;
}

const arrow = (x1: number, y1: number, x2: number, y2: number) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${BRAND.muted}" stroke-width="1.5" marker-end="url(#ah)"/>`;

const RUNTIME: Record<Hosting, string> = { aws: "EKS", azure: "AKS", gcp: "GKE", onprem: "Kubernetes (RKE2)" };
const VMS: Record<Hosting, string> = { aws: "EC2", azure: "Azure VMs", gcp: "Compute Engine", onprem: "Proxmox VMs" };
const DR_SITE: Record<Hosting, string> = { aws: "me-south-1", azure: "UAE Central", gcp: "me-central2", onprem: "Secondary DC" };

export function architectureSvg(arch: ArchitectureStyle, h: Hosting, s: Selections): Extract<Block, { kind: "diagram" }> {
  const W = 1180;
  const H = 520;
  const svc = (k: Exclude<FilterKey, "aiTooling">) => (s[k] === "none" ? "" : serviceName(k, s[k], h));
  const lbl = (k: Exclude<FilterKey, "aiTooling">) => option(k, s[k])?.label ?? "";
  const g: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif">`,
    `<rect width="${W}" height="${H}" fill="#FFFFFF"/>`,
    `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${BRAND.muted}"/></marker></defs>`,
  ];

  // Clients
  const clients: [string, string][] = [];
  if (s.mobile !== "none") clients.push(["Mobile apps", lbl("mobile")]);
  if (s.frontend !== "none") clients.push(["Web / admin portal", lbl("frontend")]);
  clients.push(["Partners / ops staff", "API · SSO + MFA"]);
  clients.forEach(([t, st], i) => g.push(box(10, 50 + i * 90, 170, 58, t, st)));

  // Edge
  const edge = svc("cdnWaf") || "TLS edge";
  g.push(box(220, 95, 180, 58, s.cdnWaf === "none" ? "Edge / TLS" : "CDN + WAF", edge));
  g.push(box(220, 205, 180, 58, "Load balancer", svc("loadBalancer")));
  clients.forEach((_, i) => g.push(arrow(180, 79 + i * 90, 220, i === 0 ? 124 : 134)));
  g.push(arrow(310, 153, 310, 205));

  // Application tier
  g.push(`<rect x="440" y="20" width="420" height="340" rx="10" fill="#F3FAEE" stroke="${BRAND.green}" stroke-dasharray="5 4"/>`);
  if (arch === "microservices") {
    g.push(`<text x="454" y="42" font-size="12" font-weight="600" fill="#2C6B0F">${esc(RUNTIME[h])} cluster · private network · 3 zones</text>`);
    g.push(box(460, 60, 180, 52, s.apiGateway === "none" ? "Ingress" : "API gateway", svc("apiGateway") || "Ingress controller"));
    g.push(box(660, 60, 180, 52, "Identity", svc("identity")));
    g.push(box(460, 135, 380, 60, "Microservices", lbl("backend")));
    if (s.messaging !== "none") g.push(box(460, 220, 180, 52, "Messaging", svc("messaging")));
    g.push(box(660, 220, 180, 52, "Observability", lbl("observability")));
    g.push(box(460, 295, 380, 46, "GitOps delivery", lbl("cicd")));
    g.push(arrow(400, 234, 460, 86), arrow(640, 86, 660, 86), arrow(550, 112, 550, 135));
    if (s.messaging !== "none") g.push(arrow(550, 195, 550, 220));
  } else {
    g.push(`<text x="454" y="42" font-size="12" font-weight="600" fill="#2C6B0F">3-tier on ${esc(VMS[h])} · private subnets</text>`);
    g.push(box(460, 60, 380, 56, "Presentation tier", `${lbl("frontend") || "Web"} · reverse proxy`));
    g.push(box(460, 140, 380, 60, "Application tier", `${lbl("backend")} · autoscaling group`));
    g.push(box(460, 225, 180, 52, "Identity", svc("identity")));
    g.push(box(660, 225, 180, 52, "Observability", lbl("observability")));
    g.push(box(460, 295, 380, 46, "CI/CD", lbl("cicd")));
    g.push(arrow(400, 234, 460, 88), arrow(650, 116, 650, 140));
  }

  // Data tier
  const data: [string, string][] = [];
  if (s.sqlDb !== "none") data.push([`${lbl("sqlDb")} (HA)`, svc("sqlDb")]);
  if (s.noSql !== "none") data.push([`${lbl("noSql")}`, svc("noSql")]);
  if (s.cache !== "none") data.push([lbl("cache"), svc("cache")]);
  if (s.search !== "none") data.push(["Search", svc("search")]);
  if (s.objectStorage !== "none") data.push(["Object storage", svc("objectStorage")]);
  data.push(["Secrets & keys", svc("secrets")]);
  const step = Math.min(62, 330 / data.length);
  data.forEach(([t, st], i) => {
    const y = 20 + i * step;
    g.push(box(920, y, 250, step - 10, t, st, "#EEF5FB"));
    g.push(arrow(860, 165, 920, y + (step - 10) / 2));
  });

  // External + DR
  if (s.email !== "none") g.push(box(440, 400, 200, 52, "Email · SMS", svc("email")));
  if (s.mobile !== "none") g.push(box(660, 400, 200, 52, "Push notifications", "FCM / APNs"));
  g.push(box(920, 400, 250, 70, `DR: ${DR_SITE[h]}`, option("dr", s.dr)?.label ?? "", "#FFF8E6", BRAND.gold));
  g.push(arrow(550, 360, 550, 400), arrow(1045, 370, 1045, 400));
  g.push("</svg>");
  return { kind: "diagram", svg: g.join(""), w: W, h: H };
}
