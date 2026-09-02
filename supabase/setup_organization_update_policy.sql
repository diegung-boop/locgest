-- Allow authenticated users to read their organization and allow company
-- settings updates only for authorized roles in that same organization.
-- SuperAdmins may manage any organization.

GRANT SELECT, UPDATE ON public.organizations TO authenticated;

DROP POLICY IF EXISTS "Tenant members can read their organization" ON public.organizations;
CREATE POLICY "Tenant members can read their organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND (
        profiles.is_super_admin = true
        OR profiles.organization_id = organizations.id
      )
  )
);

DROP POLICY IF EXISTS "Tenant managers can update their organization" ON public.organizations;
CREATE POLICY "Tenant managers can update their organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND (
        profiles.is_super_admin = true
        OR (
          profiles.organization_id = organizations.id
          AND profiles.role IN ('Admin', 'Diretor', 'Gestor')
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND (
        profiles.is_super_admin = true
        OR (
          profiles.organization_id = organizations.id
          AND profiles.role IN ('Admin', 'Diretor', 'Gestor')
        )
      )
  )
);
