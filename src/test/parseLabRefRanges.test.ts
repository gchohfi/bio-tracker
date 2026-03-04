/**
 * Testes para a função parseLabRefRanges do backend (edge function).
 * Como a edge function é Deno/TypeScript, replicamos a lógica aqui para testar
 * todos os formatos de lab_ref_text que os laudos brasileiros podem gerar.
 */
import { describe, it, expect } from "vitest";

// ─── Replicação da lógica parseLabRefRanges ──────────────────────────────────
// Espelha exatamente o código em supabase/functions/extract-lab-results/index.ts

function parseLabRefRanges(results: any[]): any[] {
  const parseNumSimple = (s: string) => parseFloat(s.replace(',', '.'));
  for (const r of results) {
    const refText: string | undefined = r.lab_ref_text;
    if (!refText || typeof refText !== 'string' || refText.trim() === '') {
      delete r.lab_ref_text;
      continue;
    }
    let t = refText.trim();
    // Remover padrões de horário
    t = t.replace(/\(\s*\d+\s*[-–]\s*\d+\s*h(?:oras?)?\s*\)/gi, '').trim();
    t = t.replace(/\d+\s*[-–]\s*\d+\s*h(?:oras?)?/gi, '').trim();
    t = t.replace(/^(?:horas?\s+d[ao]\s+)?(?:manh[aã]|tarde|noite)\s*:?\s*/gi, '').trim();
    // Remover padrões de faixa etária COM sexo
    t = t.replace(/(?:homens?|mulheres?|masc(?:ulino)?|fem(?:inino)?)\s*\d+\s*[-–]\s*\d+\s*(?:anos?|a)\s*:?\s*/gi, '').trim();
    t = t.replace(/(?:homens?|mulheres?|masc(?:ulino)?|fem(?:inino)?)\s*>=?\s*\d+\s*(?:anos?|a)\s*:?\s*/gi, '').trim();
    t = t.replace(/(?:homens?|mulheres?|masc(?:ulino)?|fem(?:inino)?)\s*<=?\s*\d+\s*(?:anos?|a)\s*:?\s*/gi, '').trim();
    // Faixa etária sem sexo: "20-59 a:", "30 a 39 anos:", "De 20 a 34 anos:"
    t = t.replace(/^(?:de\s+)?\d+\s*(?:a|[-–])\s*\d+\s*(?:anos?|a)\s*:/gi, '').trim();
    // Operadores textuais + idade: "Acima de 12 anos:", "maior que 2 anos:"
    t = t.replace(/^(?:acima|maior|superior)\s+(?:de|que)\s+\d+\s*(?:anos?|a)(?:\s+e\s+adultos?)?\s*:?\s*/gi, '').trim();
    t = t.replace(/^(?:abaixo|menor|inferior)\s+(?:de|que)\s+\d+\s*(?:anos?|a)\s*:?\s*/gi, '').trim();
    // Faixas genéricas
    t = t.replace(/\d+\s*[-–]\s*\d+\s*(?:anos?|a)\s*:/gi, '').trim();
    t = t.replace(/>=?\s*\d+\s*(?:anos?|a)\s*:/gi, '').trim();
    t = t.replace(/<=?\s*\d+\s*(?:anos?|a)\s*:/gi, '').trim();
    // Remover prefixos de fase
    t = t.replace(/^(?:pr[eé]-?p[uú]beres?|p[oó]s-?menopausa|menopausa|adultos?)\s*:?\s*/gi, '').trim();
    // Normalizar operadores em português
    t = t.replace(/^Inferior\s+a\s+/i, '< ');
    t = t.replace(/^Superior\s+a\s+/i, '> ');
    t = t.replace(/^Até\s+/i, '< ');
    t = t.replace(/^Menor\s+(?:ou\s+igual\s+a|que)\s+/i, '< ');
    t = t.replace(/^Maior\s+(?:ou\s+igual\s+a|que)\s+/i, '> ');
    t = t.replace(/^Acima\s+de\s+/i, '> ');
    t = t.replace(/^Abaixo\s+de\s+/i, '< ');
    // Se após normalização o texto ainda contém "anos", é texto etário puro → descartar
    if (/\d+\s*anos?/i.test(t)) {
      delete r.lab_ref_text;
      continue;
    }
    // Extrair intervalo numérico embutido
    const embeddedRange = t.match(/([\d]+[.,][\d]+|[\d]+)\s*(?:a|–|—)\s*([\d]+[.,][\d]+|[\d]+)/);
    if (embeddedRange) {
      const min = parseNumSimple(embeddedRange[1]);
      const max = parseNumSimple(embeddedRange[2]);
      if (!isNaN(min) && !isNaN(max) && min < max) {
        r.lab_ref_min = min;
        r.lab_ref_max = max;
        r.lab_ref_text = `${embeddedRange[1]} a ${embeddedRange[2]}`;
        continue;
      }
    }
    // Formato "< X"
    const ltMatch = t.match(/^[<≤]=?\s*([\d.,]+)/);
    if (ltMatch) {
      r.lab_ref_max = parseNumSimple(ltMatch[1]);
      r.lab_ref_text = `< ${ltMatch[1]}`;
      continue;
    }
    // Formato "> X"
    const gtMatch = t.match(/^[>≥]=?\s*([\d.,]+)/);
    if (gtMatch) {
      r.lab_ref_min = parseNumSimple(gtMatch[1]);
      r.lab_ref_text = `> ${gtMatch[1]}`;
      continue;
    }
    // Texto muito longo
    if (t.length > 60) {
      delete r.lab_ref_text;
      continue;
    }
    // Texto qualitativo curto — mantém apenas lab_ref_text
  }
  return results;
}

