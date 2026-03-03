-- Fix Estradiol 2025-11-10: 440 → 44 pg/mL
UPDATE lab_results SET value = 44 WHERE id = '1dae501a-aba2-4328-9ca5-0127dc55c214';

-- Fix Progesterona 2025-11-10: 19 → 0.19 ng/mL
UPDATE lab_results SET value = 0.19 WHERE id = 'f22fef7c-f2c7-4379-a01e-c0c8d803f2a4';

-- Fix DHT 2026-02-07: value 13 → 130 pg/mL, refs 16-79 → 160-790
UPDATE lab_results SET value = 130, lab_ref_min = 160, lab_ref_max = 790, lab_ref_text = '160 a 790'
WHERE id = '4490c5a2-55a7-44c0-94bc-14cdf8b2fc3f';

-- Fix DHT 2025-11-10: refs 16-79 → 160-790 (value 70 is already correct)
UPDATE lab_results SET lab_ref_min = 160, lab_ref_max = 790, lab_ref_text = '160 a 790'
WHERE id = '041707ac-8e7c-4709-ad5f-2b0d414146ba';