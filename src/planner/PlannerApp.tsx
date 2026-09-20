import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import JSZip from "jszip";
import { boqWorkbook, effortWorkbook, fillRfpWorkbook, ganttWorkbook, infraWorkbook, invoiceWorkbook, testWorkbook } from "./excel";
import { buildDeliveryPack } from "./generate";
import { repriceEffort } from "./effort";
import { architectureLabel, type ArchitectureStyle } from "../architecture";
import { grossOf, netOf, vatOf } from "./invoices";
import { downloadPdfFromHtml } from "./pdf";
import { buildPrintHtml, type PrintKind } from "./printHtml";
import { presentationPptx } from "./pptx";
import { embedTemplate } from "./embedTemplate";
import { ARTEFACTS, TOKEN_HELP, type ArtefactId } from "./tokens";
import { stitchMarkdown, wireframeHtml } from "./wireframes";
import type { DeliveryPack, DocSection, PlannerBrief, ProductKind, DeploymentModel } from "./types";
import { brdDocx, defaultHldTemplateDocx, defaultHouseTemplateDocx, downloadBlob, hldDocx, invoicesDocx, lldDocx, msaDocx, ndaDocx, prdDocx, sowDocx } from "./word";

const emptyBrief = (architecture: ArchitectureStyle): PlannerBrief => ({
  productName: "",
  clientName: "",
  vendorName: "",
  kind: "platform",
  architectureStyle: architecture,
  deployment: "on-premise",
  industry: "",
  briefing: "",
  modules: "",
  users: "500",
  durationMonths: "6",
  constraints: "",
  startDate: new Date().toISOString().slice(0, 10),
});

type Tool =
  | "overview"
  | "rfp"
  | "boq"
  | "effort"
  | "infra"
  | "sow"
  | "nda"
  | "msa"
  | "invoices"
  | "hld"
  | "lld"
  | "gantt"
  | "arch"
  | "brd"
  | "prd"
  | "tests"
  | "deck"
  | "wires"
  | "template";

const tools: { id: Tool; label: string }[] = [
  { id: "overview", label: "Pack" },
  { id: "rfp", label: "RFP Excel" },
  { id: "boq", label: "BOQ" },
  { id: "effort", label: "Effort" },
  { id: "infra", label: "Infrastructure" },
  { id: "sow", label: "SOW" },
  { id: "nda", label: "NDA" },
  { id: "msa", label: "Contract" },
  { id: "invoices", label: "Invoices" },
  { id: "hld", label: "HLD" },
  { id: "lld", label: "LLD" },
  { id: "gantt", label: "Gantt" },
  { id: "arch", label: "Architecture" },
  { id: "wires", label: "Wireframes" },
  { id: "brd", label: "BRD" },
  { id: "prd", label: "PRD" },
  { id: "tests", label: "Test cases" },
  { id: "deck", label: "PPT / Canva" },
  { id: "template", label: "Template" },
];

const fmtAed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);
const fmtAed2 = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", minimumFractionDigits: 2 }).format(n);

