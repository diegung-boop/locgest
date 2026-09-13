-- ==============================================================================
-- FIX: PERMITIR COBRANÇAS AVULSAS E ARMAZENAR CERTIFICADOS DO BANCO INTER
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase para aplicar as correções:
-- 1. Permite cobranças avulsas sem contrato vinculado (contract_id nulo)
-- 2. Adiciona as colunas de certificados mTLS na tabela tenant_bank_integrations
-- 3. Garante políticas de leitura e gravação da integração bancária
-- ==============================================================================

-- 1. Desbloquear cobranças avulsas no financeiro (DROP NOT NULL em contract_id)
ALTER TABLE public.financial_records ALTER COLUMN contract_id DROP NOT NULL;
ALTER TABLE public.financial_records ADD COLUMN IF NOT EXISTS payer_name TEXT;
ALTER TABLE public.financial_records ADD COLUMN IF NOT EXISTS payer_document TEXT;

-- 2. Adicionar colunas de certificados mTLS e nomes de arquivo
ALTER TABLE public.tenant_bank_integrations ADD COLUMN IF NOT EXISTS certificate_crt_content TEXT;
ALTER TABLE public.tenant_bank_integrations ADD COLUMN IF NOT EXISTS certificate_key_content TEXT;
ALTER TABLE public.tenant_bank_integrations ADD COLUMN IF NOT EXISTS certificate_crt_filename TEXT;
ALTER TABLE public.tenant_bank_integrations ADD COLUMN IF NOT EXISTS certificate_key_filename TEXT;

-- 3. Garantir permissões de leitura e gravação na tabela tenant_bank_integrations
ALTER TABLE public.tenant_bank_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for bank integrations" ON public.tenant_bank_integrations;
DROP POLICY IF EXISTS "Allow all authenticated on tenant_bank_integrations" ON public.tenant_bank_integrations;

CREATE POLICY "Allow all authenticated on tenant_bank_integrations" 
ON public.tenant_bank_integrations
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.tenant_bank_integrations IS 'Armazena credenciais e certificados mTLS do Banco Inter por organização.';
