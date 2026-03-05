

## Plano: Fix Testosterona Total — ref feminina

### Alteração única

**Arquivo**: `src/lib/markers.ts`, linhas 209-210

**De**:
```typescript
  { id: "testosterona_total", name: "Testosterona Total", unit: "ng/dL",  category: "Hormônios",
    labRange: { M: [241, 827], F: [15, 70] }, panel: "Padrão" },
```

**Para**:
```typescript
  { id: "testosterona_total", name: "Testosterona Total", unit: "ng/dL",  category: "Hormônios",
    labRange: { M: [241, 827], F: [8.4, 48.1] }, panel: "Padrão" },
```

Corrige a referência feminina de `[15, 70]` para `[8.4, 48.1]` conforme lab Confiance (mulheres 20-49 anos). Nenhuma outra alteração.

