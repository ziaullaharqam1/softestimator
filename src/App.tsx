import { useState } from "react";
import EstimatorApp from "./EstimatorApp";
import PlannerApp from "./planner/PlannerApp";
import PresenterApp from "./presenter/PresenterApp";
import { architectureBlurb, architectureLabel, type ArchitectureStyle } from "./architecture";

type Section = "estimator" | "planner" | "presenter";

export default function App() {
  const [section, setSection] = useState<Section>("estimator");
  const [architecture, setArchitecture] = useState<ArchitectureStyle>("microservices");
  const archName = architectureLabel(architecture);
  const tabId = `tab-${section}`;

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="brand">SoftEstimator</div>
        </div>
        <div className="header-nav">
          <nav className="section-switch arch-switch" aria-label="Architecture">
            <button
              type="button"
              className={architecture === "microservices" ? "active" : ""}
              onClick={() => setArchitecture("microservices")}
            >
              Microservices
            </button>
            <button
              type="button"
              className={architecture === "monolith-3tier" ? "active" : ""}
              onClick={() => setArchitecture("monolith-3tier")}
            >
              Monolithic 3-tier
            </button>
          </nav>
          <p className="arch-hint">{architectureBlurb(architecture)}</p>
        </div>
      </header>

      <div className="page-tabs-wrap">
        <nav className="page-tabs" role="tablist" aria-label="Workspace">
          <button
            type="button"
            role="tab"
            id="tab-estimator"
            aria-selected={section === "estimator"}
            aria-controls="workspace-panel"
            tabIndex={section === "estimator" ? 0 : -1}
            onClick={() => setSection("estimator")}
          >
            Cost estimator
          </button>
          <button
            type="button"
            role="tab"
            id="tab-planner"
            aria-selected={section === "planner"}
            aria-controls="workspace-panel"
            tabIndex={section === "planner" ? 0 : -1}
            onClick={() => setSection("planner")}
          >
            Delivery planner
          </button>
          <button
            type="button"
            role="tab"
            id="tab-presenter"
            aria-selected={section === "presenter"}
            aria-controls="workspace-panel"
            tabIndex={section === "presenter" ? 0 : -1}
            onClick={() => setSection("presenter")}
          >
            Presentation builder
          </button>
        </nav>

        <div
          className="page-tab-panel"
          role="tabpanel"
          id="workspace-panel"
          aria-labelledby={tabId}
        >
          <h1>
            {section === "estimator" ? "Stack, cluster & cloud cost planner" : section === "planner" ? "RFP & delivery document planner" : "Canva-ready presentation builder"}
            <span className="arch-pill">{archName}</span>
          </h1>
          <p className="lede">
            {section === "presenter"
              ? "Pick the architecture and technologies (database, language, load balancer, gateway, cache, messaging…), add the submitted description and screenshots, then download a costed deck as PPTX for Canva or PDF, with or without the client logo."
              : section === "estimator"
              ? architecture === "microservices"
                ? "Size a microservice stack from TPS: EKS / AKS / GKE versus EC2, Azure VM, and Compute Engine fleets (AED / month), plus on-prem Kubernetes nodes."
                : "Size a monolithic 3-tier stack from TPS: presentation, application, and data VMs on EC2 / Azure VM / Compute Engine (AED / month), plus on-prem racks. No Kubernetes control plane."
              : architecture === "microservices"
                ? "Turn a briefing into NDA, MSA, invoices, RFP Excel, SOW, BOQ, HLD/LLD, tests, Gantt, Kubernetes infrastructure, and a proposal deck. Architecture covers software, network, security, database, reporting, BI, and complaints handling."
                : "Turn a briefing into NDA, MSA, invoices, RFP Excel, SOW, BOQ, HLD/LLD, tests, Gantt, 3-tier VM infrastructure, and a proposal deck. Architecture covers software, network, security, database, reporting, BI, and complaints handling."}
          </p>
          {section === "estimator" ? (
            <EstimatorApp architecture={architecture} />
          ) : section === "planner" ? (
            <PlannerApp architecture={architecture} />
          ) : (
            <PresenterApp architecture={architecture} onArchitecture={setArchitecture} />
          )}
        </div>
      </div>
    </div>
  );
}