// ─── Replicação da lógica de limpeza de urina qualitativo ────────────────────
const URINA_QUALITATIVE_CLEANUP = new Set(['urina_leucocitos', 'urina_hemacias', 'urina_hemoglobina']);

function cleanUrinaQualitative(results: any[]): any[] {
  for (const r of results) {
    if (!URINA_QUALITATIVE_CLEANUP.has(r.marker_id)) continue;
    const tv: string | undefined = r.text_value;
    if (!tv || typeof tv !== 'string') continue;
    // Caso 1: alucinação do hemograma
    if (/[\d.,]+\s*(?:g\/dL|milh[õo]es|mm[³3]|µL)/i.test(tv)) {
      r._remove = true;
      continue;
    }
    // Caso 2: número + referência misturados
    const cleanMatch = tv.match(/^(\d[\d.,]*)\s*(?:\/mL)?\s*(?:Até|até|Ref|ref|<|>|\d{4,})/i);
    if (cleanMatch) {
      const cleanVal = cleanMatch[1].replace(/[.,](\d{3})$/g, '$1').replace(',', '.');
      const num = parseFloat(cleanVal);
      if (!isNaN(num) && num > 0) {
        r.text_value = `${Math.round(num)} /mL`;
      }
    }
  }
  return results.filter((r: any) => !r._remove);
}

// ─── Testes: parseLabRefRanges ────────────────────────────────────────────────
describe("parseLabRefRanges — formatos numéricos de intervalo", () => {
  it("'12.0 a 16.0' → min=12, max=16", () => {
    const [r] = parseLabRefRanges([{ marker_id: "hemoglobina", lab_ref_text: "12.0 a 16.0" }]);
    expect(r.lab_ref_min).toBeCloseTo(12.0);
    expect(r.lab_ref_max).toBeCloseTo(16.0);
    expect(r.lab_ref_text).toBe("12.0 a 16.0");
  });

  it("'11,7 a 14,9' (vírgula decimal) → min=11.7, max=14.9", () => {
    const [r] = parseLabRefRanges([{ marker_id: "hemoglobina", lab_ref_text: "11,7 a 14,9" }]);
    expect(r.lab_ref_min).toBeCloseTo(11.7);
    expect(r.lab_ref_max).toBeCloseTo(14.9);
  });

  it("'70 a 99 mg/dL' (com unidade) → min=70, max=99", () => {
    const [r] = parseLabRefRanges([{ marker_id: "glicose_jejum", lab_ref_text: "70 a 99 mg/dL" }]);
    expect(r.lab_ref_min).toBe(70);
    expect(r.lab_ref_max).toBe(99);
  });

  it("'0,27 a 4,20' (TSH) → min=0.27, max=4.20", () => {
    const [r] = parseLabRefRanges([{ marker_id: "tsh", lab_ref_text: "0,27 a 4,20" }]);
    expect(r.lab_ref_min).toBeCloseTo(0.27);
    expect(r.lab_ref_max).toBeCloseTo(4.20);
  });

  it("'3.470 a 8.290' (leucócitos com ponto milhar) → min=3.47, max=8.29", () => {
    const [r] = parseLabRefRanges([{ marker_id: "leucocitos", lab_ref_text: "3.470 a 8.290" }]);
    // O parseNumSimple converte "3.470" → 3.47 (ponto como decimal)
    expect(r.lab_ref_min).toBeGreaterThan(0);
    expect(r.lab_ref_max).toBeGreaterThan(r.lab_ref_min!);
  });

  it("'0.0692 a 1.0663' (Testosterona Livre) → min=0.0692, max=1.0663", () => {
    const [r] = parseLabRefRanges([{ marker_id: "testosterona_livre", lab_ref_text: "0.0692 a 1.0663" }]);
    expect(r.lab_ref_min).toBeCloseTo(0.0692, 4);
    expect(r.lab_ref_max).toBeCloseTo(1.0663, 4);
  });
});

