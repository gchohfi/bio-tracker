

# Add 6 Missing Markers to MARKER_LIST

## Analysis

Of the markers listed in BUG-5, most **already exist** in both `markers.ts` and the edge function:

| Marker | Status |
|--------|--------|
| Relação A/G, Fibrinogênio, Amilase, Lipase | Already exist |
| DHL (= LDH, id `ldh`) | Already exists |
| Celulose, Amido, Gordura (Coprológico) | Amido + Gordura exist; **Celulose missing** |
| Sangue Oculto (= `copro_sangue`) | Already exists |
| FAN | Already exists |
| Aldosterona, Cortisol urinário 24h, Chumbo | Already exist |
| **Complemento C3/C4** | **Missing** |
| **Anti-DNA, Anti-Sm** | **Missing** |
| **Renina** | **Missing** |
| **Celulose (copro)** | **Missing** |

## 6 Markers to Add

### File 1: `src/lib/markers.ts`

Add to the **Imunologia** section (after `fan`/`fator_reumatoide`):
```typescript
{ id: "complemento_c3",  name: "Complemento C3",  unit: "mg/dL",  category: "Imunologia",
  labRange: { M: [90, 180], F: [90, 180] }, panel: "Adicional" },
{ id: "complemento_c4",  name: "Complemento C4",  unit: "mg/dL",  category: "Imunologia",
  labRange: { M: [10, 40], F: [10, 40] }, panel: "Adicional" },
{ id: "anti_dna",        name: "Anti-DNA",        unit: "UI/mL",  category: "Imunologia",
  labRange: { M: [0, 25], F: [0, 25] }, panel: "Adicional" },
{ id: "anti_sm",         name: "Anti-Sm",         unit: "",       category: "Imunologia",
  labRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },
```

Add to the **Eixo Adrenal** section (near aldosterona):
```typescript
{ id: "renina",          name: "Renina",          unit: "µUI/mL", category: "Eixo Adrenal",
  labRange: { M: [2.8, 39.9], F: [2.8, 39.9] }, panel: "Adicional" },
```

Add to the **Fezes** section:
```typescript
{ id: "copro_celulose",  name: "Celulose",        unit: "",       category: "Fezes",
  labRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },
```

### File 2: `supabase/functions/extract-lab-results/index.ts`

**MARKER_LIST** — add 6 entries matching the above.

**AI prompt aliases section** — add alias mappings:
```
IMUNOLOGIA:
- "COMPLEMENTO C3" / "C3" / "COMPLEMENTO C3, SORO" → complemento_c3
- "COMPLEMENTO C4" / "C4" / "COMPLEMENTO C4, SORO" → complemento_c4
- "ANTI-DNA" / "ANTI-DNA NATIVO" / "ANTICORPO ANTI-DNA" / "Anti-dsDNA" → anti_dna
- "ANTI-SM" / "ANTI-Sm" / "ANTICORPO ANTI-SM" → anti_sm (QUALITATIVE)

EIXO ADRENAL:
- "RENINA" / "ATIVIDADE DE RENINA PLASMÁTICA" / "RENINA DIRETA" / "ARP" → renina

COPROLÓGICO:
- "CELULOSE" / "CELULOSE DIGERÍVEL" / "CELULOSE VEGETAL" → copro_celulose (QUALITATIVE)
```

**Cross-check aliases** (`CROSS_CHECK_ALIASES`) — add entries for the 6 new markers.

**Sanity bounds** — add bounds for quantitative markers (`complemento_c3`, `complemento_c4`, `anti_dna`, `renina`).

### No database migration needed
Marker IDs are just strings stored in `lab_results.marker_id`. No schema change required.

