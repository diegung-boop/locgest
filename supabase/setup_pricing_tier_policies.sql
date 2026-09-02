-- Tenant-safe access for multiple pricing ranges per catalog model.

BEGIN;

CREATE TABLE IF NOT EXISTS public.pricing_tier_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  catalog_id UUID NOT NULL
    REFERENCES public.equipment_catalog(id) ON DELETE CASCADE,
  min_months INTEGER NOT NULL DEFAULT 1 CHECK (min_months >= 1),
  max_months INTEGER CHECK (max_months IS NULL OR max_months >= min_months),
  monthly_rate NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_rate >= 0),
  freight_delivery NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (freight_delivery >= 0),
  freight_retrieval NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (freight_retrieval >= 0),
  payment_terms_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_tier_rules_org_catalog
ON public.pricing_tier_rules (organization_id, catalog_id, min_months);

ALTER TABLE public.pricing_tier_rules ENABLE ROW LEVEL SECURITY;

-- Remove the legacy policy that allowed every role to access every tenant.
DROP POLICY IF EXISTS "Public full access to pricing_tier_rules" ON public.pricing_tier_rules;

-- Pricing is an authenticated application feature.
REVOKE ALL ON public.pricing_tier_rules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_tier_rules TO authenticated;

DROP POLICY IF EXISTS "Tenant members can read pricing tiers" ON public.pricing_tier_rules;
CREATE POLICY "Tenant members can read pricing tiers"
ON public.pricing_tier_rules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND (
        profiles.is_super_admin = true
        OR profiles.organization_id = pricing_tier_rules.organization_id
      )
  )
);

DROP POLICY IF EXISTS "Tenant managers can insert pricing tiers" ON public.pricing_tier_rules;
CREATE POLICY "Tenant managers can insert pricing tiers"
ON public.pricing_tier_rules
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND (
        profiles.is_super_admin = true
        OR (
          profiles.organization_id = pricing_tier_rules.organization_id
          AND profiles.role IN ('Admin', 'Diretor', 'Gestor')
          AND EXISTS (
            SELECT 1 FROM public.equipment_catalog
            WHERE equipment_catalog.id = pricing_tier_rules.catalog_id
              AND equipment_catalog.organization_id = pricing_tier_rules.organization_id
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "Tenant managers can update pricing tiers" ON public.pricing_tier_rules;
CREATE POLICY "Tenant managers can update pricing tiers"
ON public.pricing_tier_rules
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND (
        profiles.is_super_admin = true
        OR (
          profiles.organization_id = pricing_tier_rules.organization_id
          AND profiles.role IN ('Admin', 'Diretor', 'Gestor')
          AND EXISTS (
            SELECT 1 FROM public.equipment_catalog
            WHERE equipment_catalog.id = pricing_tier_rules.catalog_id
              AND equipment_catalog.organization_id = pricing_tier_rules.organization_id
          )
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND (
        profiles.is_super_admin = true
        OR (
          profiles.organization_id = pricing_tier_rules.organization_id
          AND profiles.role IN ('Admin', 'Diretor', 'Gestor')
          AND EXISTS (
            SELECT 1 FROM public.equipment_catalog
            WHERE equipment_catalog.id = pricing_tier_rules.catalog_id
              AND equipment_catalog.organization_id = pricing_tier_rules.organization_id
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "Tenant managers can delete pricing tiers" ON public.pricing_tier_rules;
CREATE POLICY "Tenant managers can delete pricing tiers"
ON public.pricing_tier_rules
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND (
        profiles.is_super_admin = true
        OR (
          profiles.organization_id = pricing_tier_rules.organization_id
          AND profiles.role IN ('Admin', 'Diretor', 'Gestor')
        )
      )
  )
);

COMMIT;
