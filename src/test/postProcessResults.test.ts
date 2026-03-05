/**
 * Testes para a função postProcessResults da edge function extract-lab-results.
 * Cobre todos os 9 cálculos derivados automáticos:
 *   1. Bilirrubina Indireta = Total - Direta
 *   2. Colesterol Não-HDL = CT - HDL
 *   3. Relação CT/HDL
 *   4. Relação TG/HDL
 *   5. Relação ApoB/ApoA1
 *   6. HOMA-IR = (Glicose × Insulina) / 405
 *   7. Neutrófilos = Bastonetes + Segmentados
 *   8. Capacidade de Fixação Latente do Ferro = TIBC - Ferro Sérico
 *   9. Razão Albumina/Creatinina urinária (ACR)
 *
 * Como a edge function é Deno/TypeScript sem exports, replicamos a lógica aqui.
 * SYNC NOTE: manter sincronizado com supabase/functions/extract-lab-results/index.ts
 */
import { describe, it, expect } from "vitest";

// ─── Replicação da lógica postProcessResults ─────────────────────────────────
// Espelha exatamente o código em supabase/functions/extract-lab-results/index.ts
function postProcessResults(results: any[]): any[] {
  const resultMap = new Map<string, any>();
  for (const r of results) {
    if (r.marker_id) resultMap.set(r.marker_id, r);
  }

  // Fix psa_ratio extracted as fraction (e.g. 0.28 instead of 27.5%)
  if (resultMap.has("psa_ratio")) {
    const existing = resultMap.get("psa_ratio");
    if (typeof existing.value === "number" && existing.value < 1.0 && existing.value > 0) {
      if (resultMap.has("psa_livre") && resultMap.has("psa_total")) {
        const psaL = resultMap.get("psa_livre").value;
        const psaT = resultMap.get("psa_total").value;
        if (typeof psaL === "number" && typeof psaT === "number" && psaT > 0) {
          existing.value = Math.round((psaL / psaT) * 100 * 10) / 10;
        }
      } else {
        existing.value = Math.round(existing.value * 100 * 10) / 10;
      }
    }
  }

  // Calculate Bilirrubina Indireta = Total - Direta
  if (!resultMap.has("bilirrubina_indireta") && resultMap.has("bilirrubina_total") && resultMap.has("bilirrubina_direta")) {
    const bt = resultMap.get("bilirrubina_total").value;
    const bd = resultMap.get("bilirrubina_direta").value;
    if (typeof bt === "number" && typeof bd === "number") {
      const bi = Math.round((bt - bd) * 100) / 100;
      if (bi >= 0) {
        results.push({ marker_id: "bilirrubina_indireta", value: bi });
      }
    }
  }

  // Calculate Colesterol Não-HDL = CT - HDL
  if (!resultMap.has("colesterol_nao_hdl") && resultMap.has("colesterol_total") && resultMap.has("hdl")) {
    const ct = resultMap.get("colesterol_total").value;
    const hdl = resultMap.get("hdl").value;
    if (typeof ct === "number" && typeof hdl === "number") {
      const naoHdl = Math.round(ct - hdl);
      if (naoHdl >= 0) {
        results.push({ marker_id: "colesterol_nao_hdl", value: naoHdl });
      }
    }
  }

  // Calculate CT/HDL ratio
  if (!resultMap.has("relacao_ct_hdl") && resultMap.has("colesterol_total") && resultMap.has("hdl")) {
    const ct = resultMap.get("colesterol_total").value;
    const hdl = resultMap.get("hdl").value;
    if (typeof ct === "number" && typeof hdl === "number" && hdl > 0) {
      const ratio = Math.round((ct / hdl) * 100) / 100;
      results.push({ marker_id: "relacao_ct_hdl", value: ratio });
    }
  }

  // Calculate TG/HDL ratio
  if (!resultMap.has("relacao_tg_hdl") && resultMap.has("triglicerides") && resultMap.has("hdl")) {
    const tg = resultMap.get("triglicerides").value;
    const hdl = resultMap.get("hdl").value;
    if (typeof tg === "number" && typeof hdl === "number" && hdl > 0) {
      const ratio = Math.round((tg / hdl) * 100) / 100;
      results.push({ marker_id: "relacao_tg_hdl", value: ratio });
    }
  }

  // Calculate ApoB/ApoA1 ratio
  if (!resultMap.has("relacao_apob_apoa1") && resultMap.has("apo_b") && resultMap.has("apo_a1")) {
    const apoB = resultMap.get("apo_b").value;
    const apoA1 = resultMap.get("apo_a1").value;
    if (typeof apoB === "number" && typeof apoA1 === "number" && apoA1 > 0) {
      const ratio = Math.round((apoB / apoA1) * 100) / 100;
      results.push({ marker_id: "relacao_apob_apoa1", value: ratio });
    }
  }

  // Calculate HOMA-IR = (Glicose × Insulina) / 405
  if (!resultMap.has("homa_ir") && resultMap.has("glicose_jejum") && resultMap.has("insulina_jejum")) {
    const glicose = resultMap.get("glicose_jejum").value;
    const insulina = resultMap.get("insulina_jejum").value;
    if (typeof glicose === "number" && typeof insulina === "number") {
      const homa = Math.round((glicose * insulina / 405) * 100) / 100;
      results.push({ marker_id: "homa_ir", value: homa });
    }
  }

  // Calculate Neutrófilos = Bastonetes + Segmentados
  if (!resultMap.has("neutrofilos") && resultMap.has("bastonetes") && resultMap.has("segmentados")) {
    const bast = resultMap.get("bastonetes").value;
    const seg = resultMap.get("segmentados").value;
    if (typeof bast === "number" && typeof seg === "number") {
      const neutro = Math.round((bast + seg) * 100) / 100;
      results.push({ marker_id: "neutrofilos", value: neutro });
    }
  }

  // Calculate Capacidade de Fixação Latente do Ferro = TIBC - Ferro Sérico
  if (!resultMap.has("fixacao_latente_ferro") && resultMap.has("tibc") && resultMap.has("ferro_serico")) {
    const tibc = resultMap.get("tibc").value;
    const ferro = resultMap.get("ferro_serico").value;
    if (typeof tibc === "number" && typeof ferro === "number") {
      const latente = Math.round(tibc - ferro);
      if (latente >= 0) {
        results.push({ marker_id: "fixacao_latente_ferro", value: latente });
      }
    }
  }

  // Calculate Razão Albumina/Creatinina urinária (ACR)
  if (!resultMap.has("urina_acr") && resultMap.has("urina_albumina") && resultMap.has("urina_creatinina")) {
    const alb = resultMap.get("urina_albumina").value;
    const crea = resultMap.get("urina_creatinina").value;
    if (typeof alb === "number" && typeof crea === "number" && crea > 0) {
      const acr = Math.round((alb * 100 / crea) * 10) / 10;
      results.push({ marker_id: "urina_acr", value: acr });
    }
  }

  // Calculate Relação PSA Livre/Total (%)
  if (!resultMap.has("psa_ratio") && resultMap.has("psa_livre") && resultMap.has("psa_total")) {
    const psaLivre = resultMap.get("psa_livre").value;
    const psaTotal = resultMap.get("psa_total").value;
    if (typeof psaLivre === "number" && typeof psaTotal === "number" && psaTotal > 0) {
      const ratio = Math.round((psaLivre / psaTotal) * 100 * 10) / 10;
      results.push({ marker_id: "psa_ratio", value: ratio });
    }
  }

  return results;
}

