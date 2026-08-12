-- ALTER TABLE proposals to add pdf_url column
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS pdf_url TEXT;
