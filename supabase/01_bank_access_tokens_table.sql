-- ==============================================================================
-- 01_bank_access_tokens_table.sql
-- MIGRATION: CRIAÇÃO DA TABELA DE TOKENS OAUTH2 (BANCO INTER)
-- ==============================================================================
-- Finalidade:
-- Armazena o access_token OAuth2 temporário emitido pelo Banco Inter por
-- integração bancária (tenant_bank_integrations) e ambiente (sandbox/production).
--
-- Garantias Estruturais:
-- 1. Composite Foreign Key: Garante que bank_integration_id pertença EXATAMENTE
--    ao organization_id informado, impedindo vínculo cruzado entre tenants.
-- 2. Unique Constraint: Apenas 1 registro de estado de token por (bank_integration_id, environment).
-- 3. Check Constraint: environment aceita estritamente 'sandbox' ou 'production'.
-- 4. Lease Persistente: refresh_owner + refresh_lock_until para evitar race condition.
-- ==============================================================================

-- 1. Garantir que tenant_bank_integrations possua UNIQUE(id, organization_id)
--    necessário para a chave estrangeira composta de integridade multi-tenant.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_tenant_bank_integrations_id_org'
    ) THEN
        ALTER TABLE public.tenant_bank_integrations 
        ADD CONSTRAINT uq_tenant_bank_integrations_id_org UNIQUE (id, organization_id);
    END IF;
END $$;

-- 2. Criação da Tabela bank_access_tokens
CREATE TABLE IF NOT EXISTS public.bank_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    bank_integration_id UUID NOT NULL,
    
    -- Ambiente: restrito estritamente a sandbox ou production
    environment TEXT NOT NULL,
    
    -- Metadados OAuth2 e Token Bearer
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    scope TEXT NOT NULL DEFAULT '',
    access_token TEXT, -- Preenchido após emissão bem-sucedida; NULL durante aquisição de lease inicial
    
    -- Controle de Expiração e Ciclo de Vida
    issued_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    
    -- Status do Token
    status TEXT NOT NULL DEFAULT 'active',
    
    -- Controle Distribuído de Concorrência (Lease Lock)
    refresh_owner UUID,
    refresh_lock_until TIMESTAMPTZ,
    
    -- Auditoria
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restrições de Integridade (Constraints)
    CONSTRAINT chk_bank_tokens_environment 
        CHECK (environment IN ('sandbox', 'production')),
        
    CONSTRAINT chk_bank_tokens_status 
        CHECK (status IN ('active', 'revoked')),

    -- Integridade Multi-Tenant Composta:
    -- Impede terminantemente que bank_integration_id seja associado a um organization_id diferente.
    CONSTRAINT fk_bank_access_tokens_integration_org 
        FOREIGN KEY (bank_integration_id, organization_id) 
        REFERENCES public.tenant_bank_integrations (id, organization_id) 
        ON DELETE CASCADE,

    -- Unicidade: Apenas 1 registro de token por integração e ambiente
    CONSTRAINT uq_bank_access_tokens_integration_env 
        UNIQUE (bank_integration_id, environment)
);

-- 3. Índices Estratégicos (Sem redundâncias)
-- O índice único uq_bank_access_tokens_integration_env já cobre buscas exatas por (bank_integration_id, environment).
-- Criamos índice parcial/composto para otimizar a checagem de expiração e status ativo:
CREATE INDEX IF NOT EXISTS idx_bank_access_tokens_active_lookup
ON public.bank_access_tokens (bank_integration_id, environment, status, expires_at)
WHERE status = 'active';

-- Índice para auditoria e queries por organização
CREATE INDEX IF NOT EXISTS idx_bank_access_tokens_org_id
ON public.bank_access_tokens (organization_id);

-- 4. Comentários para Documentação do Schema
COMMENT ON TABLE public.bank_access_tokens IS 'Armazena access_tokens OAuth2 temporários com controle de concorrência por lease para integrações bancárias.';
COMMENT ON COLUMN public.bank_access_tokens.bank_integration_id IS 'ID da conta/aplicação bancária proprietária do token.';
COMMENT ON COLUMN public.bank_access_tokens.organization_id IS 'ID do tenant proprietário (garantido por FK composta).';
COMMENT ON COLUMN public.bank_access_tokens.refresh_owner IS 'UUID do processo/Edge Function proprietário do lease de renovação.';
COMMENT ON COLUMN public.bank_access_tokens.refresh_lock_until IS 'Timestamp limite do lease. Após esse horário, outro processo pode assumir caso haja crash.';
