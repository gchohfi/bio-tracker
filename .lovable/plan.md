

## Correção: Migration com `user_id` incorreto

### Situação atual

- O **banco de dados em produção** já tem a política correta (`doctor_notes_policy` usando `practitioner_id = auth.uid()`). Alguma correção posterior já foi aplicada.
- O **arquivo de migration** (`20260303100000_add_doctor_specialty_notes.sql`, linha 41) ainda referencia `user_id`, que não existe na tabela `patients`.

### Correção

Corrigir a migration existente na linha 41, trocando `user_id` por `practitioner_id`:

```sql
-- Antes (linha 41):
SELECT id FROM public.patients WHERE user_id = auth.uid()

-- Depois:
SELECT id FROM public.patients WHERE practitioner_id = auth.uid()
```

Isso é uma correção apenas no arquivo de migration para consistência. O banco live já funciona corretamente.

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/20260303100000_add_doctor_specialty_notes.sql` | Trocar `user_id` por `practitioner_id` na linha 41 |

