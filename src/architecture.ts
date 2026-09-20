export type ArchitectureStyle = "microservices" | "monolith-3tier";

export function architectureLabel(s: ArchitectureStyle) {
  return s === "microservices" ? "Microservices" : "Monolithic 3-tier";
}

export function architectureBlurb(s: ArchitectureStyle) {
  return s === "microservices"
    ? "Independently deployable services behind an API gateway, typically on Kubernetes."
    : "Presentation, application, and data tiers. One (or few) application binaries behind a reverse proxy.";
}
