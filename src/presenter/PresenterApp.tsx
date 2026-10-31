import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { ArchitectureStyle } from "../architecture";
import { FALLBACK_RATES, fetchLivePriceBook } from "../engine/livePricing";
import type { LivePriceBook } from "../engine/types";
import { FILTERS, HOSTING_LABEL, PRESETS, SLIDE_SECTIONS, type FilterKey, type Hosting, type Selections, type SlideSection } from "./catalog";
import { aed, buildDeck, type Screenshot } from "./deck";
import { deckHtml, downloadPdf, downloadPptx, type Logo } from "./render";

const MAX_SCREENSHOTS = 12;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function readImage(file: File): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_IMAGE_BYTES) return reject(new Error(`${file.name} is larger than 6 MB.`));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onload = () => {
        // Re-encode through a canvas so every image is a plain PNG/JPEG that PPTX and PDF accept.
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        const ctx = cv.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable."));
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        const png = file.type === "image/png" || file.type === "image/svg+xml";
        resolve({ dataUrl: cv.toDataURL(png ? "image/png" : "image/jpeg", 0.88), w: cv.width, h: cv.height });
      };
      img.onerror = () => reject(new Error(`${file.name} is not a readable image.`));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "platform";
const allSections = Object.fromEntries(SLIDE_SECTIONS.map(([k]) => [k, true])) as Record<SlideSection, boolean>;

