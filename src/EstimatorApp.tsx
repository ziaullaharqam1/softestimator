import { useEffect, useMemo, useState, type FormEvent } from "react";
import { estimateCapacity } from "./engine/estimate";
import { priceK8sClouds, priceVmClouds } from "./engine/pricing";
import { FALLBACK_RATES, fetchLivePriceBook } from "./engine/livePricing";
import { priceOnPrem } from "./engine/onprem";
import { buildVmFleet } from "./engine/vmFleet";
import { defaultForm, parseForm, coercedInputs, type FormState } from "./engine/form";
import type { CloudBill, LivePriceBook, PlannerInputs } from "./engine/types";
import type { ReportingPlan } from "./engine/reporting";
import { buildReportingPlan } from "./engine/reporting";
import type { ArchitectureStyle } from "./architecture";

const fmtAed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const fmt = (n: number, d = 1) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: d }).format(n);

type Tab = "workloads" | "cluster" | "cloud" | "onprem" | "wellarch" | "assumptions" | "reporting";

function providerColor(p: CloudBill["provider"]) {
  return p === "AWS" ? "#ff9900" : p === "Azure" ? "#3b82f6" : "#34a853";
}

function CloudCards({ bills, maxTotal }: { bills: CloudBill[]; maxTotal: number }) {
  return (
    <div className="clouds">
      {bills.map((c) => {
        const color = providerColor(c.provider);
        const maxBar = Math.max(c.computeAed, c.storageAed, c.networkAed, c.managedAed, 1);
        return (
          <div className="cloud-card" key={c.product}>
            <h3 style={{ color }}>{c.product}</h3>
            <div className="region">
              {c.provider} · {c.region}
              {c.live ? " · live list price" : " · cached/fallback"}
            </div>
            <div className="total">{fmtAed(c.totalAed)}</div>
            <div className="sub">
              ${fmt(c.totalUsd, 0)} USD / month · {Math.round((c.totalAed / maxTotal) * 100)}% of highest in this model
            </div>
            <div className="bars">
              {(
                [
                  ["Compute", c.computeAed],
                  ["Storage", c.storageAed],
                  ["Network", c.networkAed],
                  ["Managed", c.managedAed],
                ] as const
              ).map(([l, v]) => (
                <div className="bar-row" key={l}>
                  <span>{l}</span>
                  <div className="bar">
                    <span style={{ width: `${(v / maxBar) * 100}%`, background: color }} />
                  </div>
                  <span>{fmtAed(v)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InstanceTable({ bills, caption }: { bills: CloudBill[]; caption: string }) {
  return (
    <>
      {bills.map((c) => (
        <div key={c.product} style={{ marginBottom: 18 }}>
          <h2>
            {c.product} — instance types
            <span className="region" style={{ marginLeft: 8, fontWeight: 400 }}>
              {caption}
            </span>
          </h2>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Purpose</th>
                  <th>Instance type</th>
                  <th className="num">Qty</th>
                  <th className="num">vCPU</th>
                  <th className="num">RAM Gi</th>
                  <th className="num">USD / hr</th>
                </tr>
              </thead>
              <tbody>
                {c.instances.map((i) => (
                  <tr key={`${c.product}-${i.purpose}-${i.sku}`}>
                    <td>{i.purpose}</td>
                    <td className="sku-pill">{i.sku}</td>
                    <td className="num">{i.qty}</td>
                    <td className="num">{i.vcpu || "—"}</td>
                    <td className="num">{i.memoryGi || "—"}</td>
                    <td className="num">{i.usdHour ? i.usdHour.toFixed(3) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>{c.product} line items</h2>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th className="num">Qty</th>
                  <th>Category</th>
                  <th className="num">AED / mo</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {c.lines.map((l) => (
                  <tr key={l.sku}>
                    <td>{l.sku}</td>
                    <td className="num">{l.qty}</td>
                    <td>{l.category}</td>
                    <td className="num">{fmtAed(l.aedMonth)}</td>
                    <td>{l.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

function ReportingPanel({ reporting, folded }: { reporting: ReportingPlan; folded: boolean }) {
  const effortTotal = reporting.effort.reduce((s, r) => s + r.costAedMonth, 0);
  const skuTotal = reporting.managedSkus.reduce((s, s0) => s + s0.aedMonth, 0);
  return (
    <>
      <p className="layout-note">{reporting.summary}</p>
      {!folded && (
        <p className="field-hint">
          Click <strong>Submit &amp; estimate</strong> to fold warehouse pods/VMs into cluster, cloud, and on-prem totals.
        </p>
      )}
      <div className="section-title">Data warehouse &amp; BI VMs</div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Tier</th>
              <th className="num">Count</th>
              <th className="num">vCPU</th>
              <th className="num">RAM Gi</th>
              <th className="num">Disk Gi</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {reporting.vms.map((v) => (
              <tr key={v.name}>
                <td>
                  {v.name}
                  <div className="sub">{v.role}</div>
                </td>
                <td>{v.tier}</td>
                <td className="num">{v.count}</td>
                <td className="num">{v.vcpu}</td>
                <td className="num">{v.ramGi}</td>
                <td className="num">{v.diskGi}</td>
                <td>{v.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="section-title">Pods / processes</div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Workload</th>
              <th>Role</th>
              <th className="num">Count</th>
              <th className="num">CPU req/lim</th>
              <th className="num">Mem req/lim Gi</th>
              <th className="num">PVC Gi</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {reporting.pods.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{p.role}</td>
                <td className="num">{p.count}</td>
                <td className="num">
                  {fmt(p.cpuRequest)} / {fmt(p.cpuLimit)}
                </td>
                <td className="num">
                  {fmt(p.memoryGiRequest)} / {fmt(p.memoryGiLimit)}
                </td>
                <td className="num">{p.storageGi}</td>
                <td>{p.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="section-title">Effort &amp; resources ({fmtAed(effortTotal)} / mo labour)</div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th className="num">FTE</th>
              <th className="num">Hours / mo</th>
              <th className="num">AED / h</th>
              <th className="num">AED / mo</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {reporting.effort.map((r) => (
              <tr key={r.role}>
                <td>{r.role}</td>
                <td className="num">{fmt(r.fte, 2)}</td>
                <td className="num">{fmt(r.hoursPerMonth, 0)}</td>
                <td className="num">{r.aedPerHour}</td>
                <td className="num">{fmtAed(r.costAedMonth)}</td>
                <td>{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="section-title">Platform resources</div>
      <ul>
        {reporting.resources.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {reporting.managedSkus.length > 0 && (
        <>
          <div className="section-title">Power BI SaaS SKUs ({fmtAed(skuTotal)} / mo planning)</div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th className="num">Qty</th>
                  <th className="num">AED / mo</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {reporting.managedSkus.map((s) => (
                  <tr key={s.sku}>
                    <td>{s.sku}</td>
                    <td className="num">{s.qty}</td>
                    <td className="num">{fmtAed(s.aedMonth)}</td>
                    <td>{s.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="section-title">Data analytics</div>
      <ul>
        {reporting.analytics.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <div className="section-title">Insights</div>
      <ul>
        {reporting.insights.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <div className="section-title">KPIs</div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>KPI</th>
              <th>Grain</th>
              <th>Source</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {reporting.kpis.map((k) => (
              <tr key={k.name}>
                <td>{k.name}</td>
                <td>{k.grain}</td>
                <td>{k.source}</td>
                <td>{k.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function EstimatorApp({ architecture }: { architecture: ArchitectureStyle }) {
  const [form, setForm] = useState<FormState>({ ...defaultForm, architectureStyle: architecture });
  const [submitted, setSubmitted] = useState<PlannerInputs | null>(null);
  const [book, setBook] = useState<LivePriceBook>(FALLBACK_RATES);
  const [errors, setErrors] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("workloads");
  const [busy, setBusy] = useState(false);
  const micro = architecture === "microservices";

  useEffect(() => {
    setForm((s) => ({
      ...s,
      architectureStyle: architecture,
      includeKonga: architecture === "microservices" ? s.includeKonga : false,
      includeLonghorn: architecture === "microservices" ? s.includeLonghorn : false,
      includeArgoCd: architecture === "microservices" ? s.includeArgoCd : false,
      includeJenkins: architecture === "microservices" ? s.includeJenkins : false,
      includeCicdPipeline: architecture === "microservices" ? s.includeCicdPipeline : false,
      includeHarbor: architecture === "microservices" ? s.includeHarbor : false,
    }));
    setSubmitted(null);
    setTab("workloads");
  }, [architecture]);

  const plan = useMemo(() => (submitted ? estimateCapacity(submitted) : null), [submitted]);
  const fleet = useMemo(() => (plan ? buildVmFleet(plan) : []), [plan]);
  const k8sClouds = useMemo(() => (plan ? priceK8sClouds(plan, book) : []), [plan, book]);
  const vmClouds = useMemo(() => (plan ? priceVmClouds(plan, fleet, book) : []), [plan, fleet, book]);
  const onprem = useMemo(() => (plan && submitted ? priceOnPrem(plan, submitted) : null), [plan, submitted]);
  const liveReporting = useMemo(() => buildReportingPlan(coercedInputs(form)), [form]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const toggleReporting = (field: "includeSuperset" | "includePowerBi", on: boolean) => {
    setForm((s) => ({ ...s, [field]: on }));
    const other = field === "includeSuperset" ? form.includePowerBi : form.includeSuperset;
    if (on || other) setTab("reporting");
    else setTab((t) => (t === "reporting" ? "workloads" : t));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseForm(form);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setSubmitted(null);
      return;
    }
    setBusy(true);
    setErrors([]);
    const live = await fetchLivePriceBook();
    setBook(live);
    if (live.warnings.length && !live.live) setErrors(live.warnings);
    setSubmitted(parsed.value);
    setTab(parsed.value.includeSuperset || parsed.value.includePowerBi ? "reporting" : "workloads");
    setBusy(false);
  };

  const podsNamed = (name: string) => plan?.workloads.find((w) => w.name === name)?.count ?? 0;
  const podsRole = (role: string) =>
    plan?.workloads.filter((w) => w.role === role).reduce((s, w) => s + w.count, 0) ?? 0;
  const devopsNote = submitted
    ? [
        submitted.includeArgoCd && `Argo CD ${podsRole("gitops") + podsNamed("argocd-redis")} pods`,
        submitted.includeJenkins &&
          `Jenkins ${podsNamed("jenkins-controller") + podsNamed("jenkins-agent")} pods`,
        submitted.includeCicdPipeline &&
          `CI/CD ${podsNamed("cicd-control-plane") + podsNamed("cicd-runners")} pods`,
        submitted.includeHarbor && `Harbor ${podsRole("registry") + podsNamed("harbor-db") + podsNamed("harbor-redis")} pods`,
        submitted.includeSuperset && `Superset ${podsRole("bi") + podsNamed("superset-meta-db") + podsNamed("superset-redis")} pods`,
        submitted.includePowerBi && "Power BI gateway VMs + Premium SKU",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const kong = plan?.workloads.find((w) => w.name === "kong");
  const pgP = plan?.workloads.find((w) => w.name === "postgres-primary");
  const pgR = plan?.workloads.find((w) => w.name === "postgres-replica");
  const redis = plan?.workloads.find((w) => w.name === "redis");
  const mq =
    plan?.workloads.find((w) => w.name === "rabbitmq") ?? plan?.workloads.find((w) => w.name === "kafka");
  const cps = plan?.nodes.find((n) => n.role === "control-plane");
  const dataPool = plan?.nodes.find((n) => n.role === "data");
  const workers = plan?.nodes.find((n) => n.role === "worker");
  const cheapestK8s = k8sClouds.length ? k8sClouds.reduce((a, b) => (a.totalAed < b.totalAed ? a : b)) : null;
  const cheapestVm = vmClouds.length ? vmClouds.reduce((a, b) => (a.totalAed < b.totalAed ? a : b)) : null;
  const maxK8s = k8sClouds.length ? Math.max(...k8sClouds.map((c) => c.totalAed)) : 1;
  const maxVm = vmClouds.length ? Math.max(...vmClouds.map((c) => c.totalAed)) : 1;

  return (
    <div className="grid">
        <aside className="card">
          <h2>Workload inputs</h2>
          <form onSubmit={onSubmit}>
          <label htmlFor="tps">TPS / requests per second</label>
          <input
            id="tps"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={form.tps}
            onChange={(e) => setField("tps", e.target.value)}
          />
          <label htmlFor="svc">{micro ? "Spring Boot services" : "Logical modules (same application binary)"}</label>
          <input
            id="svc"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={form.springBootServices}
            onChange={(e) => setField("springBootServices", e.target.value)}
          />
          <div className="row-2">
            <div>
              <label htmlFor="msg">Messaging</label>
              <select
                id="msg"
                value={form.messaging}
                onChange={(e) => setField("messaging", e.target.value as FormState["messaging"])}
              >
                <option value="rabbitmq">RabbitMQ</option>
                <option value="kafka">Kafka</option>
              </select>
            </div>
            <div>
              <label htmlFor="obs">Observability</label>
              <select
                id="obs"
                value={form.observability}
                onChange={(e) => setField("observability", e.target.value as FormState["observability"])}
              >
                <option value="prometheus">Prometheus</option>
                <option value="elk">ELK</option>
              </select>
            </div>
          </div>
          <div className="row-2">
            <div>
              <label htmlFor="viz">Dashboards / NM</label>
              <select
                id="viz"
                value={form.visualization}
                onChange={(e) => setField("visualization", e.target.value as FormState["visualization"])}
              >
                <option value="grafana">Grafana</option>
                <option value="zabbix">Zabbix</option>
              </select>
            </div>
            <div>
              <label htmlFor="ha">HA level</label>
              <select
                id="ha"
                value={form.haLevel}
                onChange={(e) => setField("haLevel", e.target.value as FormState["haLevel"])}
              >
                <option value="standard">Standard (N+1)</option>
                <option value="strict">Strict (N+2 / 3 AZ)</option>
              </select>
            </div>
          </div>
          <div className="row-2">
            <div>
              <label htmlFor="payload">Avg payload (KB)</label>
              <input
                id="payload"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={form.avgPayloadKb}
                onChange={(e) => setField("avgPayloadKb", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="write">Write ratio (0–1)</label>
              <input
                id="write"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={form.writeRatio}
                onChange={(e) => setField("writeRatio", e.target.value)}
              />
            </div>
          </div>
          <div className="row-2">
            <div>
              <label htmlFor="logs">Log retention (days)</label>
              <input
                id="logs"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={form.logRetentionDays}
                onChange={(e) => setField("logRetentionDays", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="data">DB retention (days)</label>
              <input
                id="data"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={form.dataRetentionDays}
                onChange={(e) => setField("dataRetentionDays", e.target.value)}
              />
            </div>
          </div>
          <label htmlFor="hv">On-prem hypervisor</label>
          <select
            id="hv"
            value={form.hypervisor}
            onChange={(e) => setField("hypervisor", e.target.value as FormState["hypervisor"])}
          >
            <option value="proxmox">Proxmox / KVM</option>
            <option value="vmware">VMware vSphere</option>
          </select>
          {micro && (
            <>
          <label className="check">
            <input
              type="checkbox"
              checked={form.includeKonga}
              onChange={(e) => setField("includeKonga", e.target.checked)}
            />
            Include Konga (Kong admin UI)
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.includeLonghorn}
              onChange={(e) => setField("includeLonghorn", e.target.checked)}
            />
            Longhorn for generic PVCs only (stateful disks stay zonal SSD)
          </label>
          <p className="field-hint">DevOps &amp; registry (opt-in)</p>
          <label className="check">
            <input
              type="checkbox"
              checked={form.includeArgoCd}
              onChange={(e) => setField("includeArgoCd", e.target.checked)}
            />
            Include Argo CD (GitOps continuous delivery)
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.includeJenkins}
              onChange={(e) => setField("includeJenkins", e.target.checked)}
            />
            Include Jenkins (CI controller + build agents)
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.includeCicdPipeline}
              onChange={(e) => setField("includeCicdPipeline", e.target.checked)}
            />
            Include CI/CD pipeline (Tekton / Actions control plane + runners)
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.includeHarbor}
              onChange={(e) => setField("includeHarbor", e.target.checked)}
            />
            Include Harbor (private image registry + Trivy)
          </label>
            </>
          )}
          <p className="field-hint">Reporting &amp; analytics (opt-in, independent)</p>
          <label className="check">
            <input
              type="checkbox"
              checked={form.includeSuperset}
              onChange={(e) => toggleReporting("includeSuperset", e.target.checked)}
            />
            Apache Superset (self-hosted BI — pods, metadata DB, warehouse)
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.includePowerBi}
              onChange={(e) => toggleReporting("includePowerBi", e.target.checked)}
            />
            Microsoft Power BI (SaaS + on-premises data gateway VMs)
          </label>
          {errors.length > 0 && (
            <ul className="form-errors">
              {errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}
          <button type="submit" className="submit-btn" disabled={busy}>
            {busy ? "Fetching live cloud prices…" : "Submit & estimate"}
          </button>
          </form>
        </aside>

        <main>
          {!plan || !submitted || !onprem || !cheapestVm || (micro && !cheapestK8s) ? (
            <div className="card empty-state">
              <h2>No estimate yet</h2>
              <p className="layout-note">
                Enter TPS and stack options on the left, then click <strong>Submit &amp; estimate</strong>. Results stay
                frozen until you submit again so you can edit zeros and decimals without the plan jumping around.
              </p>
              {liveReporting && (
                <>
                  <h2>Reporting stack</h2>
                  <ReportingPanel reporting={liveReporting} folded={false} />
                </>
              )}
            </div>
          ) : (
            <>
          <div className="kpis">
            <div className="kpi">
              <div className="v">{plan.vmCount}</div>
              <div className="l">{micro ? "VMs / K8s nodes" : "3-tier VMs"}</div>
            </div>
            <div className="kpi">
              <div className="v">{micro ? plan.totalPods : plan.totalAppReplicas}</div>
              <div className="l">{micro ? "Schedulable pods" : "App-tier processes"}</div>
            </div>
            <div className="kpi">
              <div className="v">{fmt(plan.clusterCpuRequest)} / {fmt(plan.clusterMemGiRequest)} Gi</div>
              <div className="l">CPU req / memory req</div>
            </div>
            <div className="kpi">
              <div className="v">{fmt((micro ? cheapestK8s!.totalAed : cheapestVm.totalAed), 0)}</div>
              <div className="l">
                {micro
                  ? `Lowest EKS/AKS/GKE AED / mo (${cheapestK8s!.provider})`
                  : `Lowest 3-tier cloud VMs AED / mo (${cheapestVm.provider})`}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="tabs">
              {(
                micro
                  ? ([
                      ["workloads", "Pods & specs"],
                      ["cluster", "VMs & nodes"],
                      ["cloud", "EKS/AKS/GKE & VMs"],
                      ["onprem", "On-prem BOM"],
                      ...(liveReporting ? ([["reporting", "Reporting"]] as [Tab, string][]) : []),
                      ["wellarch", "Well-architected"],
                      ["assumptions", "Assumptions"],
                    ] as [Tab, string][])
                  : ([
                      ["workloads", "Tiers & processes"],
                      ["cluster", "3-tier VMs"],
                      ["cloud", "Cloud VMs"],
                      ["onprem", "On-prem BOM"],
                      ...(liveReporting ? ([["reporting", "Reporting"]] as [Tab, string][]) : []),
                      ["wellarch", "Well-architected"],
                      ["assumptions", "Assumptions"],
                    ] as [Tab, string][])
              ).map(([id, label]) => (
                <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>

            {tab === "workloads" && (
              <>
                <p className="layout-note">
                  {micro ? (
                    <>
                  Exact data-plane counts: Kong <strong>{kong?.count}</strong> pods · Postgres{" "}
                  <strong>{(pgP?.count ?? 0) + (pgR?.count ?? 0)}</strong> pods (1 primary + {pgR?.count}{" "}
                  {pgR?.count === 1 ? "replica" : "replicas"}) · Redis <strong>{redis?.count}</strong> ·{" "}
                  {mq?.name} <strong>{mq?.count}</strong>. Max pods / VM:{" "}
                  <strong>{plan.maxPodsPerVm}</strong>. App replicas across {submitted.springBootServices} Spring Boot
                  services: <strong>{plan.totalAppReplicas}</strong>
                  {devopsNote ? `. ${devopsNote}.` : "."}
                    </>
                  ) : (
                    <>
                      3-tier inventory: reverse proxy <strong>{plan.workloads.find((w) => w.name === "reverse-proxy")?.count}</strong>{" "}
                      · monolith app <strong>{plan.totalAppReplicas}</strong> · Postgres{" "}
                      <strong>{(pgP?.count ?? 0) + (pgR?.count ?? 0)}</strong> · Redis <strong>{redis?.count}</strong>.
                      Logical modules in one binary: <strong>{submitted.springBootServices}</strong>.
                    </>
                  )}
                </p>
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Workload</th>
                        <th>Role</th>
                        <th className="num">{micro ? "Pods" : "Count"}</th>
                        <th className="num">CPU req/lim</th>
                        <th className="num">Mem Gi req/lim</th>
                        <th className="num">Disk Gi / pod</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.workloads.map((w) => (
                        <tr key={w.name}>
                          <td>{w.name}</td>
                          <td>{w.role}</td>
                          <td className="num">{w.count}</td>
                          <td className="num">
                            {fmt(w.cpuRequest)} / {fmt(w.cpuLimit)}
                          </td>
                          <td className="num">
                            {fmt(w.memoryGiRequest)} / {fmt(w.memoryGiLimit)}
                          </td>
                          <td className="num">{fmt(w.storageGi, 0)}</td>
                          <td>{w.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === "reporting" && liveReporting && (
              <ReportingPanel reporting={liveReporting} folded={Boolean(plan?.reporting)} />
            )}

            {tab === "cluster" && (
              <>
                <p className="layout-note">
                  {micro ? (
                    <>
                  {cps?.count ?? 0} control-plane + {dataPool?.count ?? 0} data nodes + {workers?.count ?? 0} general
                  workers = <strong>{plan.k8sNodeCount}</strong>{" "}
                  Kubernetes nodes. Persistent claim {fmt(plan.persistentStorageGi, 0)} Gi
                  {submitted.includeLonghorn
                    ? `, Longhorn physical ~${fmt(plan.longhornPhysicalGi, 0)} Gi at 3× replication.`
                    : "."}{" "}
                  Peak concurrent connections (est.) {plan.peakConcurrent}.
                    </>
                  ) : (
                    <>
                      Presentation {plan.nodes.find((n) => n.role === "presentation")?.count ?? 0} + application{" "}
                      {plan.nodes.find((n) => n.role === "application")?.count ?? 0} + data{" "}
                      {plan.nodes.find((n) => n.role === "data")?.count ?? 0} = <strong>{plan.vmCount}</strong> VMs.
                      Persistent disk {fmt(plan.persistentStorageGi, 0)} Gi. Peak concurrent (est.) {plan.peakConcurrent}.
                    </>
                  )}
                </p>
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Node role</th>
                        <th className="num">Count</th>
                        <th className="num">vCPU</th>
                        <th className="num">Memory Gi</th>
                        <th className="num">OS disk</th>
                        <th className="num">Data disk</th>
                        <th className="num">{micro ? "Max pods" : "Processes"}</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.nodes.map((n, i) => (
                        <tr key={`${n.role}-${i}`}>
                          <td>{n.role}</td>
                          <td className="num">{n.count}</td>
                          <td className="num">{n.vcpu}</td>
                          <td className="num">{n.memoryGi}</td>
                          <td className="num">{n.osDiskGi} Gi</td>
                          <td className="num">{n.dataDiskGi} Gi</td>
                          <td className="num">{n.maxPods}</td>
                          <td>{n.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === "cloud" && (
              <>
                {micro && cheapestK8s && (
                  <>
                <div className="section-title">Managed Kubernetes</div>
                <p className="compare-win">
                  Cheapest managed cluster: <strong>{cheapestK8s.product}</strong> at {fmtAed(cheapestK8s.totalAed)} /
                  month. Control planes are billed as EKS / AKS / GKE; workers are customer VMs of the types below.
                  FX {book.usdAed.toFixed(4)} AED per USD
                  {book.fetchedAt
                    ? ` · prices pulled ${new Date(book.fetchedAt).toLocaleString()} from ${book.sources.join("; ") || "fallback"}`
                    : ""}
                  . {book.live ? "On-demand list rates are live." : "Live feeds were unavailable for some providers."}
                </p>
                <CloudCards bills={k8sClouds} maxTotal={maxK8s} />
                <InstanceTable bills={k8sClouds} caption="node pools + managed control plane" />
                  </>
                )}

                <div className="section-title">{micro ? "Dedicated VM fleet (no Kubernetes)" : "3-tier VM fleet (presentation / application / data)"}</div>
                <p className="compare-win">
                  Same stack on VMs: EC2, Azure Virtual Machines, and Compute Engine. Cheapest fleet:{" "}
                  <strong>{cheapestVm.product}</strong> at {fmtAed(cheapestVm.totalAed)} / month.
                  {micro
                    ? " Data services get memory-optimized types; Kong gets compute-optimized."
                    : " Presentation is the reverse proxy; application is the monolith; data is PostgreSQL/Redis — not a Kubernetes node pool."}
                </p>
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Deployable</th>
                        <th className="num">VMs</th>
                        <th className="num">Need vCPU / RAM</th>
                        <th>EC2 type</th>
                        <th>Azure VM type</th>
                        <th>GCP instance</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fleet.map((d) => (
                        <tr key={d.name}>
                          <td>
                            {d.name}
                            <div className="sub">{d.role}</div>
                          </td>
                          <td className="num">{d.count}</td>
                          <td className="num">
                            {d.vcpu} / {d.memoryGi} Gi
                          </td>
                          <td className="sku-pill">
                            {d.aws.sku}
                            <div className="sub">
                              {d.aws.vcpu} vCPU · {d.aws.memoryGi} Gi
                            </div>
                          </td>
                          <td className="sku-pill">
                            {d.azure.sku}
                            <div className="sub">
                              {d.azure.vcpu} vCPU · {d.azure.memoryGi} Gi
                            </div>
                          </td>
                          <td className="sku-pill">
                            {d.gcp.sku}
                            <div className="sub">
                              {d.gcp.vcpu} vCPU · {d.gcp.memoryGi} Gi
                            </div>
                          </td>
                          <td>{d.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <CloudCards bills={vmClouds} maxTotal={maxVm} />
                <InstanceTable bills={vmClouds} caption="per-workload instance SKUs" />
              </>
            )}

            {tab === "onprem" && (
              <>
                <div className="tco">
                  <div className="kpi">
                    <div className="v">{fmtAed(onprem.capexAed)}</div>
                    <div className="l">Hardware + install capex</div>
                  </div>
                  <div className="kpi">
                    <div className="v">{fmtAed(onprem.monthlyOpexAed)}</div>
                    <div className="l">Monthly opex</div>
                  </div>
                  <div className="kpi">
                    <div className="v">{fmtAed(onprem.monthlyEquivalentAed)}</div>
                    <div className="l">3-year monthly equivalent</div>
                  </div>
                  <div className="kpi">
                    <div className="v">{onprem.physicalServers} / {onprem.racks}</div>
                    <div className="l">Rack servers / racks</div>
                  </div>
                </div>
                <p className="layout-note">
                  36-month TCO {fmtAed(onprem.threeYearTcoAed)} including colo, power, support, and fractional platform
                  staff. Cloud comparison above is opex-only; this view splits capex vs run-rate.
                </p>
                <h2>Rack &amp; network layout</h2>
                {onprem.rackLayout.map((n) => (
                  <p className="layout-note" key={n}>
                    {n}
                  </p>
                ))}
                <h2>VMs to create</h2>
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>VM name</th>
                        <th className="num">Count</th>
                        <th className="num">vCPU</th>
                        <th className="num">RAM Gi</th>
                        <th className="num">Disk Gi</th>
                        <th>Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {onprem.vmInventory.map((v) => (
                        <tr key={v.name}>
                          <td>{v.name}</td>
                          <td className="num">{v.count}</td>
                          <td className="num">{v.vcpu}</td>
                          <td className="num">{v.memoryGi}</td>
                          <td className="num">{v.diskGi}</td>
                          <td>{v.purpose}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h2>Bill of materials</h2>
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="num">Qty</th>
                        <th>Type</th>
                        <th className="num">AED / mo (opex rows)</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {onprem.lines.map((l) => (
                        <tr key={l.sku}>
                          <td>{l.sku}</td>
                          <td className="num">{l.qty}</td>
                          <td>{l.category}</td>
                          <td className="num">{l.aedMonth ? fmtAed(l.aedMonth) : "—"}</td>
                          <td>{l.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === "wellarch" && (
              <ul className="assumptions">
                {plan.wellArchitected.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}

            {tab === "assumptions" && (
              <ul className="assumptions">
                {plan.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </div>
            </>
          )}

          <p className="footnote">
            Planning model, not a vendor quote. Cloud figures use public on-demand list-price shapes for UAE/GCC
            regions, 730 hours/month, no EDPs, CUDs, RIs, or spot. On-prem server/switch prices are typical GCC
            channel quotes for Dell R760 / HPE DL380-class 1U dual-socket nodes and 25Gb leaf pairs. Confirm with
            AWS/Azure/GCP calculators and a hardware integrator before purchase.
          </p>
        </main>
      </div>
  );
}
