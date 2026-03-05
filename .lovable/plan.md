

## Plano: Fix Testosterona Livre — ref feminina

### Alteração única

**Arquivo**: `src/lib/markers.ts`, linhas 212-213

**De**:
```typescript
  { id: "testosterona_livre", name: "Testosterona Livre", unit: "ng/dL",  category: "Hormônios",
    labRange: { M: [3.0, 24.0], F: [0.06, 0.68] }, panel: "Padrão" },
```

**Para**:
```typescript
  { id: "testosterona_livre", name: "Testosterona Livre", unit: "ng/dL",  category: "Hormônios",
    labRange: { M: [3.0, 24.0], F: [0.086, 0.95] }, panel: "Padrão" },
```

Corrige a referência feminina de `[0.06, 0.68]` para `[0.086, 0.95]` conforme lab Confiance (mulheres 20-49 anos). Nenhuma outra alteração.

