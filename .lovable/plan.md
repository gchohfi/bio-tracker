

# Problema: Referências de urina rejeitadas pelo sanity check

## Diagnóstico

O console mostra warnings como:
- `Descartando lab_ref_text "< 20000" para urina_leucocitos_quant: sanity check falhou`
- `Descartando lab_ref_text "< 10000" para urina_hemacias_quant: sanity check falhou`
- `Descartando lab_ref_text "< 1" para urina_bilirrubina: sanity check falhou`
- `Descartando lab_ref_text "< 5" para urina_cetona: sanity check falhou`

A função `resolveReference` em `markers.ts` tem dois bugs no sanity check:

1. **Marcadores qualitativos com `labRange: [0, 0]`** (bilirrubina urina, urobilinogênio, cetonas, nitritos): quando `labMax = 0`, a condição `labMax > 0 && labMax < 9000` é `false`, então a referência do PDF ("< 1", "< 5") é **rejeitada** e o sistema mostra "—" em vez da referência real.

2. **Threshold `< 9000` muito baixo**: `urina_leucocitos_quant` tem `labRange [0, 10000]` e `urina_hemacias_quant` também. Como `10000 >= 9000`, a condição `labMax < 9000` falha e as referências "< 20000" e "< 10000" são rejeitadas.

## Correção

### Arquivo: `src/lib/markers.ts` — função `resolveReference` (linhas 728-820)

Duas mudanças:

1. **Pular sanity check para marcadores qualitativos**: se `marker.qualitative === true`, aceitar diretamente o resultado do parse sem validação de ratio. Esses marcadores têm `labRange [0,0]` como placeholder e a referência textual do lab é a fonte de verdade.

2. **Aumentar threshold de `9000` para `100000`**: para marcadores quantitativos de urina que usam unidades como `/mL` com valores na casa dos milhares/dezenas de milhares, o threshold atual é restritivo demais.

```text
resolveReference():
  if labRefText:
    parse it
    if marker.qualitative → accept parsed result directly (skip sanity)
    else → existing sanity check with threshold raised to 100000
```

Isso corrige a exibição das referências qualitativas de urina no dashboard E no PDF exportado, já que ambos usam `resolveReference`.

