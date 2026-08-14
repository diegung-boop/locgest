-- LOCGEST DATABASE SCHEMA & SEED DATA (Supabase PostgreSQL)
-- Whitelabel SaaS for Machinery & Equipment Rental Companies

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ORGANIZATIONS (TENANTS)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    trade_name TEXT,
    cnpj TEXT,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#0284c7',
    plan TEXT DEFAULT 'Enterprise',
    status TEXT DEFAULT 'active', -- active, suspended, trial
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PROFILES (USERS WITH RBAC & TENANT LINKED TO AUTH.USERS)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Analista', -- Admin, Diretor, Gestor, Analista, Entregador, Cliente
    is_super_admin BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUTOMATIC PROFILE CREATION TRIGGER FROM AUTH.USERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_is_super_admin BOOLEAN;
  v_full_name TEXT;
  v_role TEXT;
BEGIN
  -- Safe casting for organization_id
  IF NEW.raw_user_meta_data->>'organization_id' IS NOT NULL AND NEW.raw_user_meta_data->>'organization_id' != '' AND NEW.raw_user_meta_data->>'organization_id' != 'null' THEN
    v_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
  ELSE
    v_org_id := NULL;
  END IF;

  -- Safe casting for is_super_admin
  IF NEW.raw_user_meta_data->>'is_super_admin' IS NOT NULL AND NEW.raw_user_meta_data->>'is_super_admin' != '' THEN
    v_is_super_admin := (NEW.raw_user_meta_data->>'is_super_admin')::boolean;
  ELSE
    v_is_super_admin := false;
  END IF;

  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Usuário Sem Nome');
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Analista');

  -- If a profile with this email already exists (e.g. created with random client-side UUID previously)
  -- we heal the record by updating its ID to match the authentic auth.users.id
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = NEW.email) THEN
    UPDATE public.profiles
    SET id = NEW.id,
        organization_id = COALESCE(v_org_id, organization_id),
        full_name = COALESCE(v_full_name, full_name),
        role = COALESCE(v_role, role),
        is_super_admin = COALESCE(v_is_super_admin, is_super_admin),
        updated_at = NOW()
    WHERE email = NEW.email;
  ELSE
    INSERT INTO public.profiles (id, email, full_name, role, organization_id, is_super_admin)
    VALUES (
      NEW.id,
      NEW.email,
      v_full_name,
      v_role,
      v_org_id,
      v_is_super_admin
    );
  END IF;
    
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't prevent the user from being created in auth.users
  RAISE WARNING 'Failed to create profile for new user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. EQUIPMENT (PATRIMÔNIO / FROTA)
CREATE TABLE IF NOT EXISTS public.equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL, -- Asset Tag / Patrimônio (ex: ESC-001)
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- Escavação, Geradores, Compactação, Elevação, Ferramentas
    brand_model TEXT,
    serial_number TEXT,
    daily_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    monthly_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'Available', -- Available, Rented, Maintenance, InTransit, Reserved
    location_current TEXT DEFAULT 'Pátio Central',
    specifications JSONB DEFAULT '{}'::jsonb,
    images TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CLIENTS (CLIENTES)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    company_name TEXT NOT NULL, -- Razão Social
    trade_name TEXT, -- Nome Fantasia
    cnpj_cpf TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    contact_person TEXT,
    state_registration TEXT,
    billing_address TEXT,
    default_job_site TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PROPOSALS (PEDIDOS & PROPOSTAS COMERCIAIS)
CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    proposal_number TEXT NOT NULL, -- ex: PROP-2026-089
    status TEXT NOT NULL DEFAULT 'Draft', -- Draft, Sent, Approved, Rejected, Cancelled
    job_site_name TEXT NOT NULL, -- Nome da Obra / Local
    job_site_address TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    requested_delivery_date DATE NOT NULL,
    equipment_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CONTRACTS (CONTRATOS DE LOCAÇÃO)
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
    contract_number TEXT NOT NULL, -- ex: CONT-2026-042
    status TEXT NOT NULL DEFAULT 'PendingSignature', -- Draft, PendingSignature, Active, Finished, Terminated
    total_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    billing_cycle TEXT DEFAULT 'Monthly', -- Daily, Weekly, Fortnightly, Monthly
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    terms_conditions TEXT,
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. FINANCIAL RECORDS (NOTAS FISCAIS & BOLETOS)
CREATE TABLE IF NOT EXISTS public.financial_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- 'nf_service', 'nf_remessa', 'boleto'
    code_number TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Paid, Overdue, Cancelled
    payment_proof_url TEXT,
    paid_at TIMESTAMPTZ,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SERVICE ORDERS (LOGÍSTICA E ORDENS DE SERVIÇO DE CAMPO)
CREATE TABLE IF NOT EXISTS public.service_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    os_number TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Delivery',
    status TEXT NOT NULL DEFAULT 'Pending',
    scheduled_date DATE NOT NULL,
    job_site_address TEXT NOT NULL,
    delivered_at TIMESTAMPTZ,
    notes TEXT,
    
    -- EVIDÊNCIAS DE CAMPO (FOTOS E GPS)
    photos TEXT[] DEFAULT ARRAY[]::TEXT[],
    geo_latitude NUMERIC(10,8),
    geo_longitude NUMERIC(11,8),
    geo_timestamp TIMESTAMPTZ,
    receiver_name TEXT,
    receiver_document TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated users (Development permissive mode)
CREATE POLICY "Allow public read/write access on organizations" ON public.organizations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read/write on profiles" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Allow authenticated read/write on equipment" ON public.equipment FOR ALL USING (true);
CREATE POLICY "Allow authenticated read/write on clients" ON public.clients FOR ALL USING (true);
CREATE POLICY "Allow authenticated read/write on proposals" ON public.proposals FOR ALL USING (true);
CREATE POLICY "Allow authenticated read/write on contracts" ON public.contracts FOR ALL USING (true);
CREATE POLICY "Allow authenticated read/write on financial_records" ON public.financial_records FOR ALL USING (true);
CREATE POLICY "Allow authenticated read/write on service_orders" ON public.service_orders FOR ALL USING (true);

-- 11. STORAGE BUCKETS FOR PHOTOS & COMPROVANTES
INSERT INTO storage.buckets (id, name, public) 
VALUES ('delivery-photos', 'delivery-photos', true),
       ('equipment-images', 'equipment-images', true)
ON CONFLICT (id) DO NOTHING;

-- 12. SEED DATA DEMO FOR TESTING
INSERT INTO public.organizations (id, name, slug, trade_name, cnpj, primary_color, plan, status)
VALUES 
('a1b2c3d4-e5f6-7890-abcd-1234567890ab', 'TerraForte Máquinas & Equipamentos', 'terraforte', 'TerraForte Locações', '12.345.678/0001-90', '#0284c7', 'Enterprise', 'active'),
('b2c3d4e5-f6a7-8901-bcde-2345678901bc', 'LocaMáquinas Brasil', 'locamaquinas', 'LocaMáquinas SA', '98.765.432/0001-10', '#16a34a', 'Professional', 'active')
ON CONFLICT (id) DO NOTHING;

-- Seed SuperAdmin & Users
INSERT INTO public.profiles (id, organization_id, email, full_name, role, is_super_admin)
VALUES
('11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-1234567890ab', 'superadmin@locgest.com', 'Carlos Andrade (SuperAdmin)', 'Admin', TRUE),
('22222222-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-7890-abcd-1234567890ab', 'diretor@terraforte.com.br', 'Fernanda Lima (Diretora)', 'Diretor', FALSE),
('33333333-3333-3333-3333-333333333333', 'a1b2c3d4-e5f6-7890-abcd-1234567890ab', 'gestor@terraforte.com.br', 'Roberto Santos (Gestor)', 'Gestor', FALSE),
('44444444-4444-4444-4444-444444444444', 'a1b2c3d4-e5f6-7890-abcd-1234567890ab', 'entregador@terraforte.com.br', 'Marcos Silva (Entregador)', 'Entregador', FALSE)
ON CONFLICT (id) DO NOTHING;
