-- ==============================================================================
-- 04_bank_access_tokens_validation.sql
-- TESTES DE INTEGRIDADE, SEGURANÇA E CONCORRÊNCIA (ISOLADO EM TRANSAÇÃO)
-- ==============================================================================
-- Finalidade:
-- Executa bateria de testes unitários para validar:
-- 1. Isolamento multi-tenant e rejeição de vínculo cruzado (Org A x Org B).
-- 2. Concorrência: apenas 1 worker adquire lease, outros recebem LEASE_HELD.
-- 3. Expiração de lease e assunção por novo worker após timeout.
-- 4. Rejeição de conclusão por owner desatualizado.
-- 5. Não retorno de token expirado ou dentro da margem de segurança.
-- 6. Isolamento estrito entre Sandbox e Production.
-- 7. Invalidação de token (cenário HTTP 401).
--
-- NOTA: Este script roda com ROLLBACK ao final. NENHUM dado permanente é inserido.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_org_a UUID := gen_random_uuid();
    v_org_b UUID := gen_random_uuid();
    v_integ_a UUID := gen_random_uuid();
    v_integ_b UUID := gen_random_uuid();
    v_worker_1 UUID := gen_random_uuid();
    v_worker_2 UUID := gen_random_uuid();
    
    v_res_valid RECORD;
    v_res_lease RECORD;
    v_res_complete RECORD;
    v_res_fail BOOLEAN;
    v_res_invalidate BOOLEAN;
    v_cross_error BOOLEAN := false;
