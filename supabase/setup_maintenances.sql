-- LOCGEST SETUP MAINTENANCES TABLE (Supabase PostgreSQL)

-- 1. Create public.maintenances table
CREATE TABLE IF NOT EXISTS public.maintenances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    asset_id UUID REFERENCES public.equipment_assets(id) ON DELETE CASCADE NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'Scheduled', -- Scheduled, InProgress, Completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.maintenances ENABLE ROW LEVEL SECURITY;

-- 3. Policy for Whitelabel multi-tenant access
DROP POLICY IF EXISTS "Allow public read/write on maintenances" ON public.maintenances;
CREATE POLICY "Allow public read/write on maintenances" ON public.maintenances FOR ALL USING (true) WITH CHECK (true);
