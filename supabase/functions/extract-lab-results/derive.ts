/**
 * derive.ts
 *
 * Responsável EXCLUSIVAMENTE por:
 *   - Cálculo de valores derivados (HOMA-IR, ratios, bilirrubina indireta, etc.)
 *   - Aplicação de REFERENCE_OVERRIDES (enriquecimento de referência)
 *   - Validação DHEA-S por idade/sexo (enriquecimento de referência)
 *
 * NÃO faz:
 *   - Conversão de unidade (→ convert.ts)
 *   - Ajuste de escala (→ validate.ts / validateAndFixValues)
 *   - Inferência de unidade (→ unitInference.ts)
 *   - Validação estrutural final (→ validate.ts)
 */

import { REFERENCE_OVERRIDES, DHEA_RANGES_BY_AGE } from "./constants.ts";

// ─── Cálculos Derivados ──────────────────────────────────────────────────────

/**
 * Calcula valores derivados que a IA pode não ter extraído.
 * Só adiciona se o marcador derivado ainda NÃO existir (exceto PSA ratio, sempre recalculado).
 */
export function calculateDerivedValues(results: any[]): any[] {
  const resultMap = new Map<string, any>();
  for (const r of results) {
    resultMap.set(r.marker_id, r);
  }

  // Fix psa_ratio: ALWAYS recalculate from psa_livre/psa_total when both are available.
  if (resultMap.has("psa_ratio")) {
    const existing = resultMap.get("psa_ratio");
    if (typeof existing.value === "number") {
      if (resultMap.has("psa_livre") && resultMap.has("psa_total")) {
        const psaL = resultMap.get("psa_livre").value;
        const psaT = resultMap.get("psa_total").value;
        if (typeof psaL === "number" && typeof psaT === "number" && psaT > 0) {
          const recalculated = Math.round((psaL / psaT) * 100 * 10) / 10;
          console.log(`[PSA] Recalculated psa_ratio: ${existing.value} → ${recalculated}% (from ${psaL}/${psaT})`);
          existing.value = recalculated;
        }
      } else if (existing.value < 1.0 && existing.value > 0) {
        existing.value = Math.round(existing.value * 100 * 10) / 10;
        console.log(`[PSA] Converted psa_ratio from fraction: ${existing.value}%`);
      }
    }
  }

  // Bilirrubina Indireta = Total - Direta
  if (!resultMap.has("bilirrubina_indireta") && resultMap.has("bilirrubina_total") && resultMap.has("bilirrubina_direta")) {
    const bt = resultMap.get("bilirrubina_total").value;
    const bd = resultMap.get("bilirrubina_direta").value;
    if (typeof bt === "number" && typeof bd === "number") {
      const bi = Math.round((bt - bd) * 100) / 100;
      if (bi >= 0) {
        results.push({ marker_id: "bilirrubina_indireta", value: bi });
        console.log(`Calculated bilirrubina_indireta: ${bt} - ${bd} = ${bi}`);
      }
    }
  }

  // Colesterol Não-HDL = CT - HDL
  if (!resultMap.has("colesterol_nao_hdl") && resultMap.has("colesterol_total") && resultMap.has("hdl")) {
    const ct = resultMap.get("colesterol_total").value;
    const hdl = resultMap.get("hdl").value;
    if (typeof ct === "number" && typeof hdl === "number") {
      const naoHdl = Math.round(ct - hdl);
      if (naoHdl >= 0) {
        results.push({ marker_id: "colesterol_nao_hdl", value: naoHdl });
        console.log(`Calculated colesterol_nao_hdl: ${ct} - ${hdl} = ${naoHdl}`);
      }
    }
  }

  // CT/HDL ratio
  if (!resultMap.has("relacao_ct_hdl") && resultMap.has("colesterol_total") && resultMap.has("hdl")) {
    const ct = resultMap.get("colesterol_total").value;
    const hdl = resultMap.get("hdl").value;
    if (typeof ct === "number" && typeof hdl === "number" && hdl > 0) {
      const ratio = Math.round((ct / hdl) * 100) / 100;
      results.push({ marker_id: "relacao_ct_hdl", value: ratio });
      console.log(`Calculated relacao_ct_hdl: ${ct} / ${hdl} = ${ratio}`);
    }
  }

  // TG/HDL ratio
  if (!resultMap.has("relacao_tg_hdl") && resultMap.has("triglicerides") && resultMap.has("hdl")) {
    const tg = resultMap.get("triglicerides").value;
    const hdl = resultMap.get("hdl").value;
    if (typeof tg === "number" && typeof hdl === "number" && hdl > 0) {
      const ratio = Math.round((tg / hdl) * 100) / 100;
      results.push({ marker_id: "relacao_tg_hdl", value: ratio });
      console.log(`Calculated relacao_tg_hdl: ${tg} / ${hdl} = ${ratio}`);
    }
  }

  // ApoB/ApoA1 ratio
  if (!resultMap.has("relacao_apob_apoa1") && resultMap.has("apo_b") && resultMap.has("apo_a1")) {
    const apoB = resultMap.get("apo_b").value;
    const apoA1 = resultMap.get("apo_a1").value;
    if (typeof apoB === "number" && typeof apoA1 === "number" && apoA1 > 0) {
      const ratio = Math.round((apoB / apoA1) * 100) / 100;
      results.push({ marker_id: "relacao_apob_apoa1", value: ratio });
      console.log(`Calculated relacao_apob_apoa1: ${apoB} / ${apoA1} = ${ratio}`);
    }
  }

  // HOMA-IR = (Glicose × Insulina) / 405
  if (!resultMap.has("homa_ir") && resultMap.has("glicose_jejum") && resultMap.has("insulina_jejum")) {
    const glicose = resultMap.get("glicose_jejum").value;
    const insulina = resultMap.get("insulina_jejum").value;
    if (typeof glicose === "number" && typeof insulina === "number") {
      const homa = Math.round((glicose * insulina / 405) * 100) / 100;
      results.push({ marker_id: "homa_ir", value: homa });
      console.log(`Calculated homa_ir: (${glicose} × ${insulina}) / 405 = ${homa}`);
    }
  }

  // Neutrófilos = Bastonetes + Segmentados
  if (!resultMap.has("neutrofilos") && resultMap.has("bastonetes") && resultMap.has("segmentados")) {
    const bast = resultMap.get("bastonetes").value;
    const seg = resultMap.get("segmentados").value;
    if (typeof bast === "number" && typeof seg === "number") {
      const neutro = Math.round((bast + seg) * 100) / 100;
      results.push({ marker_id: "neutrofilos", value: neutro });
      console.log(`Calculated neutrofilos: ${bast} + ${seg} = ${neutro}`);
    }
  }

  // Fixação Latente do Ferro = TIBC - Ferro Sérico
  if (!resultMap.has("fixacao_latente_ferro") && resultMap.has("tibc") && resultMap.has("ferro_serico")) {
    const tibc = resultMap.get("tibc").value;
    const ferro = resultMap.get("ferro_serico").value;
    if (typeof tibc === "number" && typeof ferro === "number") {
      const latente = Math.round(tibc - ferro);
      if (latente >= 0) {
        results.push({ marker_id: "fixacao_latente_ferro", value: latente });
        console.log(`Calculated fixacao_latente_ferro: ${tibc} - ${ferro} = ${latente}`);
      }
    }
  }

  // Razão Albumina/Creatinina urinária (ACR)
  if (!resultMap.has("urina_acr") && resultMap.has("urina_albumina") && resultMap.has("urina_creatinina")) {
    const alb = resultMap.get("urina_albumina").value;
    const crea = resultMap.get("urina_creatinina").value;
    if (typeof alb === "number" && typeof crea === "number" && crea > 0) {
      const acr = Math.round((alb * 100 / crea) * 10) / 10;
      results.push({ marker_id: "urina_acr", value: acr });
      console.log(`Calculated urina_acr: ${alb} mg/L ÷ ${crea} mg/dL × 100 = ${acr} mg/g`);
    }
  }

  // Relação PSA Livre/Total (%) — quando psa_ratio não existia
  if (!resultMap.has("psa_ratio") && resultMap.has("psa_livre") && resultMap.has("psa_total")) {
    const psaLivre = resultMap.get("psa_livre").value;
    const psaTotal = resultMap.get("psa_total").value;
    if (typeof psaLivre === "number" && typeof psaTotal === "number" && psaTotal > 0) {
      const ratio = Math.round((psaLivre / psaTotal) * 100 * 10) / 10;
      results.push({ marker_id: "psa_ratio", value: ratio });
      console.log(`Calculated psa_ratio: (${psaLivre} / ${psaTotal}) * 100 = ${ratio}%`);
    }
  }

  return results;
}