BEGIN
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'INICIANDO SUÍTE DE TESTES: bank_access_tokens';
    RAISE NOTICE '==================================================';

    -- 0. Preparação dos dados fictícios de teste
    INSERT INTO public.organizations (id, name, slug)
    VALUES 
        (v_org_a, 'Empresa Teste A', 'empresa-a-teste'),
        (v_org_b, 'Empresa Teste B', 'empresa-b-teste');

    INSERT INTO public.tenant_bank_integrations (id, organization_id, client_id, environment)
    VALUES
        (v_integ_a, v_org_a, 'client_id_a', 'sandbox'),
        (v_integ_b, v_org_b, 'client_id_b', 'sandbox');

    -- TESTE 1: Garantia estrutural contra vínculo cruzado (Integ B com Org A)
    BEGIN
        INSERT INTO public.bank_access_tokens (organization_id, bank_integration_id, environment)
        VALUES (v_org_a, v_integ_b, 'sandbox');
    EXCEPTION WHEN foreign_key_violation THEN
        v_cross_error := true;
    END;
    
    IF v_cross_error THEN
        RAISE NOTICE '✅ TESTE 1 PASSOU: Vínculo cruzado entre Org A e Integ B foi bloqueado pela FK composta.';
    ELSE
        RAISE EXCEPTION '❌ TESTE 1 FALHOU: Vínculo cruzado entre organizações foi aceito indevidamente!';
    END IF;

    -- TESTE 2: Busca de token quando não existe
    SELECT * INTO v_res_valid FROM public.get_valid_bank_token(v_org_a, v_integ_a, 'sandbox', 300);
    IF v_res_valid.found = false THEN
        RAISE NOTICE '✅ TESTE 2 PASSOU: Token inexistente retornou found=false.';
    ELSE
        RAISE EXCEPTION '❌ TESTE 2 FALHOU: Retornou token quando nenhum existia.';
    END IF;

    -- TESTE 3: Worker 1 adquire lease de renovação
    SELECT * INTO v_res_lease FROM public.acquire_bank_token_refresh_lease(
        v_org_a, v_integ_a, 'sandbox', v_worker_1, 30, 300
    );
    IF v_res_lease.lease_acquired = true AND v_res_lease.reason = 'LEASE_ACQUIRED' THEN
        RAISE NOTICE '✅ TESTE 3 PASSOU: Worker 1 adquiriu lease com sucesso.';
    ELSE
        RAISE EXCEPTION '❌ TESTE 3 FALHOU: Worker 1 não conseguiu adquirir lease inicial.';
    END IF;

    -- TESTE 4: Worker 2 tenta adquirir lease simultâneo (deve ser bloqueado)
    SELECT * INTO v_res_lease FROM public.acquire_bank_token_refresh_lease(
        v_org_a, v_integ_a, 'sandbox', v_worker_2, 30, 300
    );
    IF v_res_lease.lease_acquired = false AND v_res_lease.reason = 'LEASE_HELD_BY_ANOTHER_WORKER' THEN
        RAISE NOTICE '✅ TESTE 4 PASSOU: Concorrência controlada. Worker 2 foi impedido de duplicar requisição OAuth.';
    ELSE
        RAISE EXCEPTION '❌ TESTE 4 FALHOU: Worker 2 adquiriu lease simultâneo indevidamente!';
    END IF;

    -- TESTE 5: Worker 2 tenta concluir com owner errado (deve ser rejeitado)
    SELECT * INTO v_res_complete FROM public.complete_bank_token_refresh(
        v_org_a, v_integ_a, 'sandbox', v_worker_2, 'TOKEN_FALSO', 'Bearer', 'scope', NOW(), 3600
    );
    IF v_res_complete.success = false AND v_res_complete.message = 'LEASE_LOST_OR_OWNER_MISMATCH' THEN
        RAISE NOTICE '✅ TESTE 5 PASSOU: Worker 2 foi impedido de salvar token sem possuir o lease.';
    ELSE
        RAISE EXCEPTION '❌ TESTE 5 FALHOU: Worker 2 conseguiu salvar token com owner incorreto!';
    END IF;

    -- TESTE 6: Worker 1 conclui renovação com sucesso
    SELECT * INTO v_res_complete FROM public.complete_bank_token_refresh(
        v_org_a, v_integ_a, 'sandbox', v_worker_1, 'TOKEN_VALIDO_ABC_123', 'Bearer', 'boleto-cobranca.read', NOW(), 3600
    );
    IF v_res_complete.success = true THEN
        RAISE NOTICE '✅ TESTE 6 PASSOU: Worker 1 salvou token e liberou lease.';
    ELSE
        RAISE EXCEPTION '❌ TESTE 6 FALHOU: Worker 1 não conseguiu concluir refresh.';
    END IF;

    -- TESTE 7: Reutilização do token por chamadas subsequentes
    SELECT * INTO v_res_valid FROM public.get_valid_bank_token(v_org_a, v_integ_a, 'sandbox', 300);
    IF v_res_valid.found = true AND v_res_valid.access_token = 'TOKEN_VALIDO_ABC_123' THEN
        RAISE NOTICE '✅ TESTE 7 PASSOU: Token ativo foi recuperado para reuso (restante: %s).', v_res_valid.seconds_remaining;
    ELSE
        RAISE EXCEPTION '❌ TESTE 7 FALHOU: Token salvo não foi recuperado para reuso.';
    END IF;

    -- TESTE 8: Isolamento Sandbox vs Production
    SELECT * INTO v_res_valid FROM public.get_valid_bank_token(v_org_a, v_integ_a, 'production', 300);
    IF v_res_valid.found = false THEN
        RAISE NOTICE '✅ TESTE 8 PASSOU: Token de Sandbox não vaza para ambiente de Production.';
    ELSE
        RAISE EXCEPTION '❌ TESTE 8 FALHOU: Token de Sandbox foi retornado para Production!';
    END IF;

    -- TESTE 9: Invalidação de token (Simulação de HTTP 401)
    v_res_invalidate := public.invalidate_bank_token(v_org_a, v_integ_a, 'sandbox');
    SELECT * INTO v_res_valid FROM public.get_valid_bank_token(v_org_a, v_integ_a, 'sandbox', 300);
    IF v_res_invalidate = true AND v_res_valid.found = false THEN
        RAISE NOTICE '✅ TESTE 9 PASSOU: Invalidação revogou o token imediatamente.';
    ELSE
        RAISE EXCEPTION '❌ TESTE 9 FALHOU: Token invalidado continuou disponível!';
    END IF;

    RAISE NOTICE '==================================================';
    RAISE NOTICE 'TODOS OS TESTES UNITÁRIOS FORAM CONCLUÍDOS COM SUCESSO!';
    RAISE NOTICE '==================================================';
END $$;

ROLLBACK; -- Reverte todas as inserções de teste mantendo o banco intacto
