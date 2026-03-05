

# Correção de Conversões de Unidade: Estradiol, Progesterona e DHT

## Problemas Identificados

Os 3 erros têm a mesma causa raiz: **conflito entre conversão da IA e sanity checks no pós-processamento**.

### Erro 1 — Estradiol (4.4 ng/dL → 440 pg/mL, deveria ser 44)
- A IA converte corretamente: 4.4 × 10 = 44 pg/mL
- Mas o sanity check (linha 702) vê `44 < 50` e aplica `× 10` novamente → 440
- **Bug**: dupla conversão no sanity fix

### Erro 2 — Progesterona (19 ng/dL → 19 ng/mL, deveria ser 0.19)  
- A IA não converteu (manteve 19)
- O sanity check (linha 701) só corrige se `> 50`, então 19 passa direto
- **Bug**: threshold do sanity muito alto + IA falhou em converter

### Erro 3 — DHT (13 ng/dL → 13 pg/mL, deveria ser 130)
- A IA não converteu (manteve 13)
- O sanity check para DHT (linha 711) não tem função `fix`
- **Bug**: sem fallback de conversão

## Correções Propostas

### 1. Estradiol — remover branch que causa dupla conversão
```typescript
// ANTES (bugado):
estradiol: { min: 5, max: 5000, fix: (v) => v < 5 ? v * 100 : v < 50 ? v * 10 : v > 5000 ? v / 10 : v }

// DEPOIS:
estradiol: { min: 5, max: 5000, fix: (v) => v < 5 ? v * 10 : v > 5000 ? v / 10 : v }
```
- `v < 5` (valor em ng/dL não convertido, ex: 4.4) → `× 10` = 44 ✓
- Valores 5–5000 já estão em pg/mL, não mexer

### 2. Progesterona — adicionar detecção de ng/dL não convertido
```typescript
// ANTES:
progesterona: { min: 0, max: 50, fix: (v) => v > 50 ? v / 100 : v }

// DEPOIS (sex-aware):
progesterona: { min: 0, max: 50, fix: (v) => {
  // Labs brasileiros reportam ng/dL (ex: 19, 89). Nosso target é ng/mL.
  // Fase folicular: 0.1-1.5 ng/mL = 10-150 ng/dL
  // Fase lútea: 5-25 ng/mL = 500-2500 ng/dL  
  // Se > 5 para mulher ou > 1.5 para homem, provavelmente ng/dL não convertido
  if (v > 5) return v / 100;  // ng/dL → ng/mL
  return v;
}}
```
- 19 ng/dL → `19 > 5` → `÷ 100` = 0.19 ng/mL ✓
- Valor já convertido (0.19 ng/mL) → não mexe ✓

### 3. DHT — adicionar fix para conversão ng/dL → pg/mL
```typescript
// ANTES:
dihidrotestosterona: { min: 0, max: 2000 }

// DEPOIS:
dihidrotestosterona: { min: 5, max: 2000, fix: (v) => v < 5 ? v * 10 : v }
```
- 13 ng/dL → `13 ≥ 5` → passa (já no range se AI converteu) ... não, 13 está no range.

Melhor abordagem: checar contra referência do lab. Se `lab_ref_max` está em ng/dL (ex: 46), o valor está em ng/dL e precisa `× 10`.

Na verdade, a solução mais robusta é **adicionar conversão determinística no pós-processamento** para estes 3 marcadores, usando o `lab_ref_text` como sinal da unidade fonte:

### 4. Pós-processamento determinístico (abordagem principal)
Adicionar uma etapa após a extração que detecta a unidade fonte pelo `lab_ref_text` e converte deterministicamente:

```typescript
// No postProcessResults ou equivalente:
const UNIT_CONVERSIONS = {
  estradiol:    { sourceUnit: 'ng/dL', targetUnit: 'pg/mL', factor: 10,   detectRef: (max) => max < 100 },
  progesterona: { sourceUnit: 'ng/dL', targetUnit: 'ng/mL', factor: 0.01, detectRef: (max) => max > 50 },
  dihidrotestosterona: { sourceUnit: 'ng/dL', targetUnit: 'pg/mL', factor: 10, detectRef: (max) => max < 100 },
};
```
Se o `lab_ref_max` indica unidade ng/dL (ex: estradiol ref max 23.3, progesterona ref max 89, DHT ref max 46), aplicar conversão e também converter as referências.

### 5. Corrigir dados existentes no banco
Migration SQL para corrigir os 3 valores da paciente atual.

## Arquivos a alterar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/extract-lab-results/index.ts` | Corrigir sanity fixes + adicionar pós-processamento determinístico |
| Migration SQL | Corrigir os 3 valores errados no banco |

## Resumo
- Estradiol: corrigir sanity para não duplicar conversão
- Progesterona: baixar threshold do sanity
- DHT: adicionar fix de conversão
- Adicionar detecção determinística por lab_ref como camada extra de segurança
- Corrigir dados existentes via migration