export default function PresenterApp({ architecture, onArchitecture }: { architecture: ArchitectureStyle; onArchitecture: (a: ArchitectureStyle) => void }) {
  const preset = PRESETS.find((p) => p.architecture === architecture) ?? PRESETS[0];
  const [hosting, setHosting] = useState<Hosting>(preset.hosting);
  const [sel, setSel] = useState<Selections>(preset.selections);
  const [sections, setSections] = useState(allSections);
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [description, setDescription] = useState("");
  const [shots, setShots] = useState<Screenshot[]>([]);
  const [logo, setLogo] = useState<Logo | null>(null);
  const [tps, setTps] = useState("150");
  const [services, setServices] = useState("10");
  const [users, setUsers] = useState("50000");
  const [months, setMonths] = useState("12");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2, 1);
    return d.toISOString().slice(0, 10);
  });
  const [haLevel, setHaLevel] = useState<"standard" | "strict">("standard");
  const [book, setBook] = useState<LivePriceBook>(FALLBACK_RATES);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchLivePriceBook().then((b) => alive && setBook(b));
    return () => {
      alive = false;
    };
  }, []);

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setSel(p.selections);
    setHosting(p.hosting);
    if (p.architecture !== architecture) onArchitecture(p.architecture);
  };

  const num = (v: string, fallback: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  const deck = useMemo(
    () =>
      buildDeck({
        architecture,
        hosting,
        selections: sel,
        sections,
        projectName,
        clientName,
        vendorName,
        description,
        screenshots: shots,
        tps: num(tps, 150, 1, 200000),
        services: num(services, 10, 1, 300),
        users: num(users, 50000, 1, 100_000_000),
        durationMonths: num(months, 12, 2, 48),
        startDate,
        haLevel,
        book,
      }),
    [architecture, hosting, sel, sections, projectName, clientName, vendorName, description, shots, tps, services, users, months, startDate, haLevel, book]
  );
  const previewHtml = useMemo(
    () => deckHtml(deck, logo).replace("</style>", "body{background:#E9EDF2}.slide{margin:0 0 24px}</style>"),
    [deck, logo]
  );
  const previewRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.6);
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setZoom(Math.min(1, (el.clientWidth - 2) / 1280)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const slideCount = deck.slides.length + 1;

  const setFilter = (k: FilterKey, v: string) => setSel((s) => ({ ...s, [k]: v }));
  const toggleAi = (id: string) => setSel((s) => ({ ...s, aiTooling: s.aiTooling.includes(id) ? s.aiTooling.filter((x) => x !== id) : [...s.aiTooling, id] }));

  const onShots = async (e: ChangeEvent<HTMLInputElement>) => {
    setError("");
    const files = Array.from(e.target.files ?? []).slice(0, MAX_SCREENSHOTS - shots.length);
    e.target.value = "";
    try {
      const read = await Promise.all(files.map(async (f) => ({ name: f.name, caption: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), ...(await readImage(f)) })));
      setShots((s) => [...s, ...read].slice(0, MAX_SCREENSHOTS));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read image.");
    }
  };

  const onLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    setError("");
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setLogo(await readImage(f));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read logo.");
    }
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy("");
    }
  };

  const base = `${slug(projectName)}-${architecture === "microservices" ? "microservices" : "3tier"}-${hosting}`;
  const exportBtn = (kind: "pptx" | "pdf", withLogo: boolean) => {
    const label = `${kind.toUpperCase()} ${withLogo ? "with logo" : "no logo"}`;
    const disabled = !!busy || (withLogo && !logo);
    return (
      <button
        key={label}
        type="button"
        className={kind === "pptx" && withLogo ? "submit-btn inline" : "ghost-btn"}
        disabled={disabled}
        title={withLogo && !logo ? "Upload a client logo first" : undefined}
        onClick={() =>
          run(label, () =>
            kind === "pptx"
              ? downloadPptx(deck, withLogo ? logo : null, `${base}-${withLogo ? "with-logo" : "no-logo"}.pptx`)
              : downloadPdf(deck, withLogo ? logo : null, `${base}-${withLogo ? "with-logo" : "no-logo"}.pdf`)
          )
        }
      >
        {busy === label ? "Building…" : label}
      </button>
    );
  };

  const groups = ["Application", "Data", "Network & edge", "Platform & operations", "Delivery"] as const;
  const c = deck.costs;

  return (
    <div className="grid planner-grid presenter">
      <aside className="card presenter-filters">
        <h2>Presentation filters</h2>

        <label htmlFor="preset">Start from</label>
        <select id="preset" defaultValue="" onChange={(e) => applyPreset(e.target.value)}>
          <option value="" disabled>
            Choose a reference stack…
          </option>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <div className="row-2">
          <div>
            <label htmlFor="p-arch">Architecture</label>
            <select id="p-arch" value={architecture} onChange={(e) => onArchitecture(e.target.value as ArchitectureStyle)}>
              <option value="microservices">Microservices</option>
              <option value="monolith-3tier">Monolithic 3-tier</option>
            </select>
          </div>
          <div>
            <label htmlFor="p-host">Target hosting</label>
            <select id="p-host" value={hosting} onChange={(e) => setHosting(e.target.value as Hosting)}>
              {(Object.keys(HOSTING_LABEL) as Hosting[]).map((h) => (
                <option key={h} value={h}>
                  {HOSTING_LABEL[h]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {groups.map((section) => (
          <details key={section} className="filter-group" open={section === "Application" || section === "Data"}>
            <summary>{section}</summary>
            {FILTERS.filter((g) => g.section === section).map((g) =>
              g.multi ? (
                <fieldset key={g.id} className="checks">
                  <legend>{g.label}</legend>
                  {g.options.map((o) => (
                    <label key={o.id} className="check">
                      <input type="checkbox" checked={sel.aiTooling.includes(o.id)} onChange={() => toggleAi(o.id)} /> {o.label}
                    </label>
                  ))}
                </fieldset>
              ) : (
                <div key={g.id}>
                  <label htmlFor={`f-${g.id}`}>{g.label}</label>
                  <select id={`f-${g.id}`} value={sel[g.id as Exclude<FilterKey, "aiTooling">]} onChange={(e) => setFilter(g.id, e.target.value)}>
                    {g.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                        {o.licenceAedMonth ? ` (+${aed(o.licenceAedMonth)}/mo)` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )
            )}
          </details>
        ))}

        <details className="filter-group" open>
          <summary>Sizing & timeline</summary>
          <div className="row-2">
            <div>
              <label htmlFor="p-tps">Peak TPS</label>
              <input id="p-tps" inputMode="numeric" value={tps} onChange={(e) => setTps(e.target.value)} />
            </div>
            <div>
              <label htmlFor="p-svc">{architecture === "microservices" ? "Services" : "App modules"}</label>
              <input id="p-svc" inputMode="numeric" value={services} onChange={(e) => setServices(e.target.value)} />
            </div>
          </div>
          <div className="row-2">
            <div>
              <label htmlFor="p-users">Users</label>
              <input id="p-users" inputMode="numeric" value={users} onChange={(e) => setUsers(e.target.value)} />
            </div>
            <div>
              <label htmlFor="p-ha">High availability</label>
              <select id="p-ha" value={haLevel} onChange={(e) => setHaLevel(e.target.value as "standard" | "strict")}>
                <option value="standard">Standard (2 replicas)</option>
                <option value="strict">Strict (3 replicas)</option>
              </select>
            </div>
          </div>
          <div className="row-2">
            <div>
              <label htmlFor="p-months">Delivery months</label>
              <input id="p-months" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
            </div>
            <div>
              <label htmlFor="p-start">Start date</label>
              <input id="p-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
        </details>

        <details className="filter-group" open>
          <summary>Branding, description & screenshots</summary>
          <label htmlFor="p-name">Project / platform name</label>
          <input id="p-name" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Citizen Services Platform" />
          <div className="row-2">
            <div>
              <label htmlFor="p-client">Client</label>
              <input id="p-client" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="p-vendor">Your organisation</label>
              <input id="p-vendor" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
            </div>
          </div>
          <label htmlFor="p-desc">Description submitted</label>
          <textarea id="p-desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Paste the platform description, features, integrations, SLAs… Each sentence or line becomes a scope bullet." />
          <label htmlFor="p-logo">Client logo (optional)</label>
          <input id="p-logo" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onLogo} />
          {logo && (
            <p className="file-chip">
              Logo added ·{" "}
              <button type="button" className="link-btn" onClick={() => setLogo(null)}>
                remove
              </button>
            </p>
          )}
          <label htmlFor="p-shots">Screenshots (up to {MAX_SCREENSHOTS}, 2 per slide)</label>
          <input id="p-shots" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onShots} disabled={shots.length >= MAX_SCREENSHOTS} />
          {shots.length > 0 && (
            <ul className="shot-list">
              {shots.map((s, i) => (
                <li key={`${s.name}-${i}`}>
                  <img src={s.dataUrl} alt="" />
                  <input aria-label={`Caption for ${s.name}`} value={s.caption} onChange={(e) => setShots((all) => all.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} />
                  <button type="button" className="link-btn" onClick={() => setShots((all) => all.filter((_, j) => j !== i))} aria-label={`Remove ${s.name}`}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </details>

        <details className="filter-group">
          <summary>Slides to include</summary>
          <fieldset className="checks">
            {SLIDE_SECTIONS.map(([k, label]) => (
              <label key={k} className="check">
                <input type="checkbox" checked={sections[k]} onChange={() => setSections((s) => ({ ...s, [k]: !s[k] }))} /> {label}
              </label>
            ))}
          </fieldset>
        </details>
      </aside>

      <main>
        <div className="kpis">
          <div className="kpi">
            <div className="v">{aed(c.monthly[hosting])}</div>
            <div className="l">Monthly run · {hosting.toUpperCase()}</div>
          </div>
          <div className="kpi">
            <div className="v">{aed(c.deliveryAed + c.oneTimeInfra[hosting])}</div>
            <div className="l">One-time</div>
          </div>
          <div className="kpi">
            <div className="v">{aed(c.tco3[hosting])}</div>
            <div className="l">3-year hosting TCO</div>
          </div>
          <div className="kpi">
            <div className="v">{slideCount}</div>
            <div className="l">Slides</div>
          </div>
        </div>
        <div className="card">
          <div className="btn-row">
            {exportBtn("pptx", true)}
            {exportBtn("pptx", false)}
            {exportBtn("pdf", true)}
            {exportBtn("pdf", false)}
          </div>
          <p className="layout-note" style={{ marginTop: 0 }}>
            PPTX opens in Canva as an editable design: Canva → Create a design → Import file. Prices: {book.live ? "live" : "cached"} list prices, USD 1 = AED {book.usdAed}.
          </p>
          {error && <ul className="form-errors"><li>{error}</li></ul>}
          <div className="deck-preview" ref={previewRef}>
            <iframe
              title="Presentation preview"
              srcDoc={previewHtml}
              sandbox=""
              scrolling="no"
              style={{ width: 1280, height: slideCount * 744, zoom }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
