# Reorganização: Prontuário → Consulta → Nota Clínica

## 1. Estrutura ATUAL (problemas)

### Tabs no PatientDetail.tsx (ordem atual)
| Tab | value | Componente | Entidade DB |
|-----|-------|-----------|-------------|
| Sessões | `sessions` | inline (PatientDetail) | `lab_sessions` + `lab_results` |
| Evolução | `evolution` | `EvolutionTable` | `lab_results` (tabela comparativa) |
| Timeline | `timeline` | `EvolutionTimeline` | `lab_results` (gráfico temporal) |
| Análise IA | `analysis` | inline + `ClinicalReportV2` | `patient_analyses` + `analysis_reviews` |
| Anamnese | `anamnese` | `AnamneseTab` | `patient_anamneses` |
| Notas Clínicas | `doctor_notes` | `DoctorNotesTab` | `doctor_specialty_notes` |
| **Prontuário** | `clinical_evolution` | `ClinicalEvolutionTab` | `clinical_encounters` + `clinical_evolution_notes` + `clinical_prescriptions` |

### Problemas identificados

1. **Nomes invertidos**
   - A tab "Prontuário" é na verdade o gerenciador de *Consultas/Atendimentos*
   - A tab "Notas Clínicas" (`DoctorNotesTab`) é um formulário avulso por especialidade sem vínculo com consulta — funciona como "Impressão geral do médico"
   - A tab "Evolução" é sobre *marcadores laboratoriais*, não evolução clínica

2. **Entidades duplicadas/fragmentadas**
   - `doctor_specialty_notes`: notas avulsas por paciente+especialidade (sem encounter_id) — sobrepõe os campos SOAP de `clinical_evolution_notes`
   - `clinical_evolution_notes`: notas SOAP vinculadas a encounter — faz o mesmo papel, mas organizado por consulta
   - Prescrição: existe em `patient_analyses.prescription_table` (legado IA) E em `clinical_prescriptions` (nova, por encounter)

3. **Análise IA desconectada**
   - Tab "Análise IA" é independente, com filtro próprio de encounter, mas não está dentro do prontuário
   - A revisão médica (`analysis_reviews`) tem `encounter_id` redundante — deveria seguir via `analysis_id → patient_analyses.encounter_id`

4. **Fragmentação de UX**
   - O médico precisa navegar 7 tabs para entender o paciente
   - "Notas Clínicas" e campos SOAP no "Prontuário" competem pela mesma informação

---

## 2. Estrutura RECOMENDADA

### Modelo de entidades (hierarquia)

```
Paciente (patients)
  └── Prontuário = visão consolidada do paciente
       ├── Consulta (clinical_encounters)
       │    ├── Nota Clínica / SOAP (clinical_evolution_notes)
       │    ├── Análise IA (patient_analyses via encounter_id)
       │    │    └── Revisão Médica (analysis_reviews via analysis_id)
       │    └── Prescrição (clinical_prescriptions via encounter_id)
       │
       ├── Exames Laboratoriais
       │    ├── Sessões (lab_sessions)
       │    ├── Resultados (lab_results + lab_historical_results)
       │    ├── Evolução de Marcadores (tabela comparativa)
       │    └── Timeline (gráfico temporal)
       │
       ├── Anamnese (patient_anamneses — por especialidade, estática)
       └── Análises Avulsas (patient_analyses sem encounter_id)
```

### Tabs reorganizadas

| Tab | Conteúdo | Ícone |
|-----|----------|-------|
| **Prontuário** (1ª posição) | Lista de consultas + ao abrir: SOAP, Análises vinculadas, Prescrição, tudo dentro do encounter | 📋 |
| **Exames** | Sessões + Importação | 🧪 |
| **Evolução** | Tabela comparativa de marcadores | 📊 |
| **Timeline** | Gráfico temporal de marcadores | ⏱ |
| **Análise IA** | Todas as análises (agrupadas por encounter quando possível, avulsas quando não) | 🧠 |
| **Anamnese** | Anamnese por especialidade | 📝 |

### O que DESAPARECE
- Tab "Notas Clínicas" (`DoctorNotesTab` / `doctor_specialty_notes`) → migrar dados úteis para notas SOAP ou eliminar
- A redundância conceitual entre "Notas Clínicas" e "Prontuário"

---

## 3. Renomeações necessárias

| De | Para | Arquivo |
|----|------|---------|
| Tab "Prontuário" → mover para 1ª posição | Manter nome "Prontuário" | PatientDetail.tsx |
| Tab "Sessões" | "Exames" | PatientDetail.tsx |
| Tab "Notas Clínicas" | **REMOVER** (migrar dados) | PatientDetail.tsx |
| `ClinicalEvolutionTab` | Nome OK, mas é o gerenciador de consultas dentro do Prontuário | — |
| `clinical_evolution_notes` | Nome OK — é a nota SOAP da consulta | — |
| `doctor_specialty_notes` | **DEPRECAR** — dados migram para notas SOAP ou campo livre | — |

---

## 4. Plano de migração incremental

### Fase A: Reorganizar tabs (UX, sem mudar dados)
1. Mover tab "Prontuário" para 1ª posição
2. Renomear tab "Sessões" → "Exames"
3. Remover tab "Notas Clínicas" (ou ocultar com flag)
4. **Risco**: baixo — só muda ordem/visibilidade de tabs

### Fase B: Consolidar Análise IA no Prontuário
1. Dentro do encounter no Prontuário, já mostra análises vinculadas (✅ feito)
2. Tab "Análise IA" continua existindo para análises avulsas e visão global
3. Remover `encounter_id` de `analysis_reviews` (usar via `analysis_id → patient_analyses.encounter_id`)
4. **Risco**: médio — precisa atualizar queries de review

### Fase C: Migrar doctor_specialty_notes
1. Para cada paciente com `doctor_specialty_notes`, oferecer "importar para nota SOAP" da consulta mais recente
2. Ou manter como "Impressão geral" dentro do Prontuário (campo estático por especialidade, sem encounter)
3. Após migração, deprecar tabela
4. **Risco**: médio — dados existentes

### Fase D: Cleanup técnico
1. Remover `prescription_table` do fluxo de geração de análise (ou manter como referência read-only)
2. Prescrição por encounter como fonte principal
3. PDF/Excel usam `clinical_prescriptions`
4. **Risco**: baixo — já coexistem

---

## 5. Ordem recomendada de implementação

```
Fase A: Reorganizar tabs ───────────── [próxima]
  ↓
Fase B: Cleanup analysis_reviews ──── [depois]
  ↓  
Fase C: Migrar/deprecar DoctorNotes ─ [depois]
  ↓
Fase D: Cleanup prescrição legada ─── [depois]
  ↓
Fase E: PDF/Excel da prescrição ───── [final]
```

---

## 6. Decisões pendentes

- [ ] Manter "Anamnese" como tab própria ou mover para dentro do Prontuário?
- [ ] `doctor_specialty_notes`: migrar dados ou manter como "Impressão por especialidade" (sem encounter)?
- [ ] Tab "Análise IA" global: manter ou só mostrar dentro de cada encounter?
