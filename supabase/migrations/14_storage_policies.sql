-- Create the message-attachments bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload files
CREATE POLICY "authenticated users can upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments' AND
  auth.role() = 'authenticated'
);

-- Policy to allow authenticated users to read files
CREATE POLICY "authenticated users can read files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  auth.role() = 'authenticated'
);

-- Policy to allow users to delete their own files
CREATE POLICY "users can delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
); 