

# Integrar parseLabReference + resolveReference em markers.ts

## Resumo

Criar o arquivo `parseLabReference.ts` (com os 3 fixes) e adicionar a funcao `resolveReference` ao `markers.ts` como helper complementar -- sem quebrar a API existente de `getMarkerStatus`.

---

## Problema com a abordagem original

A proposta de substituir `getMarkerStatus` por `resolveReference` quebraria 6 arquivos porque:
- `getMarkerStatus` recebe `(value, marker, sex, operator?)` -- nao recebe `LabResult`
- A maioria dos callers nao tem acesso a `lab_ref_range` ou `unit` do resultado
- `MarkerDef` usa `refRange: { M: [min, max] }`, nao `functionalMin`/`functionalMax`

**Solucao**: manter `getMarkerStatus` intacto e adicionar `resolveReference` como funcao auxiliar para contextos que possuem dados de referencia laboratorial.

---

## Alteracoes

### 1. Criar `src/lib/parseLabReference.ts`

Criar o arquivo com o codigo fornecido pelo usuario, aplicando os 3 fixes identificados:

- **toFloat**: distinguir ponto-milhar (seguido de 3 digitos) de ponto-decimal
- **OPERATOR_MAP**: separar `<` de `<=` e `>` de `>=` (4 entradas distintas em vez de 2 com `=?`)
- **Limpeza do reduce morto**: substituir o `.reduce` nao-funcional por iteracao direta sobre os prefixos de sexo
- **Teste corrigido**: `"Inferior ou igual a 15"` deve esperar `<=` (nao `<`)

### 2. Atualizar `src/lib/markers.ts`

**a) Adicionar import:**
```typescript
import { parseLabReference, type ParsedReference } from './parseLabReference';
```

**b) Adicionar `resolveReference` como funcao exportada:**
```typescript
export function resolveReference(
  marker: MarkerDef,
  sex: 'M' | 'F',
  labRefText?: string,
  labUnit?: string,
): { min: number | null; max: number | null; operator: string; source: 'functional' | 'lab' }
```

Logica:
- Extrair `[funcMin, funcMax]` de `marker.refRange[sex]`
- Se `labRefText` existir, chamar `parseLabReference(labRefText, sex)`
- Comparar `marker.unit` com `labUnit`: se diferirem, usar referencia do laboratorio como fallback
- Caso contrario, retornar a referencia funcional

**c) Manter `getMarkerStatus` inalterado** -- continua funcionando como hoje para todos os callers existentes.

**d) Adicionar `getMarkerStatusFromRef` como funcao complementar:**
```typescript
export function getMarkerStatusFromRef(
  value: number,
  ref: { min: number | null; max: number | null; operator: string }
): 'normal' | 'low' | 'high'
```

Essa funcao aplica a logica de status baseada no operador (`range`, `<`, `<=`, `>`, `>=`), como proposto pelo usuario.

### 3. Nenhuma alteracao nos callers existentes

Os 6 arquivos que chamam `getMarkerStatus` continuam funcionando sem mudanca. A integracao de `resolveReference` nos componentes (EvolutionTable, PatientDetail) sera feita em um passo futuro, quando os dados de `lab_ref_range` estiverem disponiveis no contexto.

---

## Resumo dos arquivos

| Arquivo | Acao |
|---|---|
| `src/lib/parseLabReference.ts` | Criar (com 3 fixes) |
| `src/lib/markers.ts` | Adicionar import, `resolveReference`, `getMarkerStatusFromRef` |
| Demais arquivos | Nenhuma alteracao |

