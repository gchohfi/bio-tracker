

## Plano: Fix T3 Livre — unidade e labRange

### Alteração única

**Arquivo**: `src/lib/markers.ts`, linhas 187-188

**De**:
```typescript
  { id: "t3_livre",        name: "T3 Livre",        unit: "ng/dL",        category: "Tireoide",
    labRange: { M: [0.20, 0.44], F: [0.20, 0.44] }, panel: "Padrão" },
```

**Para**:
```typescript
  { id: "t3_livre",        name: "T3 Livre",        unit: "pg/mL",        category: "Tireoide",
    labRange: { M: [2.0, 4.4], F: [2.0, 4.4] }, panel: "Padrão" },
```

Altera unidade de `ng/dL` para `pg/mL` e referência de `[0.20, 0.44]` para `[2.0, 4.4]`, consistente com o que os labs brasileiros reportam e o extrator salva no banco. Nenhuma outra alteração.