// ─── Reference Overrides ─────────────────────────────────────────────────────

/**
 * Aplica REFERENCE_OVERRIDES para marcadores sem referência do laudo.
 * Preserva referências do laudo quando presentes.
 */
export function applyReferenceOverrides(results: any[]): any[] {
  for (const r of results) {
    const override = REFERENCE_OVERRIDES[r.marker_id];
    if (override) {
      const hasLabRef = r.lab_ref_text && r.lab_ref_text.trim().length > 0;
      if (hasLabRef) {
        console.log(`[REF-OVERRIDE] ${r.marker_id}: KEEPING lab ref "${r.lab_ref_text}" (override skipped — lab provided a reference)`);
      } else {
        console.log(`[REF-OVERRIDE] ${r.marker_id}: ref ${r.lab_ref_min}-${r.lab_ref_max} "${r.lab_ref_text}" → ${override.min}-${override.max} "${override.text}"`);
        r.lab_ref_min = override.min;
        r.lab_ref_max = override.max;
        r.lab_ref_text = override.text;
      }
    }
  }
  return results;
}

// ─── DHEA-S Enrichment ───────────────────────────────────────────────────────

/**
 * Enriquece referência do DHEA-S com faixa por idade/sexo.
 * Deve rodar APÓS parseLabRefRanges para garantir que lab_ref_min/max existam.
 */
