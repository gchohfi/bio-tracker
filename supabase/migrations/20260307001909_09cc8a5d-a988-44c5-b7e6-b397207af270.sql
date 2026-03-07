
-- Fix DHT: convert 158 pg/mL → 15.8 ng/dL and set proper female reference
UPDATE lab_results 
SET value = 15.8, 
    lab_ref_text = '5 - 46 ng/dL',
    lab_ref_min = 5,
    lab_ref_max = 46
WHERE id = '1666e48a-19d5-41e1-a809-6b038b9b6b85';

-- Fix Glicemia Média Estimada: clear echoed value from lab_ref_text, set proper labRange
UPDATE lab_results 
SET lab_ref_text = NULL, lab_ref_min = 70, lab_ref_max = 115
WHERE id = 'b3721598-91c1-4171-84a3-3ac91ab4d8c1';

-- Fix VLDL: clear echoed value from lab_ref_text, set proper labRange
UPDATE lab_results 
SET lab_ref_text = NULL, lab_ref_min = 0, lab_ref_max = 30
WHERE id = 'c9273580-3b12-4876-bab8-57c212b8df1c';
