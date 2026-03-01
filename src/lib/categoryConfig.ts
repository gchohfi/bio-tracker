/**
 * categoryConfig.ts — fonte única de verdade para todas as categorias do LabTrack.
 *
 * REGRA: ao adicionar uma nova categoria, basta adicioná-la AQUI.
 * markers.ts, generateReport.ts e todos os componentes derivam as cores
 * automaticamente deste arquivo — nenhum outro arquivo precisa ser editado.
 *
 * Cada categoria possui:
 *   - hsl: string no formato "H S% L%" (usado pelo frontend via `hsl(...)`)
 *   - rgb: { r, g, b } derivado do HSL acima (usado pelo jsPDF no relatório PDF)
 *   - label: nome de exibição (igual à chave, mas centralizado para i18n futura)
 */

export interface CategoryConfig {
  hsl: string;
  rgb: { r: number; g: number; b: number };
  label: string;
}

/**
 * Converte uma string HSL "H S% L%" para RGB.
 * Usado internamente para derivar o rgb a partir do hsl, evitando duplicação.
 */
function hslToRgb(hslStr: string): { r: number; g: number; b: number } {
  const [h, s, l] = hslStr.split(" ").map((v) => parseFloat(v));
  const sl = s / 100;
  const ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  };
}

/**
 * Cria uma CategoryConfig a partir de uma string HSL.
 * O rgb é derivado automaticamente — não precisa ser especificado manualmente.
 */
function cat(hsl: string, label: string): CategoryConfig {
  return { hsl, rgb: hslToRgb(hsl), label };
}

/**
 * Mapa central de todas as categorias do LabTrack.
 *
 * Para adicionar uma nova categoria:
 *   1. Adicione uma linha aqui no formato:  NomeCategoria: cat("H S% L%", "Nome Exibição"),
 *   2. Adicione a categoria ao array CATEGORIES em markers.ts.
 *   Pronto — cores no frontend e no PDF são derivadas automaticamente.
 */
export const CATEGORY_CONFIG = {
  Hemograma:           cat("220 70% 55%", "Hemograma"),
  Ferro:               cat("30 80% 50%",  "Ferro"),
  Glicemia:            cat("280 60% 55%", "Glicemia"),
  "Lipídios":          cat("340 70% 55%", "Lipídios"),
  Tireoide:            cat("170 60% 40%", "Tireoide"),
  "Hormônios":         cat("300 50% 50%", "Hormônios"),
  "Eixo GH":           cat("260 55% 55%", "Eixo GH"),
  "Eixo Adrenal":      cat("25 65% 50%",  "Eixo Adrenal"),
  "Inflamação":        cat("5 70% 50%",   "Inflamação"),
  Vitaminas:           cat("45 90% 50%",  "Vitaminas"),
  Minerais:            cat("190 60% 45%", "Minerais"),
  "Hepático":          cat("140 50% 40%", "Hepático"),
  Renal:               cat("200 50% 50%", "Renal"),
  "Eletrólitos":       cat("10 70% 55%",  "Eletrólitos"),
  
  "Pancreático":       cat("50 70% 45%",  "Pancreático"),
  Imunologia:          cat("270 50% 55%", "Imunologia"),
  Sorologia:           cat("200 65% 45%", "Sorologia"),
  "Proteínas":         cat("180 50% 45%", "Proteínas"),
  "Marcadores Tumorais": cat("350 65% 50%", "Marcadores Tumorais"),
  Toxicologia:         cat("15 80% 45%",  "Toxicologia"),
  Urina:               cat("55 70% 50%",  "Urina"),
  Fezes:               cat("35 60% 45%",  "Fezes"),
} as const;

/** Tipo derivado automaticamente das chaves do CATEGORY_CONFIG. */
export type Category = keyof typeof CATEGORY_CONFIG;

/** Array ordenado de todas as categorias (mantém a ordem de exibição). */
export const CATEGORIES = Object.keys(CATEGORY_CONFIG) as Category[];

/**
 * Retorna a string HSL de uma categoria para uso no frontend.
 * Uso: style={{ backgroundColor: `hsl(${getCategoryHsl(cat)})` }}
 */
export function getCategoryHsl(cat: Category): string {
  return CATEGORY_CONFIG[cat]?.hsl ?? "220 10% 50%";
}

/**
 * Retorna o RGB de uma categoria para uso no jsPDF.
 * Uso: doc.setFillColor(rgb.r, rgb.g, rgb.b)
 */
export function getCategoryRgb(cat: Category): { r: number; g: number; b: number } {
  return CATEGORY_CONFIG[cat]?.rgb ?? { r: 100, g: 110, b: 120 };
}
