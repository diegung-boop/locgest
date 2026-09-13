-- ==============================================================================
-- 05_bank_access_tokens_rollback.sql
-- SCRIPT DE ROLLBACK: REVERSÃO DA INFRAESTRUTURA DE ACCESS TOKENS
-- ==============================================================================
-- Finalidade:
-- Remove com segurança SOMENTE os objetos criados para o gerenciamento de
-- access_tokens, sem afetar organizações, integrações ou dados de contratos/clientes.
-- ==============================================================================

-- 1. Remoção das Funções RPC de Token
DROP FUNCTION IF EXISTS public.get_valid_bank_token(UUID, UUID, TEXT, INT);
DROP FUNCTION IF EXISTS public.acquire_bank_token_refresh_lease(UUID, UUID, TEXT, UUID, INT, INT);
DROP FUNCTION IF EXISTS public.complete_bank_token_refresh(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS public.fail_bank_token_refresh(UUID, UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.invalidate_bank_token(UUID, UUID, TEXT);

-- 2. Remoção da Tabela de Tokens
DROP TABLE IF EXISTS public.bank_access_tokens CASCADE;

-- 3. (Opcional) Reversão da Constraint Composta em tenant_bank_integrations
-- Mantida apenas se não houver outras dependências.
ALTER TABLE public.tenant_bank_integrations 
DROP CONSTRAINT IF EXISTS uq_tenant_bank_integrations_id_org;
