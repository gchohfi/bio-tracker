# Arquitetura do Pipeline de Importação e Relatórios

## Visão Geral

```
PDF do Laudo
     │
     ▼
┌─────────────────────────────────┐
│  Edge Function: extract-lab-results  │
│                                 │
│  prompt.ts → IA extrai texto    │
│       │                         │
│       ▼                         │
│  normalize.ts                   │
│  Normaliza texto, deduplica     │
│       │                         │
│       ▼                         │
│  unitInference.ts               │
│  Detecta unidade fonte,         │
│  marca _sourceUnit/_targetUnit  │
│       │                         │
│       ▼                         │
│  convert.ts                     │
│  Aplica fator de conversão      │
│  (valor + referência juntos)    │
│       │                         │
│       ▼                         │
│  scale.ts                       │
│  Ajustes de escala (OCR fixes)  │
│       │                         │
│       ▼                         │
│  validate.ts                    │
│  Sanity bounds, quality score   │
│       │                         │
│       ▼                         │
│  derive.ts                      │
│  Marcadores derivados           │
│  (HOMA-IR, PSA ratio, VLDL)    │
│       │                         │
│       ▼                         │
│  regexFallback.ts               │
│  Fallback determinístico        │
│       │                         │
│       ▼                         │
│  Persistência (lab_results +    │
│  lab_historical_results)        │
└─────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────┐
│  Frontend: Renderização         │
│                                 │
│  markers.ts                     │
│  Fonte de verdade: unidade      │
│  canônica, labRange, categoria  │
│       │                         │
│       ├──▶ generateReport.ts    │
│       │   PDF do relatório      │
│       │                         │
│       ├──▶ evolutionReportBuilder│
│       │   Série temporal +      │
│       │   buildFallbackRef()    │
│       │                         │
│       ├──▶ generateEvolutionPdf │
│       │   PDF evolutivo         │
│       │                         │
│       └──▶ EvolutionTimeline    │
│           Componente visual     │
└─────────────────────────────────┘
```

## Fonte de Verdade (v1.2)

| Conceito | Fonte | Arquivo |
|---|---|---|
| Unidade canônica | `MARKERS[].unit` | `src/lib/markers.ts` |
| Referência laboratorial | `MARKERS[].labRange` | `src/lib/markers.ts` |
| Regras de conversão | `CONVERSION_RULES` | `pipeline/conversionRules.ts` |
| Aliases de marcador | `MARKER_ALIASES` | `pipeline/markerAliases.ts` |
| Valores persistidos | `lab_results` + `lab_historical_results` | Banco de dados |
| Classificação de status | `resolveReference()` → `getMarkerStatusFromRef()` | `src/lib/markers.ts` |
| Fallback de referência | `buildFallbackRef()` | `src/lib/evolutionReportBuilder.ts` |

## Onde Adicionar uma Nova Regra de Conversão

1. **Abrir** `supabase/functions/extract-lab-results/pipeline/conversionRules.ts`
2. **Adicionar** entrada em `CONVERSION_RULES[marker_id]`
3. **Definir**: `from_unit_pattern`, `from_unit_label`, `to_unit`, `factor`, `description`
4. **Se necessário**, adicionar alias em `pipeline/markerAliases.ts`
5. **Verificar** que `MARKERS[marker_id].unit` em `src/lib/markers.ts` corresponde ao `to_unit`
6. **Adicionar** golden case em `src/test/goldenCases.fixtures.ts`
7. **Rodar** testes: `npm test`

## Sequência de Execução

```
NORMALIZE → INFER UNIT → CONVERT → SCALE → VALIDATE → DERIVE → FALLBACK → PERSIST
```

Cada etapa é **idempotente**.

## Diferenciação de Transformações

| Tipo | Exemplo | Responsável |
|---|---|---|
| Unit Conversion | pg/mL → ng/dL (×0.1) | `convert.ts` via `conversionRules.ts` |
| Scale Adjustment | leucócitos 4.5 → 4500 | `scale.ts` |
| Derived Value | HOMA-IR = glicose × insulina / 405 | `derive.ts` |

## Módulos Sensíveis (Rollback)

| Prioridade | Módulo | Risco |
|---|---|---|
| 🔴 Alta | `conversionRules.ts` | Conversão incorreta altera valores clínicos |
| 🔴 Alta | `unitInference.ts` / `infer_unit.ts` | Heurísticas podem disparar conversão indevida |
| 🟡 Média | `evolutionReportBuilder.ts` | Fallback de referência afeta PDF evolutivo |
| 🟢 Baixa | `prompt.ts` | Afeta apenas extração futura, não dados existentes |

## Resumo do PDF — Fórmula de Contagem

```
totalClassified = normalCount + alertCount + qualitativeCount
```

- **normalCount**: `getMarkerStatusFromRef() === "normal"`
- **alertCount**: `getMarkerStatusFromRef() !== "normal"`
- **qualitativeCount**: `marker.qualitative === true` com `text_value`

---

## Modelo de Dados Clínico (v1.0)

### Diagrama ER — Vínculos principais

