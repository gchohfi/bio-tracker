

# Exportar Prescrição Detalhada como Planilha (CSV)

## Objetivo
Adicionar um botao para exportar a `prescription_table` como arquivo CSV, alem do PDF atual. O CSV pode ser aberto diretamente no Excel, Google Sheets ou qualquer editor de planilhas.

## O que ja existe
A prescrição ja e armazenada como JSONB estruturado na tabela `patient_analyses` com campos bem definidos:
- `substancia`, `dose`, `via`, `frequencia`, `duracao`, `condicoes_ci`, `monitorizacao`

Atualmente so e renderizada dentro do PDF (Documento 3).

## Implementacao

### 1. Criar funcao utilitaria `exportPrescriptionCSV`
**Arquivo:** `src/lib/exportPrescriptionCSV.ts` (novo)

- Receber array de `PrescriptionRow[]` e nome do paciente
- Gerar conteudo CSV com headers em portugues: `Substancia;Dose;Via;Frequencia;Duracao;Condicoes/CI;Monitorizacao`
- Usar separador `;` (padrao brasileiro, abre corretamente no Excel pt-BR)
- Incluir BOM UTF-8 para acentos
- Disparar download automatico como `Prescricao_NomePaciente_Data.csv`

### 2. Adicionar botao de exportacao na pagina do paciente
**Arquivo:** `src/pages/PatientDetail.tsx`

- Ao lado do botao de gerar PDF, adicionar botao "Exportar Prescricao (Planilha)"
- Botao so aparece quando existe `prescription_table` com dados
- Buscar a analise mais recente do paciente (ja disponivel no estado) e chamar `exportPrescriptionCSV`

### Detalhes tecnicos
- Nao requer dependencia externa (CSV puro com `Blob` + `URL.createObjectURL`)
- Formato CSV com BOM (`\uFEFF`) garante encoding correto no Excel
- Separador `;` para compatibilidade com locale pt-BR
