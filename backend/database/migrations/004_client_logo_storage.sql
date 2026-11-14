-- Migration 004: Client Logo Storage

-- Create a public bucket for client brand logos.
INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'client-logos',
    'client-logos',
    true,
    2097152,
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id)
DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY[
        'image/png',
        'image/jpeg',
        'image/webp'
    ];

-- Only Admin users can upload logos.
DROP POLICY IF EXISTS "Admins can upload client logos"
ON storage.objects;

CREATE POLICY "Admins can upload client logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'client-logos'
    AND public.current_user_role() = 'admin'
);

-- Only Admin users can update logos.
DROP POLICY IF EXISTS "Admins can update client logos"
ON storage.objects;

CREATE POLICY "Admins can update client logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'client-logos'
    AND public.current_user_role() = 'admin'
)
WITH CHECK (
    bucket_id = 'client-logos'
    AND public.current_user_role() = 'admin'
);

-- Only Admin users can delete logos.
DROP POLICY IF EXISTS "Admins can delete client logos"
ON storage.objects;

CREATE POLICY "Admins can delete client logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'client-logos'
    AND public.current_user_role() = 'admin'
);