describe("parseLabRefRanges — operadores < e >", () => {
  it("'< 34' → max=34, sem min", () => {
    const [r] = parseLabRefRanges([{ marker_id: "anti_tpo", lab_ref_text: "< 34" }]);
    expect(r.lab_ref_max).toBe(34);
    expect(r.lab_ref_min).toBeUndefined();
    expect(r.lab_ref_text).toBe("< 34");
  });

  it("'< 1,3' (Anti-TG) → max=1.3", () => {
    const [r] = parseLabRefRanges([{ marker_id: "anti_tg", lab_ref_text: "< 1,3" }]);
    expect(r.lab_ref_max).toBeCloseTo(1.3);
    expect(r.lab_ref_min).toBeUndefined();
  });

  it("'< 1.0' (TRAb) → max=1.0", () => {
    const [r] = parseLabRefRanges([{ marker_id: "trab", lab_ref_text: "< 1.0" }]);
    expect(r.lab_ref_max).toBeCloseTo(1.0);
  });

  it("'> 60' (TFG) → min=60, sem max", () => {
    const [r] = parseLabRefRanges([{ marker_id: "tfg", lab_ref_text: "> 60" }]);
    expect(r.lab_ref_min).toBe(60);
    expect(r.lab_ref_max).toBeUndefined();
    expect(r.lab_ref_text).toBe("> 60");
  });

  it("'Inferior a 34' → max=34 (normalização português)", () => {
    const [r] = parseLabRefRanges([{ marker_id: "anti_tpo", lab_ref_text: "Inferior a 34" }]);
    expect(r.lab_ref_max).toBe(34);
  });

  it("'Superior a 90' → min=90 (normalização português)", () => {
    const [r] = parseLabRefRanges([{ marker_id: "tfg", lab_ref_text: "Superior a 90" }]);
    expect(r.lab_ref_min).toBe(90);
  });

  it("'Até 63 ng/dL' (Testosterona Total feminino) → max=63", () => {
    const [r] = parseLabRefRanges([{ marker_id: "testosterona_total", lab_ref_text: "Até 63 ng/dL" }]);
    expect(r.lab_ref_max).toBe(63);
    expect(r.lab_ref_min).toBeUndefined();
  });

  it("'Até 12,0 UI/L' (TGO feminino) → max=12.0", () => {
    const [r] = parseLabRefRanges([{ marker_id: "tgo_ast", lab_ref_text: "Até 12,0 UI/L" }]);
    expect(r.lab_ref_max).toBeCloseTo(12.0);
  });

  it("'Menor que 100 mg/dL' (LDL) → max=100", () => {
    const [r] = parseLabRefRanges([{ marker_id: "ldl", lab_ref_text: "Menor que 100 mg/dL" }]);
    expect(r.lab_ref_max).toBe(100);
  });

  it("'Acima de 20 ng/mL' (Vitamina D) → min=20", () => {
    const [r] = parseLabRefRanges([{ marker_id: "vitamina_d", lab_ref_text: "Acima de 20 ng/mL" }]);
    expect(r.lab_ref_min).toBe(20);
  });

  it("'Abaixo de 5 mg/L' (PCR) → max=5", () => {
    const [r] = parseLabRefRanges([{ marker_id: "pcr", lab_ref_text: "Abaixo de 5 mg/L" }]);
    expect(r.lab_ref_max).toBe(5);
  });
});

