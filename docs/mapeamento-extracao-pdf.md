# Mapeamento: Extração de Texto de PDF de Exames Laboratoriais

**Repositório:** [gchohfi/bio-tracker](https://github.com/gchohfi/bio-tracker)  
**SHA de referência:** `65744ba` (branch principal)  
**Data:** 2026-03-04

---

## Sumário

1. [Visão Geral do Fluxo End-to-End](#1-visão-geral-do-fluxo-end-to-end)
2. [Etapa 1 — Upload e Extração de Texto (Frontend)](#2-etapa-1--upload-e-extração-de-texto-frontend)
3. [Etapa 2 — Envio para o Backend (Edge Function)](#3-etapa-2--envio-para-o-backend-edge-function)
4. [Etapa 3 — Parsing pela IA e Pós-processamento (Backend)](#4-etapa-3--parsing-pela-ia-e-pós-processamento-backend)
5. [Etapa 4 — Parsing de Referências Laboratoriais](#5-etapa-4--parsing-de-referências-laboratoriais)
6. [Etapa 5 — Validação e Armazenamento no Banco](#6-etapa-5--validação-e-armazenamento-no-banco)
7. [Etapa 6 — UI de Revisão](#7-etapa-6--ui-de-revisão)
8. [Bibliotecas Utilizadas](#8-bibliotecas-utilizadas)
9. [Esquema do Banco de Dados](#9-esquema-do-banco-de-dados)
10. [Pontos de Extensão para Double-Check e Validadores](#10-pontos-de-extensão-para-double-check-e-validadores)

---

## 1. Visão Geral do Fluxo End-to-End

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite + TypeScript)                                       │
│                                                                             │
│  1. Usuário seleciona PDF(s) via <input type="file">                        │
│     └─ PatientDetail.tsx · handlePdfImport()                                │
│                                                                             │
│  2. extractPdfText(file)   ← pdfjs-dist v4.10.38                            │
│     ├─ Lê PDF page-by-page com getTextContent()                             │
│     ├─ Reconstrói linhas por coordenada Y (layout preservation)             │
│     └─ Filtra linhas irrelevantes → {fullText, cleanedText}                │
│                                                                             │
│  3. processPdfFile()                                                        │
│     ├─ Appends CUSTOM ALIASES hint ao texto limpo                          │
│     └─ supabase.functions.invoke("extract-lab-results", {                  │
│            body: { pdfText: cleanedText + aliasHint,                       │
│                    patientSex: patient.sex }                               │
│         })                                                                  │
│                                                                             │
└─────────────────────┬───────────────────────────────────────────────────────┘
                      │  HTTP POST (HTTPS) via @supabase/supabase-js
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKEND (Deno · Supabase Edge Function)                                    │
│  supabase/functions/extract-lab-results/index.ts                            │
│                                                                             │
│  4. serve() handler                                                         │
│     ├─ Recebe { pdfText, patientSex }                                       │
│     ├─ Trunca pdfText a 200 000 chars                                       │
│     └─ Envia ao AI gateway Lovable → Gemini 2.5 Flash                      │
│        (tool_call "extract_results")                                        │
│                                                                             │
│  5. Pós-processamento da resposta da IA                                     │
│     ├─ normalizeOperatorText()   — "inferior a 34" → "< 34"                │
│     ├─ deduplicateResults()      — prefere valor calculado sobre operador   │
│     ├─ validateAndFixValues()    — sanity check + auto-fix decimais         │
│     ├─ postProcessResults()      — calcula derivados (HOMA-IR, CT/HDL…)    │
│     ├─ regexFallback()           — regex para marcadores que a IA perde    │
│     ├─ parseLabRefRanges()       — lab_ref_text → lab_ref_min/lab_ref_max  │
│     └─ convertLabRefUnits()      — normaliza unidades das referências       │
│                                                                             │
│  6. Retorna JSON: { results: [...], exam_date: "YYYY-MM-DD" }              │
│                                                                             │
└─────────────────────┬───────────────────────────────────────────────────────┘
                      │  JSON response
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND — continuação processPdfFile()                                    │
│                                                                             │
│  7. Mescla resultados com valores existentes (newValues, newLabRefs)        │
│  8. Extrai exam_date via regex fallback se não veio da função               │
│  9. Abre EditExtractionDialog → usuário revisa/edita marcadores             │
│  10. Confirma → abre ImportVerification → double-check visual c/ PDF text  │
│  11. Salva → handleSaveSession()                                            │
│      ├─ Cria/reutiliza lab_session                                          │
│      └─ INSERT lab_results (com lab_ref_text/min/max)                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Etapa 1 — Upload e Extração de Texto (Frontend)

### Arquivo principal

**[`src/pages/PatientDetail.tsx`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/pages/PatientDetail.tsx)**

### Onde ocorre o upload

| Elemento | Linha(s) | Descrição |
|---|---|---|
| `<input type="file">` (ref `pdfInputRef`) | ~L1003–1015 | Input oculto, aceita múltiplos arquivos via `multiple` |
| `handlePdfImport(e)` | ~L893–L935 | Handler `onChange` do input; itera sobre `e.target.files` |

### Função de extração de texto

```
extractPdfText(file: File)
  → Promise<{ fullText: string; cleanedText: string }>
```

**Permalink:** [`src/pages/PatientDetail.tsx` L72–L240](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/pages/PatientDetail.tsx#L72)

#### O que faz:

1. **Inicialização do worker pdfjs** (L73):
   ```ts
   pdfjsLib.GlobalWorkerOptions.workerSrc =
     new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
   ```
2. **Leitura do ArrayBuffer** via `file.arrayBuffer()`.
3. **Carregamento do documento PDF** via `pdfjsLib.getDocument({ data: arrayBuffer }).promise`.
4. **Iteração por página**: `page.getTextContent()` retorna `TextItem[]` com coordenadas `transform[4]` (x) e `transform[5]` (y).
5. **Reconstrução de linhas** por agrupamento em coordenada Y (tolerância ±3px), ordenadas da mais alta para a mais baixa (top-to-bottom), items dentro de cada linha ordenados por x (left-to-right).
6. **Filtro de linhas irrelevantes** (`cleanedLines`): remoção de headers pessoais (Cliente, Médico, CRM), rodapés, disclaimers, notas metodológicas, linhas puramente de formatação (separadores `---`, `===`), etc. — ~80 filtros de pattern regex.
7. **Retorno**: `fullText` (texto bruto com marcadores de página) e `cleanedText` (linhas limpas reunidas em string única).

### Biblioteca usada

- **`pdfjs-dist`** v4.10.38 — parser e renderer de PDF em JavaScript, desenvolvido pela Mozilla. Executa 100% no browser/worker sem enviar o arquivo ao servidor.
  - Declarada em [`package.json#L54`](https://github.com/gchohfi/bio-tracker/blob/65744ba/package.json#L54): `"pdfjs-dist": "^4.10.38"`
  - Importada em [`PatientDetail.tsx#L2`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/pages/PatientDetail.tsx#L2): `import * as pdfjsLib from "pdfjs-dist";`

> **Nota:** O arquivo PDF nunca é enviado ao servidor. Apenas o texto extraído (`cleanedText`, máx. 200 000 chars após truncamento na edge function) trafega pela rede.

---

## 3. Etapa 2 — Envio para o Backend (Edge Function)

### Função de orquestração

**`processPdfFile(file, existingValues, existingLabRefs)`**  
[`src/pages/PatientDetail.tsx` ~L790–L880](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/pages/PatientDetail.tsx#L790)

#### Fluxo interno:

1. Chama `extractPdfText(file)` → `{ fullText, cleanedText }`.
2. Carrega aliases customizados via `loadCustomAliases()` (de `AliasConfigDialog`) e formata um hint de texto que é **concatenado** ao `cleanedText`.
3. Chama a Edge Function via SDK do Supabase:
   ```ts
   const { data, error } = await supabase.functions.invoke("extract-lab-results", {
     body: {
       pdfText: cleanedText + aliasHint,   // texto extraído + aliases
       patientSex: patient?.sex,           // "M" ou "F"
     },
   });
   ```
4. Recebe `data.results` (array de marcadores) e `data.exam_date` (string `YYYY-MM-DD` opcional).
5. Mescla com valores pré-existentes em `markerValues` e `labRefRanges`.
6. Extrai `exam_date` via regex fallback sobre o `fullText` se a edge function não retornou.

### Configuração do cliente Supabase

**[`src/integrations/supabase/client.ts`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/integrations/supabase/client.ts)**  
```ts
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { storage: localStorage, persistSession: true, autoRefreshToken: true } }
);
```
O token JWT do usuário autenticado é incluído automaticamente no header `Authorization` de cada `functions.invoke()`.

---

## 4. Etapa 3 — Parsing pela IA e Pós-processamento (Backend)

### Arquivo da Edge Function

**[`supabase/functions/extract-lab-results/index.ts`](https://github.com/gchohfi/bio-tracker/blob/65744ba/supabase/functions/extract-lab-results/index.ts)**  
Runtime: **Deno** (sem `node_modules`; imports via URL)

### Dependências da edge function

| Import | Origem | Uso |
|---|---|---|
| `serve` | `https://deno.land/std@0.168.0/http/server.ts` | HTTP server loop |
| AI gateway | `https://ai.gateway.lovable.dev/v1/chat/completions` | Proxy OpenAI-compatible para Gemini |

### Constantes e configuração

| Símbolo | Linha(s) | Descrição |
|---|---|---|
| `MARKER_LIST` | ~L10–L222 | Array com 150+ marcadores: `{ id, name, unit }` |
| `QUALITATIVE_IDS` | ~L223 | Set de IDs de marcadores qualitativos (FAN, urina_*, copro_*) |
| `systemPrompt` | ~L225–L646 | Prompt de sistema com regras de extração, normalização, desambiguação |

### Handler principal

**`serve(async (req) => { ... })`** — [`index.ts#L2321`](https://github.com/gchohfi/bio-tracker/blob/65744ba/supabase/functions/extract-lab-results/index.ts#L2321)

1. Extrai `{ pdfText, patientSex }` do body JSON.
2. Trunca `pdfText` a 200 000 chars.
3. Chama `POST https://ai.gateway.lovable.dev/v1/chat/completions` com:
   - **Modelo:** `google/gemini-2.5-flash` (temperatura 0)
   - **Auth:** `LOVABLE_API_KEY` (variável de ambiente da edge function)
   - **Tool call:** `extract_results` com schema JSON definindo `exam_date`, `results[].{marker_id, value, text_value, lab_ref_text}`
4. Parse a resposta → `parsed.results`.
5. Filtra IDs inválidos e marcadores qualitativos sem `text_value`.

### Pipeline de pós-processamento

Executado em ordem estrita sobre `validResults`:

| Função | Linha(s) | Descrição |
|---|---|---|
| `normalizeOperatorText()` | ~L650–L677 | Converte "inferior a 34 U/mL" → `< 34` em `text_value` |
| `deduplicateResults()` | ~L678–L718 | Remove duplicatas: prefere valor calculado sobre operador; resolve par urina_leucocitos/urina_leucocitos_quant |
| `validateAndFixValues()` | ~L719–L1042 | Sanity ranges para 80+ marcadores; auto-fix: decimais brasileiros, erros de unidade, leucograma abs→%, etc. |
| `postProcessResults()` | ~L1315–L1430 | Calcula derivados ausentes: Bilirrubina Indireta, Colesterol Não-HDL, CT/HDL, TG/HDL, ApoB/ApoA1, HOMA-IR, Neutrófilos, CLFI, ACR |
| `regexFallback()` | ~L1582–L2276 | Regex diretamente sobre `pdfText` para marcadores que a IA frequentemente perde (Fibrinogênio, VPM, bastonetes, Amilase, etc.); só adiciona marcadores **ausentes** na resposta da IA |
| `parseLabRefRanges()` | ~L1474–L1581 | Parseia `lab_ref_text` (string) → `lab_ref_min` / `lab_ref_max` (números); **cópia inline de `parseLabReference.ts`** |
| `convertLabRefUnits()` | ~L1043–L1314 | Normaliza unidades da referência (Testosterona Livre pmol/L→ng/dL, IGFBP-3 ng/mL→µg/mL, Zinco µg/mL→µg/dL, T3 Livre pg/mL→ng/dL); descarta refs absurdas via sanity bounds específicos por marcador e via razão de 20x |

---

## 5. Etapa 4 — Parsing de Referências Laboratoriais

### Frontend: `parseLabReference()`

**[`src/lib/parseLabReference.ts`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/lib/parseLabReference.ts)**

```ts
export function parseLabReference(
  text: string,
  sex?: 'M' | 'F'
): ParsedReference
```

| Campo retornado | Tipo | Descrição |
|---|---|---|
| `min` | `number \| null` | Limite inferior do range |
| `max` | `number \| null` | Limite superior do range |
| `operator` | `'range' \| '<' \| '<=' \| '>' \| '>=' \| 'qualitative' \| 'unknown'` | Tipo de referência detectado |
| `displayText` | `string` | Texto normalizado para exibição |

**Lógica de parsing** (em ordem de prioridade):
1. Separação por sexo (`Homens: X / Mulheres: Y`) — seleciona segmento pelo parâmetro `sex`.
2. Detecção de qualitativo (`não reagente`, `negativo`, `positivo`, `ausente`, etc.).
3. Detecção de operador (`< X`, `<= X`, `> X`, `>= X`, `inferior a X`, `maior que X`, etc.).
4. Remoção de padrões descritivos que confundem o parser de range: horários, faixas etárias com e sem sexo, fases de vida.
5. Detecção de range `X a Y`, `X - Y`, `X–Y`.
6. Número isolado → tratado como máximo (`<= X`).

**Nota de sincronização:** O comentário no topo do arquivo ([`parseLabReference.ts#L8-L11`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/lib/parseLabReference.ts#L8)) alerta que existe uma **cópia inline** na edge function (`parseLabRefRanges()` em `extract-lab-results/index.ts#L1474`) que deve ser mantida sincronizada manualmente.

### Uso de `parseLabReference` no frontend

| Arquivo | Função consumidora | Propósito |
|---|---|---|
| [`src/lib/markers.ts#L718`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/lib/markers.ts#L718) | `resolveReference()` | Parseia `lab_ref_text` do banco para calcular status do marcador |
| [`src/lib/markers.ts#L675`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/lib/markers.ts#L675) | `getMarkerStatus()` | Status via `resolveReference()` sem `lab_ref_text` |
| Re-exportado como | `export { parseLabReference }` | Disponível para todos os consumers via `@/lib/markers` |

### `resolveReference()` — Hierarquia de referência

**[`src/lib/markers.ts#L724`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/lib/markers.ts#L724)**

```
resolveReference(marker, sex, labRefText?)
  1. labRefText presente → parseLabReference() → validação sanity (ratio 5x vs labRange)
     └─ se sano → retorna referência do laudo  [source: 'lab']
     └─ se insano → log + fallback para labRange
  2. labRange do marcador (referência laboratorial convencional SBPC/ML)  [source: 'lab']
```

A validação de sanity (L787–L832) rejeita referências extraídas que divergem mais de 5× do `labRange` esperado para o marcador.

---

## 6. Etapa 5 — Validação e Armazenamento no Banco

### Função de salvamento

**`handleSaveSession()`**  
[`src/pages/PatientDetail.tsx` ~L384–L455](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/pages/PatientDetail.tsx#L384)

#### Fluxo:

1. **Cria ou reutiliza** `lab_sessions` (verifica sessão existente pela data para evitar duplicatas).
2. Para cada marcador em `markerValues`:
   - Se qualitativo → `{ value: 0, text_value: v, ...labRefFields }`
   - Se operador (`< X` ou `> X`) → `{ value: numericPart, text_value: v, ...labRefFields }`
   - Se numérico → `{ value: Number(v), ...labRefFields }`
3. **`INSERT lab_results`** em bulk com todos os campos de referência:
   ```ts
   await supabase.from("lab_results").insert(allResults);
   // allResults[i] = {
   //   session_id, marker_id, value,
   //   text_value?,       // operadores e qualitativos
   //   lab_ref_text?,     // texto original da referência do laudo
   //   lab_ref_min?,      // limite inferior numérico
   //   lab_ref_max?,      // limite superior numérico
   // }
   ```

### Segurança (RLS)

As policies de Row Level Security garantem que apenas o `practitioner_id` autenticado consegue inserir/ler resultados dos seus próprios pacientes. Definidas em [`supabase/migrations/20260223170235_...sql`](https://github.com/gchohfi/bio-tracker/blob/65744ba/supabase/migrations/20260223170235_550cdfe5-4b35-4094-9c82-b4a702b44871.sql).

---

## 7. Etapa 6 — UI de Revisão

### EditExtractionDialog

**[`src/components/EditExtractionDialog.tsx`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/components/EditExtractionDialog.tsx)**

- Exibido imediatamente após `processPdfFile()` bem-sucedido.
- Lista todos os marcadores extraídos (com valor não-vazio).
- Permite editar valores individualmente (inline) e remover marcadores espúrios.
- Ao confirmar → `onConfirm(updatedValues)` → atualiza `markerValues` no estado e abre `ImportVerification`.

**Invocado em** [`PatientDetail.tsx#L1148`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/pages/PatientDetail.tsx#L1148):
```tsx
<EditExtractionDialog
  open={editExtractionOpen}
  markerValues={markerValues}
  onConfirm={(updated) => {
    setMarkerValues(updated);
    setVerificationOpen(true);   // ← abre ImportVerification
  }}
/>
```

### ImportVerification

**[`src/components/ImportVerification.tsx`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/components/ImportVerification.tsx)**

- Exibido após `EditExtractionDialog.onConfirm`.
- Props: `importedMarkers` (valores confirmados), `pdfText` (cleanedText), `rawPdfText` (fullText).
- Exibe por categoria todos os marcadores com status visual: ✅ importado, ⚠️ não encontrado no PDF, ❌ ausente.
- Usa busca textual no `pdfText` + `MARKER_ALIASES` para verificar se o marcador aparece no texto original.
- Permite marcar marcadores como "não realizados" (não é erro, exame não foi feito).

**Invocado em** [`PatientDetail.tsx#L1159`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/pages/PatientDetail.tsx#L1159):
```tsx
<ImportVerification
  open={verificationOpen}
  importedMarkers={markerValues}
  pdfText={lastPdfText}
  rawPdfText={lastRawPdfText}
/>
```

### EvolutionTable — exibição das referências

**[`src/components/EvolutionTable.tsx#L87`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/components/EvolutionTable.tsx#L87)**

- Constrói dois mapas em `useMemo`: `labRefMap[markerId]` (última referência por marcador) e `labRefBySession[markerId][sessionId]` (referência por sessão).
- Usa `resolveReference(marker, sex, labRefText)` para determinar status (`normal`/`low`/`high`) por sessão, passando o `lab_ref_text` específico daquela sessão quando disponível.
- Exibe `lab_ref_text` na coluna de referência da tabela (L387).

---

## 8. Bibliotecas Utilizadas

### Frontend

| Biblioteca | Versão | Arquivo | Uso |
|---|---|---|---|
| **`pdfjs-dist`** | `^4.10.38` | [`package.json#L54`](https://github.com/gchohfi/bio-tracker/blob/65744ba/package.json#L54) | Extração de texto do PDF no browser |
| **`@supabase/supabase-js`** | `^2.97.0` | [`package.json#L44`](https://github.com/gchohfi/bio-tracker/blob/65744ba/package.json#L44) | Cliente para `functions.invoke()` e CRUD no banco |
| **`react`** | `^18.3.1` | [`package.json#L56`](https://github.com/gchohfi/bio-tracker/blob/65744ba/package.json#L56) | UI framework |
| **`date-fns`** | `^3.6.0` | [`package.json#L48`](https://github.com/gchohfi/bio-tracker/blob/65744ba/package.json#L48) | Parsing/formatação de datas |

### Backend (Edge Function — Deno)

| Recurso | Origem | Uso |
|---|---|---|
| `serve` | `https://deno.land/std@0.168.0/http/server.ts` | HTTP server loop |
| AI Gateway | `https://ai.gateway.lovable.dev/v1/chat/completions` | Proxy OpenAI-compat para Gemini 2.5 Flash |

> **Modelo de IA:** `google/gemini-2.5-flash` com `temperature: 0` e `tool_choice: { type: "function" }` (garante resposta estruturada JSON).

---

## 9. Esquema do Banco de Dados

### Tabela `lab_results`

Campos relevantes para o fluxo de extração:

| Coluna | Tipo | Adicionado em | Descrição |
|---|---|---|---|
| `id` | `UUID PK` | migração inicial | Identificador único |
| `session_id` | `UUID FK → lab_sessions` | migração inicial | Sessão de exame |
| `marker_id` | `TEXT` | migração inicial | ID do marcador (ex: `hemoglobina`) |
| `value` | `NUMERIC` | migração inicial | Valor numérico (parte numérica para operadores) |
| `text_value` | `TEXT` | migração posterior | Resultado qualitativo ou valor com operador (`< 34`) |
| `lab_ref_text` | `TEXT` | [`20260225150000_add_birth_date_and_lab_ref.sql`](https://github.com/gchohfi/bio-tracker/blob/65744ba/supabase/migrations/20260225150000_add_birth_date_and_lab_ref.sql) | Texto bruto da referência do laudo |
| `lab_ref_min` | `NUMERIC` | mesma migração | Limite inferior numérico parseado |
| `lab_ref_max` | `NUMERIC` | mesma migração | Limite superior numérico parseado |

Índice auxiliar:
```sql
CREATE INDEX idx_lab_results_ref
  ON public.lab_results (marker_id, lab_ref_min, lab_ref_max)
  WHERE lab_ref_min IS NOT NULL OR lab_ref_max IS NOT NULL;
```

---

## 10. Pontos de Extensão para Double-Check e Validadores

Os pontos abaixo foram identificados como locais onde é possível **inserir validadores ou double-checks adicionais sem alterar o comportamento atual** (open-closed principle: adição, não modificação).

---

### P1 — Pós-extração da IA, antes do pós-processamento

**Arquivo:** [`supabase/functions/extract-lab-results/index.ts#L2476`](https://github.com/gchohfi/bio-tracker/blob/65744ba/supabase/functions/extract-lab-results/index.ts#L2476)  
**Momento:** logo após `validResults = (parsed.results || []).filter(...)` e antes de `normalizeOperatorText()`

```ts
// PONTO DE EXTENSÃO P1
// Inserir aqui: validador de completude (ex: todos os paineis esperados estão presentes?)
// Inserir aqui: validador de hallucination (ex: valor de marcador verossímil com contexto?)
// Exemplo:
validResults = myCustomPreValidator(validResults, pdfText, patientSex);
```

**Por quê é seguro:** a função downstream `normalizeOperatorText()` já espera um array mutável; adicionar uma etapa aqui não interfere nas etapas seguintes.

---

### P2 — Após `validateAndFixValues()`, antes de `postProcessResults()`

**Arquivo:** [`supabase/functions/extract-lab-results/index.ts#L2500`](https://github.com/gchohfi/bio-tracker/blob/65744ba/supabase/functions/extract-lab-results/index.ts#L2500)  
**Momento:** Valores já foram sanity-checked e corrigidos, mas derivados ainda não foram calculados.

```ts
// PONTO DE EXTENSÃO P2
// Inserir aqui: log estruturado de marcadores fora do sanity range para auditoria
// Inserir aqui: regras de negócio customizadas por paciente (ex: paciente usa anticoagulantes)
validResults = myDomainValidator(validResults, patientSex);
```

---

### P3 — Após `regexFallback()`, antes de `parseLabRefRanges()`

**Arquivo:** [`supabase/functions/extract-lab-results/index.ts#L2507`](https://github.com/gchohfi/bio-tracker/blob/65744ba/supabase/functions/extract-lab-results/index.ts#L2507)  
**Momento:** Conjunto final de marcadores determinado (IA + regex). Ainda não foram parseados os ranges de referência.

```ts
// PONTO DE EXTENSÃO P3
// Inserir aqui: comparação de contagem de marcadores vs. threshold mínimo esperado
// Inserir aqui: callback/webhook para notificação de resultado parcial
validResults = myCompletenessChecker(validResults, pdfText);
```

---

### P4 — Após `convertLabRefUnits()`, antes do `return`

**Arquivo:** [`supabase/functions/extract-lab-results/index.ts#L2510`](https://github.com/gchohfi/bio-tracker/blob/65744ba/supabase/functions/extract-lab-results/index.ts#L2510)  
**Momento:** Pipeline completo; todos os campos finais estão prontos.

```ts
// PONTO DE EXTENSÃO P4 — auditoria final antes de serializar
// Inserir aqui: validador de integridade (lab_ref_min < lab_ref_max para ranges)
// Inserir aqui: exportação para sistema externo de QA/auditoria
validResults = myFinalAuditStep(validResults);
```

---

### P5 — Em `processPdfFile()`, após receber a resposta da Edge Function

**Arquivo:** [`src/pages/PatientDetail.tsx`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/pages/PatientDetail.tsx) ~L820  
**Momento:** Frontend recebeu `results` da edge function, antes de mesclar com `existingValues`.

```ts
// PONTO DE EXTENSÃO P5 — double-check no frontend antes de exibir ao usuário
// Inserir aqui: validador de cross-reference (ex: valor ↔ lab_ref_text coerente?)
// Inserir aqui: detector de outliers baseado em histórico do paciente
const validatedResults = myClientSideValidator(results, patient);
```

---

### P6 — `resolveReference()` — sanity threshold configurável

**Arquivo:** [`src/lib/markers.ts#L787`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/lib/markers.ts#L787)  
O threshold de `ratio <= 5` usado na validação de `lab_ref_text` pode ser **externalizado para configuração** sem alterar a assinatura da função, permitindo ajustar a sensibilidade do filtro por marcador:

```ts
// PONTO DE EXTENSÃO P6
// Atual: hardcoded ratio <= 5
// Extensão: resolver threshold via mapa de configuração por marker.id
const threshold = SANITY_THRESHOLDS[marker.id] ?? 5;
```

---

### P7 — `EditExtractionDialog.onConfirm()` — hook de validação antes de salvar

**Arquivo:** [`src/pages/PatientDetail.tsx#L1154`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/pages/PatientDetail.tsx#L1154)  
```tsx
onConfirm={(updated) => {
  // PONTO DE EXTENSÃO P7
  // Inserir aqui: validação de consistência dos valores editados pelo usuário
  // Ex: verificar se valores estão dentro de bounds fisiológicos plausíveis
  const validated = validateEditedValues(updated, patient);
  setMarkerValues(validated);
  setVerificationOpen(true);
}}
```

---

### P8 — `parseLabRefRanges()` na edge function vs. `parseLabReference()` no frontend

**Problema identificado:** Existem **duas cópias** do mesmo parser (`toFloat` + `OPERATOR_PATTERNS` + lógica de range):
- Frontend: [`src/lib/parseLabReference.ts`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/lib/parseLabReference.ts)
- Backend: [`supabase/functions/extract-lab-results/index.ts#L1431`](https://github.com/gchohfi/bio-tracker/blob/65744ba/supabase/functions/extract-lab-results/index.ts#L1431)

**Ponto de extensão:** Ao adicionar novos padrões de referência ao parser, **ambos os arquivos devem ser atualizados**. Um teste de sincronização existe em [`src/test/marker-sync.test.ts`](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/test/marker-sync.test.ts). Um futuro refactoring poderia extrair o parser para um pacote compartilhado importável pelo Deno.

---

## Resumo de Paths Chave

| Papel | Path | Permalink |
|---|---|---|
| Upload + extração de texto PDF | `src/pages/PatientDetail.tsx` | [L72–L240](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/pages/PatientDetail.tsx#L72) |
| Chamada da Edge Function | `src/pages/PatientDetail.tsx` | [~L814](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/pages/PatientDetail.tsx#L814) |
| Edge Function (Deno) | `supabase/functions/extract-lab-results/index.ts` | [arquivo completo](https://github.com/gchohfi/bio-tracker/blob/65744ba/supabase/functions/extract-lab-results/index.ts) |
| Parser de referências (frontend) | `src/lib/parseLabReference.ts` | [arquivo completo](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/lib/parseLabReference.ts) |
| Parser de referências (backend, cópia inline) | `supabase/functions/extract-lab-results/index.ts` | [~L1431](https://github.com/gchohfi/bio-tracker/blob/65744ba/supabase/functions/extract-lab-results/index.ts#L1431) |
| `resolveReference()` | `src/lib/markers.ts` | [~L724](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/lib/markers.ts#L724) |
| `getMarkerStatus()` | `src/lib/markers.ts` | [~L672](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/lib/markers.ts#L672) |
| UI de revisão (edit) | `src/components/EditExtractionDialog.tsx` | [arquivo completo](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/components/EditExtractionDialog.tsx) |
| UI de revisão (verification) | `src/components/ImportVerification.tsx` | [arquivo completo](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/components/ImportVerification.tsx) |
| Tabela de evolução (uso das referências) | `src/components/EvolutionTable.tsx` | [~L87](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/components/EvolutionTable.tsx#L87) |
| Migração: campos lab_ref | `supabase/migrations/20260225150000_add_birth_date_and_lab_ref.sql` | [arquivo completo](https://github.com/gchohfi/bio-tracker/blob/65744ba/supabase/migrations/20260225150000_add_birth_date_and_lab_ref.sql) |
| Definição de marcadores + labRange | `src/lib/markers.ts` | [arquivo completo](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/lib/markers.ts) |
| Aliases customizados | `src/components/AliasConfigDialog.tsx` | [arquivo completo](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/components/AliasConfigDialog.tsx) |
| Cliente Supabase | `src/integrations/supabase/client.ts` | [arquivo completo](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/integrations/supabase/client.ts) |
| Testes do parser de referências | `src/test/parseLabRefRanges.test.ts` | [arquivo completo](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/test/parseLabRefRanges.test.ts) |
| Testes de sanity bounds | `src/test/sanityBounds.test.ts` | [arquivo completo](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/test/sanityBounds.test.ts) |
| Testes de pós-processamento | `src/test/postProcessResults.test.ts` | [arquivo completo](https://github.com/gchohfi/bio-tracker/blob/65744ba/src/test/postProcessResults.test.ts) |
