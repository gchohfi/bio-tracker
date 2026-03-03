-- 1. Move unique markers from duplicate to original session
UPDATE lab_results SET session_id = 'ab819813-e1f2-4b4f-bb17-35a14da90d98'
WHERE id IN ('f4e68a3c-69a6-4e79-9c27-1fa351fe1741', '7aafd78d-8f61-4f58-84a9-530cee903e60');

-- 2. Fix urina_leucocitos text in original session
UPDATE lab_results SET text_value = '1000 /mL'
WHERE session_id = 'ab819813-e1f2-4b4f-bb17-35a14da90d98' AND marker_id = 'urina_leucocitos';

-- 3. Delete all results from duplicate session
DELETE FROM lab_results WHERE session_id = '26d3ceb9-9ad1-40cd-9e7f-bc60f0a500f5';

-- 4. Delete duplicate session
DELETE FROM lab_sessions WHERE id = '26d3ceb9-9ad1-40cd-9e7f-bc60f0a500f5';