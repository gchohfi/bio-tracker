

## Correção: Cores no PDF Exportado

### Problemas Identificados

**1. `dataColStart = 4` deveria ser `3`** (linha 406 de `generateReport.ts`)

O cabeçalho é: `["Marcador"(0), "Un."(1), "Ref. Lab."(2), Session1(3), Session2(4), ..., "Tend.", "Evolução"]`

Com `dataColStart = 4`, a primeira coluna de sessão (índice 3) nunca recebe coloração verde/vermelha. Além disso, `columnStyles[3]` (linha 442) aplica estilo cinza/itálico nessa coluna — sobrescrevendo os valores.

**2. `getMarkerStatus()` tem lógica quebrada** (linhas 675-688)

O PDF usa `getMarkerStatus()` que:
- Para `<`/`<=`: **sempre retorna "normal"** (linha 679 — dead code)
- Para `>`/`>=`: retorna **"high"** quando deveria ser "normal" (linha 682: `value >= min` retorna high em vez de normal)
- **Não usa `resolveReference`** nem sanity bounds — então referências lixo como `>= 20` para LDL passam direto

Enquanto a tabela de evolução no app usa corretamente `resolveReference` + `getMarkerStatusFromRef`.

**3. Dados confirmados no banco**

LDL sessão 2025-11-05: valor=148, `lab_ref_text=">= 20"`, labRange=[0,130]. Com sanity bounds, `>= 20` é rejeitado (labMin=0, impossível validar). Fallback para labRange 0-130 → status=HIGH ✓

### Alterações em `src/lib/generateReport.ts`

1. **Linha 406**: Mudar `dataColStart` de `4` para `3`
2. **Linha 442**: Remover `columnStyles[3]` (é coluna de dados, não referência)
3. **Linhas 450-468** (`didParseCell`): Substituir `getMarkerStatus` por `resolveReference` + `getMarkerStatusFromRef`, passando o `lab_ref_text` do marcador via `labRefByMarker`
4. **Imports**: Adicionar `resolveReference` e `getMarkerStatusFromRef` aos imports de `markers.ts`

```typescript
// didParseCell - nova lógica (substituir linhas 458-460):
const marker = markersWithData[data.row.index];
if (marker) {
  const labRef = labRefByMarker[marker.id];
  const ref = resolveReference(marker, sex, labRef?.text);
  const status = getMarkerStatusFromRef(val, ref);
  // ... resto igual
}
```

### Resultado
- Todas as colunas de sessão terão verde/vermelho correto
- Lógica idêntica entre tabela no app e PDF exportado
- Sem mais coluna cinza na primeira sessão

