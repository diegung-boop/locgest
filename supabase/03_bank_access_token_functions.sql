-- ==============================================================================
-- 03_bank_access_token_functions.sql
-- MIGRATION: FUNÇÕES RPC ATÔMICAS PARA CICLO DE VIDA DO ACCESS TOKEN
-- ==============================================================================
-- Finalidade:
-- Implementa a lógica atômica de consulta, aquisição de lease, conclusão,
-- falha e invalidação de tokens bancários.
--
-- Características Técnicas:
-- 1. SECURITY DEFINER com search_path = public, pg_temp explícito (proteção contra search_path hijacking).
-- 2. Concorrência distribuída via Lease Persistente com TTL (sem advisory locks efêmeros).
-- 3. Prevenção de race conditions com validação estrita de refresh_owner na conclusão.
-- 4. Funções revogadas de PUBLIC/anon/authenticated e concedidas exclusivamente à service_role.
-- ==============================================================================

-- ==============================================================================
-- A) BUSCAR TOKEN REUTILIZÁVEL VÁLIDO
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_valid_bank_token(
    p_organization_id UUID,
    p_bank_integration_id UUID,
    p_environment TEXT,
    p_safety_margin_seconds INT DEFAULT 300
)
RETURNS TABLE (
    found BOOLEAN,
    access_token TEXT,
    token_type TEXT,
    scope TEXT,
    expires_at TIMESTAMPTZ,
    seconds_remaining INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_token RECORD;
    v_margin INTERVAL;
BEGIN
    -- Validação de entrada
    IF p_environment NOT IN ('sandbox', 'production') THEN
        RAISE EXCEPTION 'Ambiente inválido: %. Permitido: sandbox ou production.', p_environment;
    END IF;

    v_margin := (COALESCE(p_safety_margin_seconds, 300) || ' seconds')::INTERVAL;

    -- Busca token ativo com validade superior a NOW() + margem
    SELECT 
        bat.access_token,
        bat.token_type,
        bat.scope,
        bat.expires_at,
        EXTRACT(EPOCH FROM (bat.expires_at - NOW()))::INT AS seconds_remaining
    INTO v_token
    FROM public.bank_access_tokens bat
    WHERE bat.bank_integration_id = p_bank_integration_id
      AND bat.organization_id = p_organization_id
      AND bat.environment = p_environment
      AND bat.status = 'active'
      AND bat.access_token IS NOT NULL
      AND bat.expires_at > (NOW() + v_margin);

    IF FOUND THEN
        -- Atualiza last_used_at de forma atômica
        UPDATE public.bank_access_tokens
        SET last_used_at = NOW(),
            updated_at = NOW()
        WHERE bank_integration_id = p_bank_integration_id
          AND environment = p_environment;

        RETURN QUERY SELECT 
            true,
            v_token.access_token,
            v_token.token_type,
            v_token.scope,
            v_token.expires_at,
            v_token.seconds_remaining;
    ELSE
        RETURN QUERY SELECT 
            false,
            NULL::TEXT,
            NULL::TEXT,
            NULL::TEXT,
            NULL::TIMESTAMPTZ,
            0;
    END IF;
END;
$$;

-- ==============================================================================
-- B) ADQUIRIR DIREITO ATÔMICO DE RENOVAÇÃO (LEASE)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.acquire_bank_token_refresh_lease(
    p_organization_id UUID,
    p_bank_integration_id UUID,
    p_environment TEXT,
    p_owner_id UUID,
    p_lease_duration_seconds INT DEFAULT 30,
    p_safety_margin_seconds INT DEFAULT 300
)
RETURNS TABLE (
    lease_acquired BOOLEAN,
    existing_valid_token TEXT,
    existing_expires_at TIMESTAMPTZ,
    lock_until TIMESTAMPTZ,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_margin INTERVAL := (COALESCE(p_safety_margin_seconds, 300) || ' seconds')::INTERVAL;
    v_lease_duration INTERVAL := (COALESCE(p_lease_duration_seconds, 30) || ' seconds')::INTERVAL;
    v_lock_until TIMESTAMPTZ := v_now + v_lease_duration;
    v_token RECORD;
BEGIN
    -- Validação de entrada
    IF p_environment NOT IN ('sandbox', 'production') THEN
        RAISE EXCEPTION 'Ambiente inválido: %. Permitido: sandbox ou production.', p_environment;
    END IF;

    IF p_owner_id IS NULL THEN
        RAISE EXCEPTION 'p_owner_id não pode ser nulo.';
    END IF;

    -- Validar que a integração pertence à organização informada
    IF NOT EXISTS (
        SELECT 1 FROM public.tenant_bank_integrations 
        WHERE id = p_bank_integration_id AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'A integração % não pertence à organização %.', p_bank_integration_id, p_organization_id;
    END IF;

    -- 1. Verificar se já existe token válido em repouso (dupla checagem antes de alocar lease)
    SELECT 
        bat.access_token,
        bat.expires_at,
        bat.refresh_owner,
        bat.refresh_lock_until
    INTO v_token
    FROM public.bank_access_tokens bat
    WHERE bat.bank_integration_id = p_bank_integration_id
      AND bat.organization_id = p_organization_id
      AND bat.environment = p_environment
    FOR UPDATE; -- Row-lock atômico na linha durante a decisão

    -- Caso 1: Já existe token válido e ativo
    IF FOUND AND v_token.access_token IS NOT NULL AND v_token.expires_at > (v_now + v_margin) THEN
        RETURN QUERY SELECT 
            false,
            v_token.access_token,
            v_token.expires_at,
            NULL::TIMESTAMPTZ,
            'TOKEN_STILL_VALID';
        RETURN;
    END IF;

    -- Caso 2: Existe outro lease ativo não expirado
    IF FOUND AND v_token.refresh_lock_until IS NOT NULL AND v_token.refresh_lock_until > v_now AND v_token.refresh_owner <> p_owner_id THEN
        RETURN QUERY SELECT 
            false,
            NULL::TEXT,
            NULL::TIMESTAMPTZ,
            v_token.refresh_lock_until,
            'LEASE_HELD_BY_ANOTHER_WORKER';
        RETURN;
    END IF;

    -- Caso 3: Inserir novo registro de token com lease OU atualizar registro expirado
    INSERT INTO public.bank_access_tokens (
        organization_id,
        bank_integration_id,
        environment,
        status,
        refresh_owner,
        refresh_lock_until,
        updated_at
    )
    VALUES (
        p_organization_id,
        p_bank_integration_id,
        p_environment,
        'active',
        p_owner_id,
        v_lock_until,
        v_now
    )
    ON CONFLICT (bank_integration_id, environment)
    DO UPDATE SET
        refresh_owner = p_owner_id,
        refresh_lock_until = v_lock_until,
        updated_at = v_now;

    RETURN QUERY SELECT 
        true,
        NULL::TEXT,
        NULL::TIMESTAMPTZ,
        v_lock_until,
        'LEASE_ACQUIRED';
END;
$$;

-- ==============================================================================
-- C) FINALIZAR RENOVAÇÃO COM SUCESSO
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.complete_bank_token_refresh(
    p_organization_id UUID,
    p_bank_integration_id UUID,
    p_environment TEXT,
    p_owner_id UUID,
    p_access_token TEXT,
    p_token_type TEXT,
    p_scope TEXT,
    p_issued_at TIMESTAMPTZ,
    p_expires_in_seconds INT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_expires_at TIMESTAMPTZ;
    v_rows_updated INT;
BEGIN
    -- Validação de entrada
    IF p_access_token IS NULL OR TRIM(p_access_token) = '' THEN
        RAISE EXCEPTION 'access_token não pode ser vazio.';
    END IF;

    IF p_expires_in_seconds IS NULL OR p_expires_in_seconds <= 0 THEN
        RAISE EXCEPTION 'expires_in_seconds inválido: %', p_expires_in_seconds;
    END IF;

    v_expires_at := COALESCE(p_issued_at, NOW()) + (p_expires_in_seconds || ' seconds')::INTERVAL;

    -- Atualização estrita: apenas o dono atual do lease (refresh_owner) pode persistir o token
    UPDATE public.bank_access_tokens
    SET access_token = p_access_token,
        token_type = COALESCE(p_token_type, 'Bearer'),
        scope = COALESCE(p_scope, ''),
        issued_at = COALESCE(p_issued_at, NOW()),
        expires_at = v_expires_at,
        status = 'active',
        refresh_owner = NULL,
        refresh_lock_until = NULL,
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE bank_integration_id = p_bank_integration_id
      AND organization_id = p_organization_id
      AND environment = p_environment
      AND refresh_owner = p_owner_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated > 0 THEN
        RETURN QUERY SELECT true, 'TOKEN_PERSISTED_SUCCESSFULLY';
    ELSE
        -- O lease expirou e outro worker assumiu ou o owner_id diverge
        RETURN QUERY SELECT false, 'LEASE_LOST_OR_OWNER_MISMATCH';
    END IF;
END;
$$;

-- ==============================================================================
-- D) LIBERAR / FALHAR LEASE DE RENOVAÇÃO
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fail_bank_token_refresh(
    p_organization_id UUID,
    p_bank_integration_id UUID,
    p_environment TEXT,
    p_owner_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rows_updated INT;
BEGIN
    UPDATE public.bank_access_tokens
    SET refresh_owner = NULL,
        refresh_lock_until = NULL,
        updated_at = NOW()
    WHERE bank_integration_id = p_bank_integration_id
      AND organization_id = p_organization_id
      AND environment = p_environment
      AND refresh_owner = p_owner_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    RETURN (v_rows_updated > 0);
END;
$$;

-- ==============================================================================
-- E) INVALIDAR TOKEN (EX: RESPOSTA HTTP 401 DO BANCO INTER)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.invalidate_bank_token(
    p_organization_id UUID,
    p_bank_integration_id UUID,
    p_environment TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.bank_access_tokens
    SET status = 'revoked',
        access_token = NULL,
        refresh_owner = NULL,
        refresh_lock_until = NULL,
        updated_at = NOW()
    WHERE bank_integration_id = p_bank_integration_id
      AND organization_id = p_organization_id
      AND environment = p_environment;

    RETURN FOUND;
END;
$$;

-- ==============================================================================
-- SEGURANÇA E GRANTS DAS FUNÇÕES RPC
-- ==============================================================================
REVOKE ALL ON FUNCTION public.get_valid_bank_token(UUID, UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acquire_bank_token_refresh_lease(UUID, UUID, TEXT, UUID, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_bank_token_refresh(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_bank_token_refresh(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invalidate_bank_token(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_valid_bank_token(UUID, UUID, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_bank_token_refresh_lease(UUID, UUID, TEXT, UUID, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_bank_token_refresh(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_bank_token_refresh(UUID, UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.invalidate_bank_token(UUID, UUID, TEXT) TO service_role;
