

# Plano: Correções de bugs identificados na revisão de código

Excelente análise. Vou organizar as correções por prioridade.

---

## Bug 1 (Crítico): `parseBrNum` confunde decimais com milhares

**Arquivo:** `supabase/functions/extract-lab-results/index.ts` linha 1477

O regex `/^\d+\.\d{3}$/` interpreta "0.800" como 800 (milhar) em vez de 0.8 (decimal). Afeta creatinina, cálcio iônico, T3 livre, etc.

**Correção:** Exigir pelo menos 2 dígitos antes do ponto para considerar milhar. Alterar para `/^\d{2,}(\.\d{3})+$/` — isso garante que "1.000" → 1000, mas "0.800" → 0.8.

---

## Bug 2 (Crítico): Regex fallback sem validação

**Arquivo:** `supabase/functions/extract-lab-results/index.ts` linha 2371

`regexFallback()` roda DEPOIS de `validateAndFixValues()` e `postProcessResults()`. Marcadores do fallback entram sem sanity check.

**Correção:** Após `regexFallback()`, rodar novamente `validateAndFixValues()` apenas nos marcadores novos, e re-executar cálculos derivados relevantes (bilirrubina indireta, HOMA-IR).

---

## Bug 3 (Alto): Operadores ≤/≥ perdidos no strip do backend

**Arquivo:** `supabase/functions/extract-lab-results/index.ts` linha 832

O regex `/^[<>]=?\s*\d/` não inclui `≤`/`≥`. Resultado: `text_value="≤ 34"` é deletado.

**Correção:** Alterar para `/^[<>≤≥]=?\s*\d/`.

---

## Bug 4 (Alto): Frontend cego para ≤/≥

**Arquivos afetados:**
- `src/pages/PatientDetail.tsx` linhas 373, 812 — regex `/^[<>]=?\s*\d/`
- `src/components/EditReportDialog.tsx` linhas 83, 160 — regex `/^[<>]=?\s*\d/` e `/^[<>]/`
- `src/lib/markers.ts` linha 842 — `parseOperatorValue` regex `/^([<>]=?)\s*/`

**Correção:** Adicionar `≤≥` a todos os regexes de operador, e no `parseOperatorValue` normalizar `≤` → `<=` e `≥` → `>=`.

---

## Bug 5 (Médio): DHT sanity check não é sex-aware

**Arquivo:** `supabase/functions/extract-lab-results/index.ts` linha 704

`dihidrotestosterona: { min: 50, ... fix: v < 50 ? v * 10 }` — valores femininos válidos (10-40 pg/mL) são multiplicados por 10.

**Correção:** Remover o fix automático do DHT. Valores fora de range serão preservados como estão — melhor ter o valor real que um valor incorretamente multiplicado.

---

## Bug 6 (Baixo): Estradiol dead code

**Arquivo:** `supabase/functions/extract-lab-results/index.ts` linha 695

`estradiol: fix: v > 5000 ? v/10 : v < 5 ? v*100 : v < 50 ? v*10 : v` — o branch `v < 50 ? v*10` é dead code porque `v < 5` já retorna antes.

**Correção:** Ajustar para `v < 5 ? v * 100 : v < 50 ? v * 10 : v > 5000 ? v / 10 : v` — reordenar para que todos os branches sejam alcançáveis.

---

## Bug 7 (Info): PCR/VHS na categoria errada

**Arquivo:** `src/lib/markers.ts`

PCR e VHS estão em "Hemograma" mas são inflamatórios. Não afeta extração, mas melhora a organização na UI.

**Correção:** Mover `pcr` e `vhs` para a categoria "Inflamação" (que já existe no `categoryConfig.ts`).

---

## Resumo de arquivos a editar

| Arquivo | Alterações |
|---------|-----------|
| `supabase/functions/extract-lab-results/index.ts` | Bugs 1, 2, 3, 5, 6 |
| `src/pages/PatientDetail.tsx` | Bug 4 (2 regexes) |
| `src/components/EditReportDialog.tsx` | Bug 4 (2 regexes) |
| `src/lib/markers.ts` | Bugs 4 e 7 |

Após as edições, deploy da edge function `extract-lab-results`.

