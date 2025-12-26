import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Storage bucket name for citations
export const CITATIONS_BUCKET = 'citations';

/**
 * Upload a PDF file to Supabase storage
 * @param file - The PDF file to upload
 * @param drugName - The drug name for organizing files
 * @returns The public URL of the uploaded file
 */
export async function uploadCitationPdf(
  file: File,
  drugName: string
): Promise<{ path: string; publicUrl: string }> {
  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `${drugName}/${fileName}`;

  const { data, error } = await supabase.storage
    .from(CITATIONS_BUCKET)
    .upload(filePath, file, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload PDF: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(CITATIONS_BUCKET)
    .getPublicUrl(filePath);

  return {
    path: data.path,
    publicUrl: urlData.publicUrl,
  };
}

/**
 * Delete a PDF file from Supabase storage
 * @param path - The path to the file in storage
 */
export async function deleteCitationPdf(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(CITATIONS_BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(`Failed to delete PDF: ${error.message}`);
  }
}

/**
 * Get a signed URL for a PDF (valid for 1 hour)
 * @param path - The path to the file in storage
 * @returns The signed URL
 */
export async function getSignedPdfUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CITATIONS_BUCKET)
    .createSignedUrl(path, 3600); // 1 hour

  if (error) {
    throw new Error(`Failed to get signed URL: ${error.message}`);
  }

  return data.signedUrl;
}
