import { useState } from "react";

const LEGACY_TAB_MAP: Record<string, string> = {
  clinical_evolution: "consultas",
  sessions: "exames",
  evolution: "consultas",
  timeline: "evolutivo",
  anamnese: "contexto",
  body_composition: "contexto",
  imaging: "contexto",
};

export const TAB_LABELS: Record<string, string> = {
  resumo: "Resumo",
  consultas: "Consultas",
  exames: "Exames",
  evolutivo: "Evolutivo",
  contexto: "Contexto",
  analysis: "Análise IA",
};

const VALID_TABS = ["resumo", "consultas", "exames", "evolutivo", "contexto", "analysis"];

function getInitialTab(): string {
  const params = new URLSearchParams(window.location.search);
  const rawTab = params.get("tab") ?? "";
  if (LEGACY_TAB_MAP[rawTab]) return LEGACY_TAB_MAP[rawTab];
  return VALID_TABS.includes(rawTab) ? rawTab : "resumo";
}

export function usePatientTabs() {
  const [detailTab, setDetailTab] = useState<string>(getInitialTab);

  return { detailTab, setDetailTab };
}
