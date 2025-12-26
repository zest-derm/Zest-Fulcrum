-- Supabase Storage Setup for Citations Bucket
-- Option 1: Create bucket via SQL (do this first)

-- Create the citations bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('citations', 'citations', true)
ON CONFLICT (id) DO NOTHING;

-- Option 2: Or create via UI (easier)
-- Go to Storage → New bucket → Name: "citations" → Public: Yes

-- Then run these policies (works for either option):

-- Policy 1: Allow public read access to PDFs
CREATE POLICY "Public read access for citations"
ON storage.objects
FOR SELECT
USING (bucket_id = 'citations');

-- Policy 2: Allow authenticated users to upload PDFs
CREATE POLICY "Authenticated users can upload citations"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'citations');

-- Policy 3: Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete citations"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'citations');

-- Policy 4: Allow authenticated users to update citations
CREATE POLICY "Authenticated users can update citations"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'citations');

-- Verify policies were created
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%citations%';
