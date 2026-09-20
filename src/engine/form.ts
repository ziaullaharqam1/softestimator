import type { ArchitectureStyle } from "../architecture";
import type { PlannerInputs } from "./types";

export type FormState = {
  architectureStyle: ArchitectureStyle;
  tps: string;
  springBootServices: string;
  messaging: PlannerInputs["messaging"];
  observability: PlannerInputs["observability"];
  visualization: PlannerInputs["visualization"];
  includeKonga: boolean;
  includeLonghorn: boolean;
  includeArgoCd: boolean;
  includeJenkins: boolean;
  includeCicdPipeline: boolean;
  includeHarbor: boolean;
  includeSuperset: boolean;
  includePowerBi: boolean;
  avgPayloadKb: string;
  writeRatio: string;
  logRetentionDays: string;
  dataRetentionDays: string;
  haLevel: PlannerInputs["haLevel"];
  hypervisor: PlannerInputs["hypervisor"];
};

export const defaultForm: FormState = {
  architectureStyle: "microservices",
  tps: "500",
  springBootServices: "8",
  messaging: "rabbitmq",
  observability: "prometheus",
  visualization: "grafana",
  includeKonga: true,
  includeLonghorn: true,
  includeArgoCd: false,
  includeJenkins: false,
  includeCicdPipeline: false,
  includeHarbor: false,
  includeSuperset: false,
  includePowerBi: false,
  avgPayloadKb: "4",
  writeRatio: "0.35",
  logRetentionDays: "14",
  dataRetentionDays: "30",
  haLevel: "standard",
  hypervisor: "proxmox",
};

export function parseForm(form: FormState): { ok: true; value: PlannerInputs } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const num = (raw: string, label: string, min: number, max = Number.POSITIVE_INFINITY) => {
    const t = raw.trim();
    if (t === "" || t === "-" || t === "." || t === "-.") {
      errors.push(`${label} is required.`);
      return NaN;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) {
      errors.push(`${label} must be a number.`);
      return NaN;
    }
    if (n < min) errors.push(`${label} must be at least ${min}.`);
    if (n > max) errors.push(`${label} must be at most ${max}.`);
    return n;
  };

  const tps = num(form.tps, "TPS", 1);
  const springBootServices = num(form.springBootServices, "Spring Boot services", 1, 500);
  const avgPayloadKb = num(form.avgPayloadKb, "Avg payload (KB)", 0, 1024);
  const writeRatio = num(form.writeRatio, "Write ratio", 0, 1);
  const logRetentionDays = num(form.logRetentionDays, "Log retention", 1, 3650);
  const dataRetentionDays = num(form.dataRetentionDays, "DB retention", 1, 3650);

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      architectureStyle: form.architectureStyle,
      tps,
      springBootServices,
      messaging: form.messaging,
      observability: form.observability,
      visualization: form.visualization,
      includeKonga: form.includeKonga,
      includeLonghorn: form.includeLonghorn,
      includeArgoCd: form.includeArgoCd,
      includeJenkins: form.includeJenkins,
      includeCicdPipeline: form.includeCicdPipeline,
      includeHarbor: form.includeHarbor,
      includeSuperset: form.includeSuperset,
      includePowerBi: form.includePowerBi,
      avgPayloadKb,
      writeRatio,
      logRetentionDays,
      dataRetentionDays,
      haLevel: form.haLevel,
      hypervisor: form.hypervisor,
    },
  };
}

export function coercedInputs(form: FormState): PlannerInputs {
  const n = (raw: string, fallback: number, min = 0) => {
    const v = Number(String(raw).trim());
    return Number.isFinite(v) && v >= min ? v : fallback;
  };
  return {
    architectureStyle: form.architectureStyle,
    tps: n(form.tps, 500, 1),
    springBootServices: n(form.springBootServices, 8, 1),
    messaging: form.messaging,
    observability: form.observability,
    visualization: form.visualization,
    includeKonga: form.includeKonga,
    includeLonghorn: form.includeLonghorn,
    includeArgoCd: form.includeArgoCd,
    includeJenkins: form.includeJenkins,
    includeCicdPipeline: form.includeCicdPipeline,
    includeHarbor: form.includeHarbor,
    includeSuperset: form.includeSuperset,
    includePowerBi: form.includePowerBi,
    avgPayloadKb: n(form.avgPayloadKb, 4, 0),
    writeRatio: Math.min(1, Math.max(0, n(form.writeRatio, 0.35))),
    logRetentionDays: n(form.logRetentionDays, 14, 1),
    dataRetentionDays: n(form.dataRetentionDays, 30, 1),
    haLevel: form.haLevel,
    hypervisor: form.hypervisor,
  };
}
