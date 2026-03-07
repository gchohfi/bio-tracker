
-- Fix DHT reference for Julia's session
UPDATE lab_results
SET lab_ref_text = '5 - 46 ng/dL',
    lab_ref_min = 5,
    lab_ref_max = 46
WHERE session_id = '99e99f05-8de8-45d3-8fca-e36f9238f588'
  AND marker_id = 'dihidrotestosterona';

-- Fix Glicemia Média Estimada - clear echoed value ref
UPDATE lab_results
SET lab_ref_text = NULL,
    lab_ref_min = NULL,
    lab_ref_max = NULL
WHERE session_id = '99e99f05-8de8-45d3-8fca-e36f9238f588'
  AND marker_id = 'glicemia_media_estimada';