// ─── Helper ──────────────────────────────────────────────────────────────────
function mkResult(marker_id: string, value: number) {
  return { marker_id, value };
}

function getCalculated(results: any[], marker_id: string): number | undefined {
  return results.find(r => r.marker_id === marker_id)?.value;
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe("postProcessResults — cálculos derivados automáticos", () => {

  // ── 1. Bilirrubina Indireta ───────────────────────────────────────────────
  describe("Bilirrubina Indireta = Total - Direta", () => {
    it("calcula corretamente: 1.2 - 0.3 = 0.9", () => {
      const results = [mkResult("bilirrubina_total", 1.2), mkResult("bilirrubina_direta", 0.3)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "bilirrubina_indireta")).toBe(0.9);
    });

    it("arredonda para 2 casas decimais: 1.0 - 0.33 = 0.67", () => {
      const results = [mkResult("bilirrubina_total", 1.0), mkResult("bilirrubina_direta", 0.33)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "bilirrubina_indireta")).toBe(0.67);
    });

    it("não calcula se resultado negativo (direta > total)", () => {
      const results = [mkResult("bilirrubina_total", 0.2), mkResult("bilirrubina_direta", 0.5)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "bilirrubina_indireta")).toBeUndefined();
    });

    it("não sobrescreve se bilirrubina_indireta já existe", () => {
      const results = [
        mkResult("bilirrubina_total", 1.2),
        mkResult("bilirrubina_direta", 0.3),
        mkResult("bilirrubina_indireta", 0.5), // já existe
      ];
      const out = postProcessResults(results);
      // Deve manter o valor original 0.5, não calcular 0.9
      const vals = out.filter(r => r.marker_id === "bilirrubina_indireta").map(r => r.value);
      expect(vals).toEqual([0.5]);
    });
  });

  // ── 2. Colesterol Não-HDL ─────────────────────────────────────────────────
  describe("Colesterol Não-HDL = CT - HDL", () => {
    it("calcula corretamente: 200 - 55 = 145", () => {
      const results = [mkResult("colesterol_total", 200), mkResult("hdl", 55)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "colesterol_nao_hdl")).toBe(145);
    });

    it("não calcula se resultado negativo", () => {
      const results = [mkResult("colesterol_total", 40), mkResult("hdl", 55)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "colesterol_nao_hdl")).toBeUndefined();
    });

    it("não sobrescreve se colesterol_nao_hdl já existe", () => {
      const results = [
        mkResult("colesterol_total", 200),
        mkResult("hdl", 55),
        mkResult("colesterol_nao_hdl", 130),
      ];
      const out = postProcessResults(results);
      const vals = out.filter(r => r.marker_id === "colesterol_nao_hdl").map(r => r.value);
      expect(vals).toEqual([130]);
    });
  });

  // ── 3. Relação CT/HDL ─────────────────────────────────────────────────────
  describe("Relação CT/HDL", () => {
    it("calcula corretamente: 200 / 50 = 4.0", () => {
      const results = [mkResult("colesterol_total", 200), mkResult("hdl", 50)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "relacao_ct_hdl")).toBe(4.0);
    });

    it("arredonda para 2 casas decimais: 195 / 52 = 3.75", () => {
      const results = [mkResult("colesterol_total", 195), mkResult("hdl", 52)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "relacao_ct_hdl")).toBe(3.75);
    });

    it("não calcula se HDL = 0 (divisão por zero)", () => {
      const results = [mkResult("colesterol_total", 200), mkResult("hdl", 0)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "relacao_ct_hdl")).toBeUndefined();
    });
  });

  // ── 4. Relação TG/HDL ─────────────────────────────────────────────────────
  describe("Relação TG/HDL", () => {
    it("calcula corretamente: 150 / 50 = 3.0", () => {
      const results = [mkResult("triglicerides", 150), mkResult("hdl", 50)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "relacao_tg_hdl")).toBe(3.0);
    });

    it("arredonda para 2 casas decimais: 130 / 60 = 2.17", () => {
      const results = [mkResult("triglicerides", 130), mkResult("hdl", 60)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "relacao_tg_hdl")).toBe(2.17);
    });

    it("não calcula se HDL = 0", () => {
      const results = [mkResult("triglicerides", 150), mkResult("hdl", 0)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "relacao_tg_hdl")).toBeUndefined();
    });
  });

  // ── 5. Relação ApoB/ApoA1 ─────────────────────────────────────────────────
  describe("Relação ApoB/ApoA1", () => {
    it("calcula corretamente: 100 / 140 = 0.71", () => {
      const results = [mkResult("apo_b", 100), mkResult("apo_a1", 140)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "relacao_apob_apoa1")).toBe(0.71);
    });

    it("não calcula se ApoA1 = 0", () => {
      const results = [mkResult("apo_b", 100), mkResult("apo_a1", 0)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "relacao_apob_apoa1")).toBeUndefined();
    });
  });

  // ── 6. HOMA-IR ────────────────────────────────────────────────────────────
  describe("HOMA-IR = (Glicose × Insulina) / 405", () => {
    it("calcula corretamente: (90 × 10) / 405 = 2.22", () => {
      const results = [mkResult("glicose_jejum", 90), mkResult("insulina_jejum", 10)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "homa_ir")).toBe(2.22);
    });

    it("calcula caso de resistência insulínica: (100 × 20) / 405 = 4.94", () => {
      const results = [mkResult("glicose_jejum", 100), mkResult("insulina_jejum", 20)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "homa_ir")).toBe(4.94);
    });

    it("calcula caso normal: (85 × 5) / 405 = 1.05", () => {
      const results = [mkResult("glicose_jejum", 85), mkResult("insulina_jejum", 5)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "homa_ir")).toBe(1.05);
    });

    it("não sobrescreve se homa_ir já existe", () => {
      const results = [
        mkResult("glicose_jejum", 90),
        mkResult("insulina_jejum", 10),
        mkResult("homa_ir", 1.5),
      ];
      const out = postProcessResults(results);
      const vals = out.filter(r => r.marker_id === "homa_ir").map(r => r.value);
      expect(vals).toEqual([1.5]);
    });
  });

  // ── 7. Neutrófilos ────────────────────────────────────────────────────────
  describe("Neutrófilos = Bastonetes + Segmentados", () => {
    it("calcula corretamente: 2 + 65 = 67", () => {
      const results = [mkResult("bastonetes", 2), mkResult("segmentados", 65)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "neutrofilos")).toBe(67);
    });

    it("calcula com bastonetes = 0: 0 + 70 = 70", () => {
      const results = [mkResult("bastonetes", 0), mkResult("segmentados", 70)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "neutrofilos")).toBe(70);
    });

    it("não sobrescreve se neutrofilos já existe", () => {
      const results = [
        mkResult("bastonetes", 2),
        mkResult("segmentados", 65),
        mkResult("neutrofilos", 60),
      ];
      const out = postProcessResults(results);
      const vals = out.filter(r => r.marker_id === "neutrofilos").map(r => r.value);
      expect(vals).toEqual([60]);
    });
  });

  // ── 8. Capacidade de Fixação Latente do Ferro ─────────────────────────────
  describe("Fixação Latente do Ferro = TIBC - Ferro Sérico", () => {
    it("calcula corretamente: 350 - 80 = 270", () => {
      const results = [mkResult("tibc", 350), mkResult("ferro_serico", 80)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "fixacao_latente_ferro")).toBe(270);
    });

    it("calcula caso de deficiência de ferro: 400 - 40 = 360", () => {
      const results = [mkResult("tibc", 400), mkResult("ferro_serico", 40)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "fixacao_latente_ferro")).toBe(360);
    });

    it("não calcula se resultado negativo (ferro > TIBC)", () => {
      const results = [mkResult("tibc", 200), mkResult("ferro_serico", 250)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "fixacao_latente_ferro")).toBeUndefined();
    });

    it("não sobrescreve se fixacao_latente_ferro já existe no laudo", () => {
      const results = [
        mkResult("tibc", 350),
        mkResult("ferro_serico", 80),
        mkResult("fixacao_latente_ferro", 280), // já extraído do laudo
      ];
      const out = postProcessResults(results);
      const vals = out.filter(r => r.marker_id === "fixacao_latente_ferro").map(r => r.value);
      expect(vals).toEqual([280]);
    });
  });

  // ── 9. Razão Albumina/Creatinina Urinária (ACR) ───────────────────────────
  describe("ACR = Albumina(mg/L) × 100 / Creatinina(mg/dL)", () => {
    it("calcula corretamente: 15 mg/L ÷ 100 mg/dL × 100 = 15.0 mg/g", () => {
      const results = [mkResult("urina_albumina", 15), mkResult("urina_creatinina", 100)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "urina_acr")).toBe(15.0);
    });

    it("calcula microalbuminúria: 30 mg/L ÷ 150 mg/dL × 100 = 20.0 mg/g", () => {
      const results = [mkResult("urina_albumina", 30), mkResult("urina_creatinina", 150)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "urina_acr")).toBe(20.0);
    });

    it("não calcula se creatinina = 0 (divisão por zero)", () => {
      const results = [mkResult("urina_albumina", 15), mkResult("urina_creatinina", 0)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "urina_acr")).toBeUndefined();
    });

    it("não sobrescreve se urina_acr já existe", () => {
      const results = [
        mkResult("urina_albumina", 15),
        mkResult("urina_creatinina", 100),
        mkResult("urina_acr", 12.5),
      ];
      const out = postProcessResults(results);
      const vals = out.filter(r => r.marker_id === "urina_acr").map(r => r.value);
      expect(vals).toEqual([12.5]);
    });
  });

  // ── Testes de integração: múltiplos cálculos simultâneos ──────────────────
  describe("Múltiplos cálculos simultâneos (perfil lipídico completo)", () => {
    it("calcula Não-HDL, CT/HDL e TG/HDL a partir de um perfil lipídico", () => {
      const results = [
        mkResult("colesterol_total", 200),
        mkResult("hdl", 50),
        mkResult("triglicerides", 150),
      ];
      const out = postProcessResults(results);
      expect(getCalculated(out, "colesterol_nao_hdl")).toBe(150);
      expect(getCalculated(out, "relacao_ct_hdl")).toBe(4.0);
      expect(getCalculated(out, "relacao_tg_hdl")).toBe(3.0);
    });

    it("calcula HOMA-IR e não interfere no perfil lipídico", () => {
      const results = [
        mkResult("colesterol_total", 180),
        mkResult("hdl", 60),
        mkResult("glicose_jejum", 95),
        mkResult("insulina_jejum", 8),
      ];
      const out = postProcessResults(results);
      expect(getCalculated(out, "colesterol_nao_hdl")).toBe(120);
      expect(getCalculated(out, "homa_ir")).toBe(1.88);
    });
  });

  // ── Testes de robustez: dados ausentes ────────────────────────────────────
  describe("Robustez — dados ausentes ou incompletos", () => {
    it("não calcula nada se resultados estão vazios", () => {
      const out = postProcessResults([]);
      expect(out).toEqual([]);
    });

    it("não calcula bilirrubina_indireta se falta bilirrubina_direta", () => {
      const results = [mkResult("bilirrubina_total", 1.2)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "bilirrubina_indireta")).toBeUndefined();
    });

    it("não calcula homa_ir se falta insulina_jejum", () => {
      const results = [mkResult("glicose_jejum", 90)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "homa_ir")).toBeUndefined();
    });

    it("não calcula fixacao_latente_ferro se falta ferro_serico", () => {
      const results = [mkResult("tibc", 350)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "fixacao_latente_ferro")).toBeUndefined();
    });
  });

  // ── 10. Relação PSA Livre/Total (───────────────────────────────────────────────────
  describe("Relação PSA Livre/Total = (psa_livre / psa_total) * 100", () => {
    it("calcula corretamente: (0.19 / 0.69) * 100 = 27.5% (caso Dener)", () => {
      const results = [mkResult("psa_livre", 0.19), mkResult("psa_total", 0.69)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "psa_ratio")).toBe(27.5);
    });

    it("calcula risco baixo: (0.5 / 1.0) * 100 = 50%", () => {
      const results = [mkResult("psa_livre", 0.5), mkResult("psa_total", 1.0)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "psa_ratio")).toBe(50.0);
    });

    it("calcula limiar de risco: (0.15 / 1.0) * 100 = 15%", () => {
      const results = [mkResult("psa_livre", 0.15), mkResult("psa_total", 1.0)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "psa_ratio")).toBe(15.0);
    });

    it("não calcula se psa_total = 0 (divisão por zero)", () => {
      const results = [mkResult("psa_livre", 0.1), mkResult("psa_total", 0)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "psa_ratio")).toBeUndefined();
    });

    it("não calcula se psa_livre está ausente", () => {
      const results = [mkResult("psa_total", 1.5)];
      const out = postProcessResults(results);
      expect(getCalculated(out, "psa_ratio")).toBeUndefined();
    });

    it("não sobrescreve se psa_ratio já existe no laudo", () => {
      const results = [
        mkResult("psa_livre", 0.19),
        mkResult("psa_total", 0.69),
        mkResult("psa_ratio", 30), // já extraído do laudo
      ];
      const out = postProcessResults(results);
      const vals = out.filter(r => r.marker_id === "psa_ratio").map(r => r.value);
      expect(vals).toEqual([30]);
    });
  });
});

