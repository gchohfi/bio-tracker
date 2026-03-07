/**
 * markerAliases.ts
 *
 * Registro canônico de aliases de marker_id.
 * Fonte única de verdade: qualquer módulo que precise resolver
 * "dht" → "dihidrotestosterona" (ou vice-versa) deve usar este helper.
 *
 * NÃO duplicar mapeamentos em testes, pipeline, PDF ou timeline.
 */

// ---------------------------------------------------------------------------
// Alias map: alias → canonical marker_id
// ---------------------------------------------------------------------------

/**
 * Mapeamento de aliases para o marker_id canônico.
 * O canonical ID é o que aparece em MARKERS (src/lib/markers.ts)
 * e em MARKER_LIST (constants.ts).
 *
 * Adicionar novos aliases APENAS aqui.
 */
export const MARKER_ALIASES: Record<string, string> = {
  // DHT: pipeline de conversão usa "dht", mas o ID canônico é "dihidrotestosterona"
  dht: "dihidrotestosterona",
};

// Reverse map: canonical → list of aliases (computed once)
const REVERSE_ALIASES: Record<string, string[]> = {};
for (const [alias, canonical] of Object.entries(MARKER_ALIASES)) {
  if (!REVERSE_ALIASES[canonical]) REVERSE_ALIASES[canonical] = [];
  REVERSE_ALIASES[canonical].push(alias);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve um marker_id para o ID canônico.
 * Se o ID já é canônico ou não tem alias, retorna o próprio ID.
 *
 * Uso: resolveMarkerId("dht") → "dihidrotestosterona"
 *      resolveMarkerId("pcr") → "pcr"
 */
export function resolveMarkerId(markerId: string): string {
  return MARKER_ALIASES[markerId] ?? markerId;
}

/**
 * Retorna todos os IDs que mapeiam para um canonical ID.
 * Inclui o próprio canonical ID.
 *
 * Uso: getMarkerIdVariants("dihidrotestosterona") → ["dihidrotestosterona", "dht"]
 */
export function getMarkerIdVariants(canonicalId: string): string[] {
  const aliases = REVERSE_ALIASES[canonicalId] ?? [];
  return [canonicalId, ...aliases];
}

/**
 * Verifica se dois marker_ids referem-se ao mesmo marcador,
 * considerando aliases.
 */
export function isSameMarker(idA: string, idB: string): boolean {
  return resolveMarkerId(idA) === resolveMarkerId(idB);
}
