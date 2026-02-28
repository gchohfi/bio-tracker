
# Correção de Referências e Reorganização de Categorias (Planilha PABTrack)

## Resumo

Aplicar todas as correções identificadas na planilha `Referencias_PABTrack_por_Sexo.xlsx`, incluindo ajustes de faixas de referência funcional, correções de unidades, remoção de duplicata, e reorganização de categorias.

---

## 1. Correções de Faixas de Referência (markers.ts)

| Marcador | Campo | Atual | Correto (planilha) |
|---|---|---|---|
| DHT (F) | refRange.F | `[0, 460]` | `[0, 80]` |
| Androstenediona (M) | refRange.M | `[45, 157]` | `[50, 220]` |
| Testosterona Biodisponivel (M) | refRange.M | `[70, 250]` | `[50, 200]` |
| Testosterona Biodisponivel (F) | refRange.F | `[0.5, 8.5]` | `[0.5, 5]` |
| VHS (M) | refRange.M | `[0, 10]` | `[0, 15]` |
| Zinco (M) | refRange.M | `[80, 120]` | `[75, 110]` |
| Cobre (M) | refRange.M | `[70, 140]` | `[80, 155]` |
| Apo A1 (M) | refRange.M | `[104, 202]` | `[108, 225]` |
| Arsenico | refRange (ambos) | `[0, 10]` | `[0, 1]` |
| Arsenico | unit | `mcg/L` | `µg/L` |
| Niquel | refRange (ambos) | `[0, 2.5]` | `[0, 1]` |
| Cobalto | refRange (ambos) | `[0, 0.9]` | `[0, 1]` |
| Albumina urina | refRange (ambos) | `[0, 20]` | `[0, 30]` |
| Progesterona (M) | refRange.M | `[0.2, 1.4]` | `[0, 1]` |

## 2. Remoção de Duplicata

Remover a segunda entrada de `glicemia_media_estimada` (linha 252, com valores `[80, 115]`). Manter apenas a primeira (linha 64, com valores `[70, 100]`).

## 3. Nova Categoria: Inflamacao

Criar a categoria **"Inflamacao"** em `categoryConfig.ts` e mover os seguintes marcadores:

- **PCR**: de Hemograma para Inflamacao
- **VHS**: de Hemograma para Inflamacao
- **Fibrinogenio**: de Coagulacao para Inflamacao

## 4. Reorganizacao de Categorias Existentes

| Marcador | Categoria Atual | Categoria Correta |
|---|---|---|
| Cortisol (manha) | Hormonios | Eixo Adrenal |
| DHT | Androgenos | Hormonios |
| Androstenediona | Androgenos | Hormonios |
| Aldosterona | Eixo Adrenal | Hormonios |
| Dimeros D | Coagulacao | Imunologia |
| Sodio | Eletrolitos | Renal |
| Potassio | Eletrolitos | Renal |
| Calcio Total | Eletrolitos | Renal |
| Calcio Ionico | Eletrolitos | Renal |
| PTH | Eletrolitos | Renal |

Apos essas mudancas:
- **Androgenos** ficara vazio -- sera removido do `categoryConfig.ts`
- **Coagulacao** ficara vazio -- sera removido do `categoryConfig.ts`
- **Eletrolitos** mantera Fosforo, Cloro, Bicarbonato, Calcitonina

## 5. Arquivos Modificados

### `src/lib/categoryConfig.ts`
- Adicionar `"Inflamacao"` com cor HSL propria (ex: `"5 70% 50%"`)
- Remover `"Androgenos"` e `"Coagulacao"`

### `src/lib/markers.ts`
- Corrigir 14 faixas de referencia (tabela acima)
- Corrigir unidade do Arsenico
- Remover duplicata `glicemia_media_estimada`
- Alterar `category` de 10 marcadores conforme reorganizacao

### `src/components/EvolutionTable.tsx`
- Nenhuma alteracao necessaria (usa `CATEGORIES` e `CATEGORY_COLORS` dinamicamente)

### `src/lib/generateReport.ts`
- Nenhuma alteracao necessaria (usa `categoryConfig.ts` como fonte unica)

---

## Detalhes Tecnicos

- Todas as cores de categorias sao derivadas automaticamente de `categoryConfig.ts`
- O componente `EvolutionTable` renderiza categorias dinamicamente, entao mover marcadores entre categorias nao requer mudancas no frontend
- O teste `marker-sync.test.ts` pode precisar de atualizacao se valida IDs ou categorias especificas
