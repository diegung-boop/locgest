-- ==============================================================================
-- MIGRAÇÃO DE SEGURANÇA: TABELA DE INTEGRAÇÕES BANCÁRIAS (BANCO INTER)
-- ==============================================================================
-- Esta tabela armazena credenciais e certificados mTLS de forma isolada por tenant.
-- Apenas usuários administradores da respectiva organização ou SuperAdmins
-- possuem permissão de leitura e alteração.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_bank_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
    bank_provider TEXT NOT NULL DEFAULT 'banco_inter',
    environment TEXT NOT NULL DEFAULT 'sandbox', -- 'sandbox' ou 'production'
    client_id TEXT NOT NULL DEFAULT '',
    client_secret TEXT NOT NULL DEFAULT '',
    account_number TEXT,
    pix_key TEXT,
    certificate_crt_content TEXT,
    certificate_key_content TEXT,
    certificate_crt_filename TEXT,
    certificate_key_filename TEXT,
    webhook_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.tenant_bank_integrations ENABLE ROW LEVEL SECURITY;

-- Política 1: Usuários autenticados só podem ler/escrever as credenciais da sua PRÓPRIA organização
DROP POLICY IF EXISTS "Tenant isolation for bank integrations" ON public.tenant_bank_integrations;

CREATE POLICY "Tenant isolation for bank integrations" 
ON public.tenant_bank_integrations
FOR ALL
TO authenticated
USING (
    organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
    )
)
WITH CHECK (
    organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
    )
);

-- Comentário para documentação do schema
COMMENT ON TABLE public.tenant_bank_integrations IS 'Armazena chaves de API, segredos OAuth e certificados mTLS de bancos parceiros isolados por organização.';