```
┌──────────────┐
│   patients   │  (raiz do prontuário)
│   id (PK)    │
└──────┬───────┘
       │ patient_id
       ├──────────────────────────────────────────────────────┐
       │                                                      │
       ▼                                                      ▼
┌──────────────────┐                                ┌─────────────────┐
│  lab_sessions    │                                │ clinical_       │
│  id (PK)         │                                │ encounters      │
│  patient_id (FK) │                                │ id (PK)         │
│  session_date    │                                │ patient_id (FK) │
└──────┬───────────┘                                │ encounter_date  │
       │ session_id                                 │ status          │
       ├──────────────┐                             └──────┬──────────┘
       ▼              ▼                                    │ encounter_id
┌────────────┐ ┌──────────────────┐         ┌──────────────┼──────────────┐
│ lab_results│ │lab_historical_   │         │              │              │
│ session_id │ │results           │         ▼              ▼              ▼
│ marker_id  │ │session_id        │  ┌─────────────┐ ┌──────────┐ ┌──────────────┐
│ value      │ │marker_id         │  │clinical_    │ │patient_  │ │clinical_     │
└────────────┘ │result_date       │  │evolution_   │ │analyses  │ │prescriptions │
               └──────────────────┘  │notes (SOAP) │ │          │ │              │
                                     │encounter_id │ │encounter │ │encounter_id  │
                                     └─────────────┘ │_id (FK,  │ │patient_id    │
                                                     │nullable) │ │source_       │
                                                     └────┬─────┘ │analysis_id   │
                                                          │       └──────────────┘
                                                          │ analysis_id
                                                          ▼
                                                   ┌──────────────┐
                                                   │analysis_     │
                                                   │reviews       │
                                                   │analysis_id   │
                                                   │patient_id    │
                                                   │practitioner  │
                                                   │_id           │
                                                   └──────────────┘
```

### Tabela de vínculos

| Entidade | Vínculo principal | Tipo | Observação |
|---|---|---|---|
| `patients` | — (raiz) | — | Entidade raiz do prontuário |
| `clinical_encounters` | `patient_id` | FK | Consulta/atendimento datado |
| `clinical_evolution_notes` | `encounter_id` | FK | Nota SOAP, 1:N por encounter |
| `lab_sessions` | `patient_id` | FK | Sessão de exame, sem vínculo com encounter |
| `lab_results` | `session_id` | FK | Resultado atual, via session → patient |
| `lab_historical_results` | `session_id` | FK | Resultado histórico, via session → patient |
| `patient_analyses` | `patient_id` + `encounter_id` (nullable) | FK | Análise IA; vinculada a encounter quando gerada dentro de consulta |
| `analysis_reviews` | `analysis_id` | FK | Revisão médica; `patient_id` é desnormalizado para RLS |
| `clinical_prescriptions` | `encounter_id` + `patient_id` | FK | Prescrição; `patient_id` desnormalizado para RLS |
| `doctor_specialty_notes` | `patient_id` + `specialty_id` | FK | ⚠️ **LEGADO/DEPRECADO** — sem encounter_id |

### Decisões arquiteturais

1. **Exames pertencem ao paciente, não à consulta.**
   `lab_sessions` → `patient_id`. Exames têm ciclo de vida independente (podem ser importados fora de consulta). A consulta *consome* exames mas não os possui.

2. **Consulta organiza o conteúdo clínico do atendimento.**
   `clinical_encounters` é o agrupador de: nota SOAP (`clinical_evolution_notes`), análise IA (`patient_analyses` via `encounter_id`) e prescrição (`clinical_prescriptions` via `encounter_id`).

3. **Revisão médica deriva da análise, não da consulta.**
   `analysis_reviews.analysis_id` → `patient_analyses.id`. O vínculo com a consulta é derivado: `review → analysis → encounter`. Campos `patient_id` e `practitioner_id` em `analysis_reviews` existem apenas para performance de RLS.

4. **`doctor_specialty_notes` está DEPRECADO.**
   Tabela legada com notas avulsas por especialidade, sem vínculo com encounter. Funcionalidade substituída por notas SOAP em `clinical_evolution_notes`. Dados existentes serão migrados na Fase C do plano de refatoração (ver `prontuario-refactor.md`).

   **Status de deprecação (atualizado):**
   - `src/components/DoctorNotesTab.tsx` — componente marcado como `@deprecated`, import comentado em `PatientDetail.tsx`
   - `supabase/functions/analyze-lab-results/index.ts` — fetch da tabela mantido como fallback read-only, marcado `[DEPRECATED]`
   - `clinicalContext.types.ts` — campo `doctorNotes` marcado `@deprecated`
   - **Nenhuma nova escrita** é feita pela UI principal
   - **Nenhum novo componente** deve referenciar esta tabela
   - A tabela e seus dados **não serão removidos** até a migração formal

5. **Campos desnormalizados são intencionais.**
   `patient_id` em `clinical_prescriptions` e `analysis_reviews` é redundante com o caminho via encounter/analysis, mas necessário para RLS performático sem JOINs recursivos.

### Vínculos explícitos vs. implícitos

| Relação | Tipo | Status |
|---|---|---|
| Consulta → Nota SOAP | Explícito (`encounter_id` FK) | ✅ Correto |
| Consulta → Análise IA | Explícito (`encounter_id` FK, nullable) | ✅ Correto |
| Consulta → Prescrição | Explícito (`encounter_id` FK) | ✅ Correto |
| Consulta → Exames | **Não existe** | ⚠️ Intencional — exames são do paciente |
| Análise → Revisão | Explícito (`analysis_id` FK) | ✅ Correto |
| Prescrição → Análise origem | Explícito (`source_analysis_id` FK, nullable) | ✅ Correto |
| Paciente → Exames | Explícito (`patient_id` via `lab_sessions`) | ✅ Correto |
