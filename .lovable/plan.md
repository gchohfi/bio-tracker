

## Migration Plan: Create Anamnese & Doctor Notes Tables

### Issue Found
The SQL provided for `doctor_specialty_notes` is **missing columns** that `DoctorNotesTab.tsx` already uses:
- `observacoes_exames` (text)
- `proximos_passos` (text)
- `exames_em_dia` (boolean, default false)
- `adesao_tratamento` (text)
- `motivacao_paciente` (text)

Without these columns, the Doctor Notes tab will fail at runtime.

### Plan
1. **Run the migration** with the user's SQL **plus** the 5 missing columns added to `doctor_specialty_notes`.
2. Also fix `specialty_data` default — `chr(39)||chr(123)||chr(125)||chr(39)` produces `'{}'` (a string), not a JSONB object. Will use `'{}'::jsonb` instead.

### Final SQL (adjusted)
- `patient_anamneses`: as provided, with `specialty_data DEFAULT '{}'::jsonb`
- `doctor_specialty_notes`: as provided + `observacoes_exames TEXT`, `proximos_passos TEXT`, `exames_em_dia BOOLEAN DEFAULT false`, `adesao_tratamento TEXT`, `motivacao_paciente TEXT`
- RLS policies: as provided, using practitioner_id check via patients table

No code changes needed — the components already reference the correct column names.

