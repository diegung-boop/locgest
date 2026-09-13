-- ==============================================================================
-- 02_bank_access_tokens_security.sql
-- MIGRATION: POLÍTICAS DE SEGURANÇA, GRANTS E REVOKES EM PROFUNDIDADE
-- ==============================================================================
-- Finalidade:
-- Bloqueia categoricamente todo e qualquer acesso direto do frontend / PostgREST
-- à tabela public.bank_access_tokens.
--
-- Regras de Segurança:
-- 1. REVOKE total de anon e authenticated (sem SELECT, INSERT, UPDATE ou DELETE).
-- 2. ENABLE ROW LEVEL SECURITY ativado sem policies permissivas para público.
-- 3. GRANT estrito e exclusivo para o papel service_role (usado pelas Edge Functions).
-- ==============================================================================

-- 1. Habilitar Row Level Security (RLS)
ALTER TABLE public.bank_access_tokens ENABLE ROW LEVEL SECURITY;

-- 2. Revogação de Todos os Privilégios Públicos e de Usuários Normais
REVOKE ALL ON TABLE public.bank_access_tokens FROM PUBLIC;
REVOKE ALL ON TABLE public.bank_access_tokens FROM anon;
REVOKE ALL ON TABLE public.bank_access_tokens FROM authenticated;

-- 3. Concessão de Acesso Exclusivo à service_role (Backend / Edge Functions)
GRANT ALL ON TABLE public.bank_access_tokens TO service_role;

-- 4. Policy de Isolamento Estrito para service_role
DROP POLICY IF EXISTS "Service role exclusive access on bank_access_tokens" ON public.bank_access_tokens;

CREATE POLICY "Service role exclusive access on bank_access_tokens"
ON public.bank_access_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
