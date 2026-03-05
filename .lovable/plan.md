

## Plano: Fix Leucócitos + Hemácias urina quantitativo labRange

### Alteração 1 — Leucócitos (linha ~58)

**De**:
```typescript
  { id: "leucocitos",      name: "Leucócitos",      unit: "/µL",          category: "Hemograma",
    labRange: { M: [4000, 11000], F: [4000, 11000] }, panel: "Padrão" },
```

**Para**:
```typescript
  { id: "leucocitos",      name: "Leucócitos",      unit: "/µL",          category: "Hemograma",
    labRange: { M: [3600, 11000], F: [3600, 11000] }, panel: "Padrão" },
```

### Alteração 2 — Hemácias urina quantitativo (linha ~586)

**De**:
```typescript
  { id: "urina_hemacias_quant", name: "Hemácias (urina quantitativo)", unit: "/mL", category: "Urina",
    labRange: { M: [0, 10000], F: [0, 10000] }, panel: "Padrão" },
```

**Para**:
```typescript
  { id: "urina_hemacias_quant", name: "Hemácias (urina quantitativo)", unit: "/mL", category: "Urina",
    labRange: { M: [0, 23000], F: [0, 23000] }, panel: "Padrão" },
```

Duas alterações pontuais em `src/lib/markers.ts`. Nenhuma outra mudança.