export function enrichDheaReference(
  results: any[],
  patientAge: number | null,
  patientSex: string | null,
): any[] {
  if (patientAge == null) return results;

  const ageRange = DHEA_RANGES_BY_AGE.find(r => patientAge! >= r.minAge && patientAge! <= r.maxAge);
  if (!ageRange) return results;

  for (const r of results) {
    if (r.marker_id === 'dhea_s') {
      const sex = (patientSex === 'F') ? 'F' : 'M';
      const [correctMin, correctMax] = ageRange[sex];
      if (r.lab_ref_min != null && r.lab_ref_min !== correctMin) {
        console.log(`DHEA-S: patient age ${patientAge}, sex ${sex}. Replacing ref ${r.lab_ref_min}-${r.lab_ref_max} with age-appropriate ${correctMin}-${correctMax}`);
        r.lab_ref_min = correctMin;
        r.lab_ref_max = correctMax;
        r.lab_ref_text = `${correctMin}-${correctMax}`;
      } else if (r.lab_ref_min == null) {
        console.log(`DHEA-S: no ref extracted. Setting age-appropriate ref ${correctMin}-${correctMax} for age ${patientAge}`);
        r.lab_ref_min = correctMin;
        r.lab_ref_max = correctMax;
        r.lab_ref_text = `${correctMin}-${correctMax}`;
      }
    }
  }

  return results;
}

// ─── VLDL Guard ──────────────────────────────────────────────────────────────

/**
 * Descarta referências invertidas para VLDL (">=" ou ">" não faz sentido — menor é melhor).
 */
export function guardVldlReference(results: any[]): any[] {
  for (const r of results) {
    if (r.marker_id === 'vldl' && r.lab_ref_text && /^[>≥]/i.test(String(r.lab_ref_text).trim())) {
      console.log(`[VLDL-guard] Discarding inverted VLDL ref: "${r.lab_ref_text}"`);
      delete r.lab_ref_text;
      delete r.lab_ref_min;
      delete r.lab_ref_max;
    }
  }
  return results;
}