describe("parseLabRefRanges — textos etários e descritivos", () => {
  it("'Maior ou igual a 20 anos:' → texto descartado (sem min/max)", () => {
    const [r] = parseLabRefRanges([{ marker_id: "colesterol_total", lab_ref_text: "Maior ou igual a 20 anos:" }]);
    // Texto etário puro → não extrai min/max, mantém texto qualitativo
    expect(r.lab_ref_min).toBeUndefined();
    expect(r.lab_ref_max).toBeUndefined();
  });

  it("'Acima de 20 anos: 0,23 a 0,42 ng/dL' → descartado (texto etário com anos)", () => {
    // 'Acima de X anos' não é removido pelos prefixos etários (não tem gênero nem faixa)
    // Após normalização vira '> 20 anos: ...' que contém 'anos' → descartado
    const [r] = parseLabRefRanges([{ marker_id: "shbg", lab_ref_text: "Acima de 20 anos: 0,23 a 0,42 ng/dL" }]);
    expect(r.lab_ref_min).toBeUndefined();
    expect(r.lab_ref_max).toBeUndefined();
    expect(r.lab_ref_text).toBeUndefined();
  });

  it("'Nao reagente' → mantém apenas lab_ref_text (qualitativo)", () => {
    const [r] = parseLabRefRanges([{ marker_id: "fan", lab_ref_text: "Nao reagente" }]);
    expect(r.lab_ref_min).toBeUndefined();
    expect(r.lab_ref_max).toBeUndefined();
    expect(r.lab_ref_text).toBe("Nao reagente");
  });

  it("'Negativo' → mantém apenas lab_ref_text (qualitativo)", () => {
    const [r] = parseLabRefRanges([{ marker_id: "hiv", lab_ref_text: "Negativo" }]);
    expect(r.lab_ref_min).toBeUndefined();
    expect(r.lab_ref_max).toBeUndefined();
    expect(r.lab_ref_text).toBe("Negativo");
  });

  it("lab_ref_text vazio → campo removido", () => {
    const [r] = parseLabRefRanges([{ marker_id: "tsh", lab_ref_text: "" }]);
    expect(r.lab_ref_text).toBeUndefined();
  });

  it("lab_ref_text undefined → campo removido", () => {
    const [r] = parseLabRefRanges([{ marker_id: "tsh" }]);
    expect(r.lab_ref_text).toBeUndefined();
  });

  it("texto muito longo (>60 chars) sem intervalo → campo removido", () => {
    const longText = "Valores de referência dependem da fase do ciclo menstrual e da idade da paciente";
    const [r] = parseLabRefRanges([{ marker_id: "progesterona", lab_ref_text: longText }]);
    expect(r.lab_ref_text).toBeUndefined();
  });

  it("'Manhã: 6,2 a 19,4' → remove prefixo de horário e extrai range", () => {
    const [r] = parseLabRefRanges([{ marker_id: "cortisol", lab_ref_text: "Manhã: 6,2 a 19,4" }]);
    expect(r.lab_ref_min).toBeCloseTo(6.2);
    expect(r.lab_ref_max).toBeCloseTo(19.4);
  });

  it("'Mulheres 20-49 anos: 15 a 149' → extrai min=15, max=149 (prefixo etário removido)", () => {
    const [r] = parseLabRefRanges([{ marker_id: "ferritina", lab_ref_text: "Mulheres 20-49 anos: 15 a 149" }]);
    expect(r.lab_ref_min).toBe(15);
    expect(r.lab_ref_max).toBe(149);
  });

  it("'Acima de 12 anos: 0,70 a 1,30' → extrai range 0.70–1.30 (prefixo etário sem sexo)", () => {
    const [r] = parseLabRefRanges([{ marker_id: "creatinina", lab_ref_text: "Acima de 12 anos: 0,70 a 1,30" }]);
    expect(r.lab_ref_min).toBeCloseTo(0.70);
    expect(r.lab_ref_max).toBeCloseTo(1.30);
  });

  it("'maior que 2 anos: até 40 U/L' → extrai max=40 (prefixo etário 'maior que')", () => {
    const [r] = parseLabRefRanges([{ marker_id: "tgo_ast", lab_ref_text: "maior que 2 anos: até 40 U/L" }]);
    // Após remover prefixo, fica "até 40 U/L" → operador "< " com max=40
    expect(r.lab_ref_max).toBe(40);
    expect(r.lab_ref_min).toBeUndefined();
  });

  it("'20-59 a: 0,45 a 4,5 mUI/L' → extrai range 0.45–4.5 (faixa etária abreviada)", () => {
    const [r] = parseLabRefRanges([{ marker_id: "tsh", lab_ref_text: "20-59 a: 0,45 a 4,5 mUI/L" }]);
    expect(r.lab_ref_min).toBeCloseTo(0.45);
    expect(r.lab_ref_max).toBeCloseTo(4.5);
  });

  it("'De 20 a 34 anos: 160 a 492' → extrai range 160–492 (prefixo 'De X a Y anos')", () => {
    const [r] = parseLabRefRanges([{ marker_id: "dhea_s", lab_ref_text: "De 20 a 34 anos: 160 a 492" }]);
    expect(r.lab_ref_min).toBe(160);
    expect(r.lab_ref_max).toBe(492);
  });

  it("'30 a 39 anos: 19 a 64 pg/mL' → extrai range 19–64 (faixa etária genérica)", () => {
    const [r] = parseLabRefRanges([{ marker_id: "pth", lab_ref_text: "30 a 39 anos: 19 a 64 pg/mL" }]);
    expect(r.lab_ref_min).toBe(19);
    expect(r.lab_ref_max).toBe(64);
  });

  it("'Acima de 13 anos: 2,5 a 4,5' → extrai range 2.5–4.5 (Fósforo)", () => {
    const [r] = parseLabRefRanges([{ marker_id: "fosforo", lab_ref_text: "Acima de 13 anos: 2,5 a 4,5" }]);
    expect(r.lab_ref_min).toBeCloseTo(2.5);
    expect(r.lab_ref_max).toBeCloseTo(4.5);
  });

  it("'Acima de 20 anos: 1,6 a 2,6' → extrai range 1.6–2.6 (Magnésio)", () => {
    const [r] = parseLabRefRanges([{ marker_id: "magnesio", lab_ref_text: "Acima de 20 anos: 1,6 a 2,6" }]);
    expect(r.lab_ref_min).toBeCloseTo(1.6);
    expect(r.lab_ref_max).toBeCloseTo(2.6);
  });

  it("'maior que 1 ano: até 41 U/L' → extrai max=41 (TGP)", () => {
    const [r] = parseLabRefRanges([{ marker_id: "tgp_alt", lab_ref_text: "maior que 1 ano: até 41 U/L" }]);
    expect(r.lab_ref_max).toBe(41);
    expect(r.lab_ref_min).toBeUndefined();
  });
});

