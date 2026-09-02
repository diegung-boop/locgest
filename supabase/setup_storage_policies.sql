-- Allow authenticated users to upload files only inside their organization's
-- folder: <organization_id>/<file-name>.
-- Public buckets continue to serve files publicly, while writes stay isolated.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('equipment-images', 'equipment-images', true),
  ('delivery-photos', 'delivery-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Tenant users upload organization images" ON storage.objects;
CREATE POLICY "Tenant users upload organization images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('equipment-images', 'delivery-photos')
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND (
        profiles.is_super_admin = true
        OR profiles.organization_id::text = (storage.foldername(name))[1]
      )
  )
);
