-- Make value nullable for qualitative markers that only have text_value
ALTER TABLE public.lab_results ALTER COLUMN value DROP NOT NULL;
ALTER TABLE public.lab_results ALTER COLUMN value SET DEFAULT 0;