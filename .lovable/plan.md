

## Plano: Fix Vitamina B12 placeholder + formatRefDisplay threshold

### Parte A — labRange (linha 282-283)

**De**:
```typescript
  { id: "vitamina_b12",    name: "Vitamina B12",     unit: "pg/mL",        category: "Vitaminas",
    labRange: { M: [300, 9999], F: [300, 9999] }, panel: "Padrão" },  // Ref. Lab.: "Normal: maior que 300 pg/mL"
```

**Para**:
```typescript
  { id: "vitamina_b12",    name: "Vitamina B12",     unit: "pg/mL",        category: "Vitaminas",
    labRange: { M: [197, 771], F: [197, 771] }, panel: "Padrão" },
```

### Parte B — formatRefDisplay (linhas 898-899)

**De**:
```typescript
  if ((mn === 0 || mn == null) && mx != null && mx < 999) return `< ${mx}`;
  if (mx == null || mx >= 99999) return `> ${mn}`;
```

**Para**:
```typescript
  if ((mn === 0 || mn == null) && mx != null && mx < 900) return `< ${mx}`;
  if (mx == null || mx >= 900) return `> ${mn}`;
```

Duas alterações no mesmo arquivo `src/lib/markers.ts`. Nenhuma outra mudança.

