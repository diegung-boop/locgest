-- Table for duration-based pricing tier rules per equipment catalog model and organization
CREATE TABLE IF NOT EXISTS public.pricing_tier_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    catalog_id UUID NOT NULL REFERENCES public.equipment_catalog(id) ON DELETE CASCADE,
    min_months INT NOT NULL DEFAULT 1,
    max_months INT, -- NULL means infinity (e.g. 3+ months)
    monthly_rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    freight_delivery NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    freight_retrieval NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_terms_template TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast querying per tenant & catalog item
CREATE INDEX IF NOT EXISTS idx_pricing_tier_rules_org_catalog ON public.pricing_tier_rules(organization_id, catalog_id);

-- Enable RLS
ALTER TABLE public.pricing_tier_rules ENABLE ROW LEVEL SECURITY;

-- Permissive policy for authenticated/anon operational usage
CREATE POLICY "Public full access to pricing_tier_rules" ON public.pricing_tier_rules FOR ALL USING (true) WITH CHECK (true);
