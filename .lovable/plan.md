

## Plano: Fix Dihidrotestosterona — ref feminina

### Alteração única

**Arquivo**: `src/lib/markers.ts`, linha ~270

**De**:
```typescript
{ id: "dihidrotestosterona", name: "Dihidrotestosterona", unit: "pg/mL", category: "Andrógenos",
    labRange: { M: [250, 990], F: [16, 79] }, panel: "Padrão" },
```

**Para**:
```typescript
{ id: "dihidrotestosterona", name: "Dihidrotestosterona", unit: "pg/mL", category: "Andrógenos",
    labRange: { M: [250, 990], F: [0, 460] }, panel: "Padrão" },
```

Corrige a referência feminina de `[16, 79]` para `[0, 460]` (até 460 pg/mL). Nenhuma outra alteração.