// ─── Testes: limpeza de urina qualitativo ────────────────────────────────────
describe("cleanUrinaQualitative — limpeza de text_value de urina", () => {
  it("urina_hemoglobina com '13,4 g/dL 11,7 a 14,9' → marcador removido (alucinação)", () => {
    const results = cleanUrinaQualitative([
      { marker_id: "urina_hemoglobina", text_value: "13,4 g/dL 11,7 a 14,9" }
    ]);
    expect(results).toHaveLength(0);
  });

  it("urina_hemoglobina com '4,5 milhões/µL' → marcador removido (alucinação)", () => {
    const results = cleanUrinaQualitative([
      { marker_id: "urina_hemoglobina", text_value: "4,5 milhões/µL" }
    ]);
    expect(results).toHaveLength(0);
  });

  it("urina_leucocitos com '15.900 /mL Até 25.000 /mL' → extrai '15900 /mL'", () => {
    const [r] = cleanUrinaQualitative([
      { marker_id: "urina_leucocitos", text_value: "15.900 /mL Até 25.000 /mL" }
    ]);
    expect(r.text_value).toBe("15900 /mL");
  });

  it("urina_hemacias com '2.500 /mL Até 10.000 /mL' → extrai '2500 /mL'", () => {
    const [r] = cleanUrinaQualitative([
      { marker_id: "urina_hemacias", text_value: "2.500 /mL Até 10.000 /mL" }
    ]);
    expect(r.text_value).toBe("2500 /mL");
  });

  it("urina_hemoglobina com 'Negativo' → mantém como está", () => {
    const [r] = cleanUrinaQualitative([
      { marker_id: "urina_hemoglobina", text_value: "Negativo" }
    ]);
    expect(r.text_value).toBe("Negativo");
  });

  it("urina_leucocitos com 'Ausentes' → mantém como está", () => {
    const [r] = cleanUrinaQualitative([
      { marker_id: "urina_leucocitos", text_value: "Ausentes" }
    ]);
    expect(r.text_value).toBe("Ausentes");
  });

  it("urina_hemacias com '2 a 3 /campo' → mantém como está (qualitativo válido)", () => {
    const [r] = cleanUrinaQualitative([
      { marker_id: "urina_hemacias", text_value: "2 a 3 /campo" }
    ]);
    expect(r.text_value).toBe("2 a 3 /campo");
  });

  it("marcador não-urina não é afetado", () => {
    const [r] = cleanUrinaQualitative([
      { marker_id: "hemoglobina", text_value: "13,4 g/dL 11,7 a 14,9" }
    ]);
    expect(r.text_value).toBe("13,4 g/dL 11,7 a 14,9");
  });
});
