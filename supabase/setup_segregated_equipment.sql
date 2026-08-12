-- LOCGEST SEGREGATED EQUIPMENT SCHEMA (Supabase PostgreSQL)
-- Segregation into: equipment_catalog, equipment_pricing, equipment_assets

-- 1. EQUIPMENT CATALOG (MODELOS & TIPOS DE EQUIPAMENTOS)
CREATE TABLE IF NOT EXISTS public.equipment_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- Containers, Escavação, Geradores, Elevação, Compactação, Ferramentas
    brand_model TEXT,
    description TEXT,
    images TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EQUIPMENT PRICING (TABELA DE PREÇOS E TARIFAS POR MODELO/TAMANHO)
CREATE TABLE IF NOT EXISTS public.equipment_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    catalog_id UUID REFERENCES public.equipment_catalog(id) ON DELETE CASCADE NOT NULL,
    size_dimension TEXT NOT NULL DEFAULT 'Padrão', -- ex: "20 Pés (6m)", "40 Pés (12m)", "3,5 Toneladas", "100 kVA"
    daily_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    monthly_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EQUIPMENT ASSETS (UNIDADES FÍSICAS DE PATRIMÔNIO / FROTA)
CREATE TABLE IF NOT EXISTS public.equipment_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    catalog_id UUID REFERENCES public.equipment_catalog(id) ON DELETE CASCADE NOT NULL,
    pricing_id UUID REFERENCES public.equipment_pricing(id) ON DELETE SET NULL,
    code TEXT NOT NULL, -- Asset Tag / Patrimônio (ex: CONT-001, ESC-001)
    serial_number TEXT,
    status TEXT NOT NULL DEFAULT 'Available', -- Available, Rented, Maintenance, InTransit, Reserved, Interno
    location_current TEXT DEFAULT 'Pátio Central',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.equipment_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_assets ENABLE ROW LEVEL SECURITY;

-- Permissive policies for whitelabel multi-tenant app
DROP POLICY IF EXISTS "Allow public read/write on equipment_catalog" ON public.equipment_catalog;
CREATE POLICY "Allow public read/write on equipment_catalog" ON public.equipment_catalog FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on equipment_pricing" ON public.equipment_pricing;
CREATE POLICY "Allow public read/write on equipment_pricing" ON public.equipment_pricing FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on equipment_assets" ON public.equipment_assets;
CREATE POLICY "Allow public read/write on equipment_assets" ON public.equipment_assets FOR ALL USING (true) WITH CHECK (true);
