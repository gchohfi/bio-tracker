-- Reverse wrong estradiol conversion (was ×10, should not have been converted)
UPDATE lab_results SET value = 44 WHERE id = '4c90d662-3c56-4605-a51a-b9ed446f9b68';
UPDATE lab_results SET value = 396 WHERE id = 'cc2fe059-617e-4f00-99e7-7bf212dd9851';

-- Reverse wrong testosterona_livre conversion (was ÷34.7, should not have been converted)
UPDATE lab_results SET value = 0.44 WHERE id = 'c699fc17-9c66-4a93-88f4-ba1b69b237ab';
UPDATE lab_results SET value = 0.57 WHERE id = 'c5de8af6-1a54-4b32-a26f-39448643b172';