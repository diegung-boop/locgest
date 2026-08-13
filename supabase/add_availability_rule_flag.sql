-- ALTER TABLE organizations to add an opt-in/opt-out flag for the
-- equipment-availability rule applied when creating commercial proposals.
-- Default TRUE preserves current behavior (rule enforced) for all existing orgs.
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS require_equipment_availability BOOLEAN NOT NULL DEFAULT true;
