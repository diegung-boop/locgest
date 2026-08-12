-- LOCGEST SCHEMA MIGRATION: Move size_dimension column
-- FROM public.equipment_pricing TO public.equipment_catalog

-- 1. Add size_dimension column to equipment_catalog table
ALTER TABLE public.equipment_catalog ADD COLUMN IF NOT EXISTS size_dimension TEXT NOT NULL DEFAULT 'Padrão';

-- 2. Drop size_dimension column from equipment_pricing table
ALTER TABLE public.equipment_pricing DROP COLUMN IF EXISTS size_dimension;