export default function PlannerApp({ architecture }: { architecture: ArchitectureStyle }) {
  const [form, setForm] = useState<PlannerBrief>(() => emptyBrief(architecture));
  const [pack, setPack] = useState<DeliveryPack | null>(null);
  const [tool, setTool] = useState<Tool>("overview");
  const [rfpFile, setRfpFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [embedInto, setEmbedInto] = useState<ArtefactId>("content");
  const [rfpPreview, setRfpPreview] = useState<Awaited<ReturnType<typeof fillRfpWorkbook>> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [printHtml, setPrintHtml] = useState<string | null>(null);

  useEffect(() => {
    setForm((s) => ({ ...s, architectureStyle: architecture }));
    setPack(null);
    setNote("");
  }, [architecture]);

  const setField = <K extends keyof PlannerBrief>(k: K, v: PlannerBrief[K]) => setForm((s) => ({ ...s, [k]: v }));

  const maxWeek = useMemo(() => (pack ? Math.max(...pack.milestones.map((m) => m.startWeek + m.durationWeeks - 1), 1) : 1), [pack]);

  const onPrepare = (e: FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!form.productName.trim()) errs.push("Name the platform, product, or software.");
    if (!form.clientName.trim()) errs.push("Add the client / issuing organisation.");
    if (errs.length) {
      setErrors(errs);
      setPack(null);
      return;
    }
    setErrors([]);
    setNote("");
    setRfpPreview(null);
    setPack(buildDeliveryPack(form));
    setTool("overview");
  };

  const run = async (label: string, fn: () => Promise<void> | void) => {
    setBusy(label);
    setNote("");
    try {
      await fn();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Preparation failed"]);
    } finally {
      setBusy(null);
    }
  };

  const onRfpFile = (e: ChangeEvent<HTMLInputElement>) => {
    setRfpFile(e.target.files?.[0] ?? null);
    setRfpPreview(null);
  };

  const onHldFile = (e: ChangeEvent<HTMLInputElement>) => {
    setTemplateFile(e.target.files?.[0] ?? null);
  };

  return (
    <div className="grid planner-grid">
      <aside className="card">
        <h2>Delivery briefing</h2>
        <form onSubmit={onPrepare}>
          <label htmlFor="pname">Platform / product / software name</label>
          <input id="pname" value={form.productName} onChange={(e) => setField("productName", e.target.value)} placeholder="e.g. National Licensing Platform" />
          <div className="row-2">
            <div>
              <label htmlFor="client">Client / issuer</label>
              <input id="client" value={form.clientName} onChange={(e) => setField("clientName", e.target.value)} placeholder="e.g. Ministry / bank" />
            </div>
            <div>
              <label htmlFor="vendor">Your organisation</label>
              <input id="vendor" value={form.vendorName} onChange={(e) => setField("vendorName", e.target.value)} placeholder="Vendor legal name" />
            </div>
          </div>
          <div className="row-2">
            <div>
              <label htmlFor="kind">What you are proposing</label>
              <select id="kind" value={form.kind} onChange={(e) => setField("kind", e.target.value as ProductKind)}>
                <option value="platform">Platform</option>
                <option value="product">Product</option>
                <option value="software">Software</option>
              </select>
            </div>
            <div>
              <label htmlFor="dep">Deployment</label>
              <select id="dep" value={form.deployment} onChange={(e) => setField("deployment", e.target.value as DeploymentModel)}>
                <option value="on-premise">On-premise (BOQ-heavy)</option>
                <option value="hybrid">Hybrid</option>
                <option value="cloud">Cloud</option>
              </select>
            </div>
          </div>
          <label htmlFor="ind">Industry</label>
          <input id="ind" value={form.industry} onChange={(e) => setField("industry", e.target.value)} placeholder="e.g. government, banking, telco" />
          <label htmlFor="brief">What the RFP is asking for</label>
          <textarea
            id="brief"
            rows={5}
            value={form.briefing}
            onChange={(e) => setField("briefing", e.target.value)}
            placeholder="Paste the RFP summary, objectives, must-haves, integrations, SLAs…"
          />
          <label htmlFor="mods">Modules / capabilities (comma or new line)</label>
          <textarea id="mods" rows={3} value={form.modules} onChange={(e) => setField("modules", e.target.value)} placeholder="Identity, Case management, Payments, Reporting" />
          <div className="row-2">
            <div>
              <label htmlFor="users">Named users (approx.)</label>
              <input id="users" value={form.users} onChange={(e) => setField("users", e.target.value)} />
            </div>
            <div>
              <label htmlFor="months">Delivery (months)</label>
              <input id="months" value={form.durationMonths} onChange={(e) => setField("durationMonths", e.target.value)} />
            </div>
          </div>
          <label htmlFor="start">Kickoff date</label>
          <input id="start" type="date" value={form.startDate} onChange={(e) => setField("startDate", e.target.value)} />
          <label htmlFor="cons">Constraints (compliance, language, SLAs)</label>
          <textarea id="cons" rows={2} value={form.constraints} onChange={(e) => setField("constraints", e.target.value)} placeholder="PDPL, 99.9% API SLA, EN/AR, on-shore data…" />

          <p className="field-hint">Optional uploads</p>
          <label htmlFor="rfp">RFP workbook (.xlsx)</label>
          <input id="rfp" type="file" accept=".xlsx,.xls,.xlsm" onChange={onRfpFile} />
          {rfpFile && <p className="file-chip">{rfpFile.name}</p>}
          <label htmlFor="hldt">House template (any .docx / .pptx / .xlsx / .txt / .md)</label>
          <input id="hldt" type="file" accept=".docx,.pptx,.xlsx,.xls,.xlsm,.txt,.md,.html" onChange={onHldFile} />
          {templateFile && <p className="file-chip">{templateFile.name}</p>}

          {errors.length > 0 && (
            <ul className="form-errors">
              {errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}
          <button type="submit" className="submit-btn" disabled={!!busy}>
            {busy ? busy : "Prepare delivery pack"}
          </button>
        </form>
      </aside>

      <main>
        {!pack ? (
          <div className="card empty-state">
            <h2>Delivery planner</h2>
            <p className="layout-note">
              Brief the engagement on the left, then prepare a pack: NDA and MSA (contract) drafts, RFP Excel, BOQ,
              infrastructure Excel, SOW, HLD/LLD, architecture, Gantt, BRD, PRD, tests, wireframes, and a PPT for
              Canva. Architecture for this pack: <strong>{architectureLabel(architecture)}</strong> — software, network,
              security, database, reporting, BI, and complaints handling. Cost estimator is a separate tab.
            </p>
          </div>
        ) : (
          <>
            <div className="kpis">
              <div className="kpi">
                <div className="v">{pack.moduleList.length}</div>
                <div className="l">Capabilities</div>
              </div>
              <div className="kpi">
                <div className="v">{pack.months} mo</div>
                <div className="l">Calendar</div>
              </div>
              <div className="kpi">
                <div className="v">{fmtAed(pack.boq.capexAed)}</div>
                <div className="l">BOQ capex (planning)</div>
              </div>
              <div className="kpi">
                <div className="v">{pack.testCases.length}</div>
                <div className="l">Test cases</div>
              </div>
            </div>

            <div className="card">
              <div className="tabs">
                {tools.map((t) => (
                  <button key={t.id} className={tool === t.id ? "active" : ""} onClick={() => setTool(t.id)} type="button">
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="btn-row">
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={!!busy}
                  onClick={() => setPrintHtml(buildPrintHtml(pack, tool as PrintKind, rfpPreview))}
                >
                  Print preview
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={!!busy}
                  onClick={() =>
                    run("Building PDF…", () =>
                      downloadPdfFromHtml(buildPrintHtml(pack, tool as PrintKind, rfpPreview), `${pack.slug}-${tool}.pdf`)
                    )
                  }
                >
                  Download PDF
                </button>
                <span className="layout-note" style={{ margin: 0 }}>
                  Preview opens A4 pages. Print dialog can also Save as PDF. Long packs take a few seconds.
                </span>
              </div>
              {note && <p className="compare-win">{note}</p>}

              {tool === "overview" && (
                <>
                  <p className="layout-note">{pack.executiveSummary}</p>
                  <h2>RFP narrative</h2>
                  <ul className="assumptions">
                    {pack.rfpNarrative.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </>
              )}

              {tool === "rfp" && (
                <>
                  <p className="layout-note">
                    Upload the issuer’s Excel, prepare answers from this pack, then download the same workbook with
                    Vendor Response and Compliance columns filled. Bid-review the compliance flags before sending.
                  </p>
                  {!rfpFile && <p className="layout-note">No workbook attached yet — add it in the briefing panel.</p>}
                  <div className="btn-row">
                    <button
                      type="button"
                      className="submit-btn inline"
                      disabled={!rfpFile || !!busy}
                      onClick={() =>
                        run("Answering RFP…", async () => {
                          if (!rfpFile) return;
                          const result = await fillRfpWorkbook(rfpFile, pack);
                          setRfpPreview(result);
                          setNote(`Filled ${result.filled} requirement rows across the workbook.`);
                        })
                      }
                    >
                      Answer uploaded Excel
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={!rfpPreview || !!busy}
                      onClick={() => rfpPreview && downloadBlob(rfpPreview.blob, `${pack.slug}-rfp-response.xlsx`)}
                    >
                      Download filled Excel
                    </button>
                  </div>
                  {rfpPreview && (
                    <div className="scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Sheet</th>
                            <th>Requirement</th>
                            <th>Compliance</th>
                            <th>Draft answer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rfpPreview.preview.map((r, i) => (
                            <tr key={`${r.sheet}-${i}`}>
                              <td>{r.sheet}</td>
                              <td>{r.question}</td>
                              <td>{r.compliance}</td>
                              <td>{r.answer}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {tool === "boq" && (
                <>
                  <p className="layout-note">
                    Bill of quantities sized for {pack.placeholders.deployment}. Capex {fmtAed(pack.boq.capexAed)};
                    recurring lines {fmtAed(pack.boq.opexYearAed)}. GCC-typical list prices — not a quote. The same
                    workbook also contains infrastructure sheets and the effort / man-hour costing sheets. Role-level
                    hours live on the Effort tab.
                  </p>
                  <button type="button" className="submit-btn inline" onClick={() => downloadBlob(boqWorkbook(pack), `${pack.slug}-boq.xlsx`)}>
                    Download BOQ Excel
                  </button>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Category</th>
                          <th className="num">Qty</th>
                          <th className="num">AED</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.boq.lines.map((l) => (
                          <tr key={l.item}>
                            <td>{l.item}</td>
                            <td>{l.category}</td>
                            <td className="num">
                              {l.qty} {l.unit}
                            </td>
                            <td className="num">{fmtAed(l.totalAed)}</td>
                            <td>{l.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {tool === "infra" && (
                <>
                  <p className="layout-note">
                    {pack.infra.runtime === "kubernetes" ? (
                      <>
                    Kubernetes is inventoried as masters (MST, control plane, not schedulable) and workers (WKR,
                    kubelet + workloads). Other rows are platform VMs (WAF, PostgreSQL, vault). Complete workbook for{" "}
                    {pack.infra.siteCode} ({pack.infra.domain}): {pack.infra.vms.length} guests,{" "}
                    {pack.infra.vms.filter((v) => v.k8sRole === "master").length} masters,{" "}
                    {pack.infra.vms.filter((v) => v.k8sRole === "worker").length} workers, {pack.infra.vlans.length}{" "}
                    VLAN/subnets, {pack.infra.policies.length} firewall/NSG policies. Planning IPAM. {pack.infra.hypervisor}.
                      </>
                    ) : (
                      <>
                    3-tier inventory: WEB (presentation), APP (monolith), PG (data). No Kubernetes masters or workers.
                    Workbook for {pack.infra.siteCode} ({pack.infra.domain}): {pack.infra.vms.length} guests,{" "}
                    {pack.infra.vms.filter((v) => v.role === "WEB").length} web,{" "}
                    {pack.infra.vms.filter((v) => v.role === "APP").length} app, {pack.infra.vlans.length} VLAN/subnets,{" "}
                    {pack.infra.policies.length} firewall/NSG policies. Planning IPAM. {pack.infra.hypervisor}.
                      </>
                    )}
                  </p>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="submit-btn inline"
                      onClick={() => downloadBlob(infraWorkbook(pack), `${pack.slug}-infrastructure.xlsx`)}
                    >
                      Download infrastructure Excel
                    </button>
                  </div>
                  <ul className="assumptions">
                    {pack.infra.naming.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                  <h2>{pack.infra.runtime === "kubernetes" ? "Kubernetes masters and workers" : "Presentation and application VMs"}</h2>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Node type</th>
                          <th>Hostname</th>
                          <th>Env</th>
                          <th>Cluster</th>
                          <th className="num">vCPU</th>
                          <th className="num">RAM Gi</th>
                          <th>IP</th>
                          <th>Taints</th>
                          <th>Schedulable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.infra.vms
                          .filter((v) =>
                            pack.infra.runtime === "kubernetes"
                              ? v.k8sRole === "master" || v.k8sRole === "worker"
                              : v.role === "WEB" || v.role === "APP"
                          )
                          .map((v) => (
                            <tr key={v.hostname}>
                              <td>
                                {v.k8sRole === "master"
                                  ? "Master (control plane)"
                                  : v.k8sRole === "worker"
                                    ? "Worker"
                                    : v.role === "WEB"
                                      ? "Presentation"
                                      : "Application"}
                              </td>
                              <td>{v.hostname}</td>
                              <td>{v.env}</td>
                              <td>{v.cluster}</td>
                              <td className="num">{v.vcpu}</td>
                              <td className="num">{v.ramGi}</td>
                              <td>{v.ip}</td>
                              <td>{v.k8sTaints}</td>
                              <td>{v.k8sRole === "master" ? "No" : "Yes"}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <h2>Capacity</h2>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Env</th>
                          <th className="num">VMs</th>
                          <th className="num">vCPU</th>
                          <th className="num">RAM Gi</th>
                          <th className="num">OS Gi</th>
                          <th className="num">Data Gi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.infra.capacity.map((c) => (
                          <tr key={c.env}>
                            <td>{c.env}</td>
                            <td className="num">{c.vmCount}</td>
                            <td className="num">{c.vcpu}</td>
                            <td className="num">{c.ramGi}</td>
                            <td className="num">{c.osDiskGi}</td>
                            <td className="num">{c.dataDiskGi}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h2>VLANs and subnets</h2>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Env</th>
                          <th>VLAN</th>
                          <th>Name</th>
                          <th>Zone</th>
                          <th>CIDR</th>
                          <th>Gateway</th>
                          <th>Purpose</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.infra.vlans.map((v) => (
                          <tr key={`${v.env}-${v.vlanId}-${v.name}`}>
                            <td>{v.env}</td>
                            <td>{v.vlanId}</td>
                            <td>{v.name}</td>
                            <td>{v.zone}</td>
                            <td>{v.cidr}</td>
                            <td>{v.gateway}</td>
                            <td>{v.purpose}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h2>VM inventory (name, capacity, IP)</h2>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Hostname</th>
                          <th>Env</th>
                          <th>Function</th>
                          <th className="num">vCPU</th>
                          <th className="num">RAM Gi</th>
                          <th className="num">OS Gi</th>
                          <th className="num">Data Gi</th>
                          <th>VLAN</th>
                          <th>IP</th>
                          <th>VIP</th>
                          <th>HA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.infra.vms.map((v) => (
                          <tr key={v.hostname}>
                            <td>{v.hostname}</td>
                            <td>{v.env}</td>
                            <td>{v.function}</td>
                            <td className="num">{v.vcpu}</td>
                            <td className="num">{v.ramGi}</td>
                            <td className="num">{v.osDiskGi}</td>
                            <td className="num">{v.dataDiskGi}</td>
                            <td>
                              {v.vlanId} {v.vlanName}
                            </td>
                            <td>{v.ip}</td>
                            <td>{v.vip}</td>
                            <td>{v.ha}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h2>Security policies</h2>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Env</th>
                          <th>Name</th>
                          <th>From</th>
                          <th>To</th>
                          <th>Source</th>
                          <th>Destination</th>
                          <th>Service</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.infra.policies.map((p) => (
                          <tr key={`${p.id}-${p.env}`}>
                            <td>{p.id}</td>
                            <td>{p.env}</td>
                            <td>{p.name}</td>
                            <td>{p.fromZone}</td>
                            <td>{p.toZone}</td>
                            <td>{p.source}</td>
                            <td>{p.destination}</td>
                            <td>{p.service}</td>
                            <td>{p.action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {tool === "effort" && (
                <>
                  <p className="layout-note">
                    Professional-services estimate: {pack.effort.totalManDays} man-days ({pack.effort.totalHours} hours)
                    including {Math.round(pack.effort.contingencyPct * 100)}% reserve, {fmtAed(pack.effort.totalCostAed)}{" "}
                    at the AED/hour rates in the card below ({pack.effort.hoursPerDay}h man-day, {Math.round(pack.effort.utilisation * 100)}%
                    utilisation). Edit a rate to recost immediately. Hardware stays on the BOQ.
                  </p>
                  <button
                    type="button"
                    className="submit-btn inline"
                    onClick={() => downloadBlob(effortWorkbook(pack), `${pack.slug}-effort.xlsx`)}
                  >
                    Download effort Excel
                  </button>
                  <h2>Totals by phase</h2>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Phase</th>
                          <th className="num">Weeks</th>
                          <th className="num">Man-days</th>
                          <th className="num">Hours</th>
                          <th className="num">AED</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.effort.byPhase.map((p) => (
                          <tr key={p.phaseId}>
                            <td>{p.phase}</td>
                            <td className="num">{p.weeks}</td>
                            <td className="num">{p.manDays}</td>
                            <td className="num">{p.hours}</td>
                            <td className="num">{fmtAed(p.costAed)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td>Management reserve</td>
                          <td className="num" />
                          <td className="num">{Math.round((pack.effort.contingencyHours / pack.effort.hoursPerDay) * 10) / 10}</td>
                          <td className="num">{pack.effort.contingencyHours}</td>
                          <td className="num">{fmtAed(pack.effort.contingencyAed)}</td>
                        </tr>
                        <tr>
                          <td>
                            <strong>Grand total</strong>
                          </td>
                          <td className="num" />
                          <td className="num">
                            <strong>{pack.effort.totalManDays}</strong>
                          </td>
                          <td className="num">
                            <strong>{pack.effort.totalHours}</strong>
                          </td>
                          <td className="num">
                            <strong>{fmtAed(pack.effort.totalCostAed)}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <h2>Rate card</h2>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Role</th>
                          <th>Discipline</th>
                          <th className="num">AED / hour</th>
                          <th className="num">AED / day</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.effort.roles.map((r) => (
                          <tr key={r.id}>
                            <td>{r.role}</td>
                            <td>{r.discipline}</td>
                            <td className="num">
                              <input
                                className="rate-input"
                                type="number"
                                min={1}
                                step={10}
                                aria-label={`${r.role} AED per hour`}
                                value={r.aedPerHour}
                                onChange={(e) => {
                                  const n = Number(e.target.value);
                                  if (!Number.isFinite(n) || n <= 0) return;
                                  const rates = Object.fromEntries(
                                    pack.effort.roles.map((x) => [x.id, x.id === r.id ? n : x.aedPerHour])
                                  );
                                  const effort = repriceEffort(pack.effort, rates);
                                  setPack({
                                    ...pack,
                                    effort,
                                    brief: { ...pack.brief, rateCard: rates },
                                    placeholders: {
                                      ...pack.placeholders,
                                      effortHours: String(effort.totalHours),
                                      effortManDays: String(effort.totalManDays),
                                      effortCostAed: String(effort.totalCostAed),
                                      effortSummary: `${effort.totalManDays} man-days / ${effort.totalHours} hours / ${effort.totalCostAed} AED including ${Math.round(effort.contingencyPct * 100)}% reserve (planning).`,
                                    },
                                  });
                                }}
                              />
                            </td>
                            <td className="num">{fmtAed(r.aedPerDay)}</td>
                            <td>{r.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h2>Man-hour costing by role</h2>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Role</th>
                          <th className="num">Avg FTE</th>
                          <th className="num">Man-days</th>
                          <th className="num">Hours</th>
                          <th className="num">AED</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.effort.byRole.map((r) => (
                          <tr key={r.role}>
                            <td>{r.role}</td>
                            <td className="num">{r.avgFte}</td>
                            <td className="num">{r.manDays}</td>
                            <td className="num">{r.hours}</td>
                            <td className="num">{fmtAed(r.costAed)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h2>Build hours by module</h2>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Module</th>
                          <th className="num">Share %</th>
                          <th className="num">Hours</th>
                          <th className="num">Man-days</th>
                          <th className="num">AED</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.effort.byModule.map((m) => (
                          <tr key={m.module}>
                            <td>{m.module}</td>
                            <td className="num">{m.sharePct}</td>
                            <td className="num">{m.hours}</td>
                            <td className="num">{m.manDays}</td>
                            <td className="num">{fmtAed(m.costAed)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="assumptions">
                    {pack.effort.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </>
              )}

              {tool === "sow" && (
                <DocPreview
                  title="Statement of Work"
                  sections={pack.sow}
                  diagrams={pack.diagrams}
                  onDownload={() => run("Building SOW…", async () => downloadBlob(await sowDocx(pack), `${pack.slug}-sow.docx`))}
                  busy={!!busy}
                />
              )}

              {tool === "nda" && (
                <>
                  <p className="layout-note">
                    Mutual NDA for RFP and workshops. Download Word and complete every [bracket] (addresses, forum,
                    optional residuals). Generating the pack does not execute the NDA. Licensed counsel must review.
                  </p>
                  <DocPreview
                    title="Mutual NDA"
                    sections={pack.nda}
                    onDownload={() =>
                      run("Building NDA…", async () => downloadBlob(await ndaDocx(pack), `${pack.slug}-nda.docx`))
                    }
                    busy={!!busy}
                  />
                </>
              )}

              {tool === "msa" && (
                <>
                  <p className="layout-note">
                    Master Services Agreement with Order Form and PDPL schedule. It sits above the SOW: law, liability,
                    IP, data. Fees stay blank until Schedule 1 is priced. Edit in Word; do not send with [brackets]
                    still in. Not a signed contract and not legal advice.
                  </p>
                  <DocPreview
                    title="Master Services Agreement"
                    sections={pack.msa}
                    onDownload={() =>
                      run("Building contract…", async () => downloadBlob(await msaDocx(pack), `${pack.slug}-msa.docx`))
                    }
                    busy={!!busy}
                  />
                </>
              )}

              {tool === "invoices" && (
                <>
                  <p className="layout-note">
                    Pro forma for the implementation total, then one draft tax invoice per SOW payment gate (10 / 15 /
                    40 / 20 / 15), plus a credit-note template. UAE VAT 5% is shown as standard-rated. Complete TRN,
                    PO, IBAN and FTA sequence before issue — these are not a demand for payment.
                  </p>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="submit-btn inline"
                      onClick={() => downloadBlob(invoiceWorkbook(pack), `${pack.slug}-invoices.xlsx`)}
                    >
                      Download invoice Excel
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={!!busy}
                      onClick={() =>
                        run("Building invoices Word…", async () =>
                          downloadBlob(await invoicesDocx(pack), `${pack.slug}-invoices.docx`)
                        )
                      }
                    >
                      Download invoices Word
                    </button>
                  </div>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Number</th>
                          <th>Kind</th>
                          <th>Gate</th>
                          <th>Issue</th>
                          <th>Due</th>
                          <th className="num">Net</th>
                          <th className="num">VAT</th>
                          <th className="num">Gross</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.invoices.map((inv) => (
                          <tr key={inv.id}>
                            <td>{inv.number}</td>
                            <td>
                              {inv.kind} · {inv.status}
                            </td>
                            <td>{inv.gate}</td>
                            <td>{inv.issueDate}</td>
                            <td>{inv.dueDate}</td>
                            <td className="num">{fmtAed2(netOf(inv))}</td>
                            <td className="num">{fmtAed2(vatOf(inv))}</td>
                            <td className="num">{fmtAed2(grossOf(inv))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {pack.invoices.map((inv) => (
                    <div key={inv.id} className="doc-block">
                      <h2>
                        {inv.number} — {inv.title}
                      </h2>
                      <p className="layout-note">
                        {inv.trigger} PO {inv.poRef}. {inv.sowRef}.
                      </p>
                      <ul className="assumptions">
                        {inv.lines.map((l) => (
                          <li key={l.description}>
                            {l.description} — {fmtAed2(l.qty * l.unitAed)} net
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              )}

              {tool === "hld" && (
                <>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="submit-btn inline"
                      disabled={!!busy}
                      onClick={() =>
                        run("Building HLD…", async () => {
                          if (templateFile) {
                            const result = await embedTemplate(templateFile, pack, "hld", "hld");
                            downloadBlob(result.blob, result.filename);
                            setNote(result.message);
                            return;
                          }
                          downloadBlob(await hldDocx(pack), `${pack.slug}-hld.docx`);
                        })
                      }
                    >
                      Download HLD Word
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() =>
                        run("Template…", async () => downloadBlob(await defaultHldTemplateDocx(pack), "hld-placeholder-template.docx"))
                      }
                    >
                      Download placeholder template
                    </button>
                  </div>
                  <DocPreview title="High-level design" sections={pack.hld} diagrams={pack.diagrams} busy={!!busy} />
                </>
              )}

              {tool === "lld" && (
                <>
                  <DocPreview
                    title="Low-level design"
                    sections={pack.lld}
                    diagrams={pack.diagrams}
                    onDownload={() => run("Building LLD…", async () => downloadBlob(await lldDocx(pack), `${pack.slug}-lld.docx`))}
                    busy={!!busy}
                  />
                  <h2>APIs</h2>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Method</th>
                          <th>Path</th>
                          <th>Purpose</th>
                          <th>Auth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.apis.map((a) => (
                          <tr key={`${a.method}-${a.path}`}>
                            <td className="sku-pill">{a.method}</td>
                            <td>{a.path}</td>
                            <td>{a.purpose}</td>
                            <td>{a.auth}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {tool === "gantt" && (
                <>
                  <p className="layout-note">Weeks from kickoff {pack.brief.startDate}. Download Excel for dates and owners.</p>
                  <button type="button" className="submit-btn inline" onClick={() => downloadBlob(ganttWorkbook(pack), `${pack.slug}-gantt.xlsx`)}>
                    Download Gantt Excel
                  </button>
                  <div className="gantt">
                    {pack.milestones.map((m) => (
                      <div className="gantt-row" key={m.id}>
                        <div className="gantt-meta">
                          <strong>{m.name}</strong>
                          <span>
                            {m.phase} · {m.owner} · W{m.startWeek}–W{m.startWeek + m.durationWeeks - 1}
                          </span>
                        </div>
                        <div className="gantt-track">
                          <span
                            className="gantt-bar"
                            style={{
                              marginLeft: `${((m.startWeek - 1) / maxWeek) * 100}%`,
                              width: `${(m.durationWeeks / maxWeek) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {tool === "arch" && (
                <>
                  <p className="layout-note">
                    Architecture is seven separate views: software, network, security, database, reporting, BI, and
                    complaints handling. Each has its own diagram, narrative, and control table. Supporting pictures
                    (sequence, identity, DR, CI/CD) follow. The same views are in the HLD Word file, print/PDF, and the
                    proposal deck. Cost estimator remains a separate tab for sizing; this tab is the design pack.
                  </p>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="submit-btn inline"
                      onClick={() =>
                        run("Zipping diagrams…", async () => {
                          const zip = new JSZip();
                          for (const d of pack.diagrams) zip.file(`${d.id}-${pack.slug}.svg`, d.svg);
                          downloadBlob(await zip.generateAsync({ type: "blob" }), `${pack.slug}-diagrams.zip`);
                        })
                      }
                    >
                      Download all diagrams (SVG zip)
                    </button>
                  </div>
                  {pack.architectureViews.map((v) => {
                    const d = pack.diagrams.find((x) => x.id === v.diagramId);
                    return (
                      <div key={v.id} className="doc-block">
                        <p className="kicker">{v.id}</p>
                        <h2>{v.title}</h2>
                        <p className="layout-note">{v.summary}</p>
                        <ul className="assumptions">
                          {v.bullets.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                        {v.table && (
                          <div className="scroll">
                            <p className="layout-note">{v.table.caption}</p>
                            <table>
                              <thead>
                                <tr>
                                  {v.table.headers.map((hd) => (
                                    <th key={hd}>{hd}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {v.table.rows.map((row, i) => (
                                  <tr key={i}>
                                    {row.map((c, j) => (
                                      <td key={j}>{c}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {d && (
                          <>
                            <p className="layout-note">
                              Figure — {d.title}. {d.caption}
                            </p>
                            <div className="arch-frame" dangerouslySetInnerHTML={{ __html: d.svg }} />
                          </>
                        )}
                      </div>
                    );
                  })}
                  <h2>Supporting diagrams</h2>
                  {pack.diagrams
                    .filter((d) => !["software", "network", "security-arch", "database", "reporting", "bi", "complaints"].includes(d.id))
                    .map((d) => (
                      <div key={d.id} className="doc-block">
                        <h2>{d.title}</h2>
                        <p className="layout-note">{d.caption}</p>
                        <div className="arch-frame" dangerouslySetInnerHTML={{ __html: d.svg }} />
                      </div>
                    ))}
                </>
              )}

              {tool === "brd" && (
                <DocPreview
                  title="Business requirements"
                  sections={pack.brd}
                  diagrams={pack.diagrams}
                  onDownload={() => run("Building BRD…", async () => downloadBlob(await brdDocx(pack), `${pack.slug}-brd.docx`))}
                  busy={!!busy}
                />
              )}

              {tool === "prd" && (
                <DocPreview
                  title="Product requirements"
                  sections={pack.prd}
                  diagrams={pack.diagrams}
                  onDownload={() => run("Building PRD…", async () => downloadBlob(await prdDocx(pack), `${pack.slug}-prd.docx`))}
                  busy={!!busy}
                />
              )}

              {tool === "tests" && (
                <>
                  <p className="layout-note">{pack.testCases.length} cases across Functional, Integration, Security, NFR, and UAT — one sheet per suite.</p>
                  <button type="button" className="submit-btn inline" onClick={() => downloadBlob(testWorkbook(pack), `${pack.slug}-test-cases.xlsx`)}>
                    Download test Excel
                  </button>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Suite</th>
                          <th>Module</th>
                          <th>Title</th>
                          <th>Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.testCases.map((t) => (
                          <tr key={t.id}>
                            <td className="sku-pill">{t.id}</td>
                            <td>{t.suite}</td>
                            <td>{t.module}</td>
                            <td>{t.title}</td>
                            <td>{t.priority}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {tool === "wires" && (
                <>
                  <p className="layout-note">
                    Grayscale 1440×900 boards. Download the HTML click-through, SVG files for Figma (drag onto the
                    canvas), and Stitch prompts for{" "}
                    <a href="https://stitch.withgoogle.com" target="_blank" rel="noreferrer">
                      stitch.withgoogle.com
                    </a>{" "}
                    — generate there, then Send to Figma. This app does not log into Figma for you.
                  </p>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="submit-btn inline"
                      disabled={!!busy}
                      onClick={() =>
                        run("Packing wireframes…", async () => {
                          const zip = new JSZip();
                          zip.file("index.html", wireframeHtml(pack.brief.productName, pack.wireframes));
                          zip.file("STITCH_AND_FIGMA.md", stitchMarkdown(pack.brief.productName, pack.brief.clientName, pack.wireframes));
                          zip.file(
                            "FIGMA.txt",
                            "1. New Figma file, desktop.\n2. Drag each svg from /svg onto the page (1440×900).\n3. Or paste prompts from STITCH_AND_FIGMA.md into Google Stitch and Send to Figma.\n4. Rebuild as Auto Layout before handoff to engineering.\n"
                          );
                          const folder = zip.folder("svg");
                          for (const w of pack.wireframes) folder?.file(`${w.id}.svg`, w.svg);
                          downloadBlob(await zip.generateAsync({ type: "blob" }), `${pack.slug}-wireframes.zip`);
                        })
                      }
                    >
                      Download wireframe pack (HTML + SVG + Stitch)
                    </button>
                  </div>
                  {pack.wireframes.map((w) => (
                    <div key={w.id} className="doc-block">
                      <h2>{w.name}</h2>
                      <p className="layout-note">
                        {w.persona}. {w.purpose} {w.layoutNotes}
                      </p>
                      <div className="arch-frame wire-frame" dangerouslySetInnerHTML={{ __html: w.svg }} />
                      <p className="layout-note">
                        Empty: {w.emptyState} Error: {w.errorState}
                      </p>
                      <pre className="stitch-prompt">{w.stitchPrompt}</pre>
                    </div>
                  ))}
                </>
              )}

              {tool === "deck" && (
                <>
                  <p className="layout-note">
                    Widescreen PPTX (File → PowerPoint in Canva). Architecture pictures are on extra slides.
                  </p>
                  <button
                    type="button"
                    className="submit-btn inline"
                    disabled={!!busy}
                    onClick={() => run("Building deck…", async () => downloadBlob(await presentationPptx(pack), `${pack.slug}-proposal.pptx`))}
                  >
                    Download PPTX
                  </button>
                  <ul className="assumptions">
                    {pack.slides.map((s) => (
                      <li key={s.title}>
                        <strong>{s.kicker}:</strong> {s.title} — {s.bullets[0]}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {tool === "template" && (
                <>
                  <p className="layout-note">
                    Choose a Word, PowerPoint, Excel, or text file on this tab. Tokens like {"{{projectName}}"} and{" "}
                    {"{{content}}"} are replaced with this pack. If the file has no tokens, the chosen artefact is
                    appended inside it (Word: end of body; Excel: new sheet; text: appended). PDF cannot be merged —
                    use Word. After embedding finishes, the filled file downloads automatically.
                  </p>
                  <label htmlFor="tmpl-tab">Upload template (.docx, .pptx, .xlsx, .txt, .md)</label>
                  <input
                    id="tmpl-tab"
                    type="file"
                    accept=".docx,.pptx,.xlsx,.xls,.xlsm,.txt,.md,.html"
                    onChange={onHldFile}
                  />
                  {templateFile && <p className="file-chip">Ready: {templateFile.name}</p>}
                  <label htmlFor="embed-src">Content to embed</label>
                  <select
                    id="embed-src"
                    value={embedInto}
                    onChange={(e) => setEmbedInto(e.target.value as ArtefactId)}
                  >
                    {ARTEFACTS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="submit-btn inline"
                      disabled={!templateFile || !!busy}
                      onClick={() =>
                        run("Embedding into template…", async () => {
                          if (!templateFile) return;
                          const result = await embedTemplate(
                            templateFile,
                            pack,
                            embedInto,
                            embedInto === "content" && tool === "template" ? "pack" : tool
                          );
                          downloadBlob(result.blob, `${pack.slug}-${result.filename}`);
                          setNote(result.message);
                        })
                      }
                    >
                      Embed & download
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() =>
                        run("Starter template…", async () =>
                          downloadBlob(await defaultHouseTemplateDocx(pack), "house-template-placeholders.docx")
                        )
                      }
                    >
                      Download blank token template
                    </button>
                  </div>
                  <h2>Tokens</h2>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Write this in the template</th>
                          <th>Replaced with</th>
                        </tr>
                      </thead>
                      <tbody>
                        {TOKEN_HELP.map(([tok, meaning]) => (
                          <tr key={tok}>
                            <td className="sku-pill">{tok}</td>
                            <td>{meaning}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}
        <p className="footnote">
          Planner output is a structured first draft for bid and delivery teams. It does not replace legal review, a
          signed SOW, or a hardware/cloud quotation.
        </p>
      </main>
      {printHtml && (
        <div className="print-overlay" role="dialog" aria-label="Print preview">
          <div className="print-overlay-bar">
            <button
              type="button"
              className="submit-btn inline"
              onClick={() => {
                const frame = document.getElementById("print-frame") as HTMLIFrameElement | null;
                frame?.contentWindow?.print();
              }}
            >
              Print / Save as PDF
            </button>
            <button type="button" className="ghost-btn" onClick={() => setPrintHtml(null)}>
              Close preview
            </button>
            <span>A4 layout of the current tab. Use the print dialog to send to a printer or Save as PDF.</span>
          </div>
          <iframe id="print-frame" title="Print preview" srcDoc={printHtml} />
        </div>
      )}
    </div>
  );
}

function DocPreview({
  title,
  sections,
  diagrams = [],
  onDownload,
  busy,
}: {
  title: string;
  sections: DocSection[];
  diagrams?: DeliveryPack["diagrams"];
  onDownload?: () => void;
  busy: boolean;
}) {
  return (
    <>
      {onDownload && (
        <button type="button" className="submit-btn inline" disabled={busy} onClick={onDownload}>
          Download {title} (.docx)
        </button>
      )}
      {sections.map((s) => {
        const diagram = s.diagramId ? diagrams.find((d) => d.id === s.diagramId) : undefined;
        return (
          <div key={s.heading} className="doc-block">
            <h2>{s.heading}</h2>
            <p className="layout-note">{s.body}</p>
            {s.paragraphs?.map((para) => (
              <p className="layout-note" key={para.slice(0, 48)}>
                {para}
              </p>
            ))}
            {s.numbered && (
              <ol className="doc-ol">
                {s.numbered.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ol>
            )}
            {s.bullets && (
              <ul className="assumptions">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {s.table && (
              <div className="scroll">
                <p className="layout-note">{s.table.caption}</p>
                <table>
                  <thead>
                    <tr>
                      {s.table.headers.map((hd) => (
                        <th key={hd}>{hd}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {diagram && (
              <>
                <p className="layout-note">
                  Figure — {diagram.title}. {diagram.caption}
                </p>
                <div className="arch-frame" dangerouslySetInnerHTML={{ __html: diagram.svg }} />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
