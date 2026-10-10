/**
 * Centralized storage configuration.
 * All file uploads/downloads MUST use this bucket constant
 * to prevent bucket name mismatches.
 */
import { supabase } from './supabase';

export const STORAGE_BUCKET = 'customer-documents';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Generate a signed URL for a private file (expires in 1 hour).
 * The bucket holds IC, licence and receipt images, so it is private:
 * only the uploader and admins can sign URLs for a file.
 */
export async function getSignedDocumentUrl(filePath, expiresIn = SIGNED_URL_TTL_SECONDS) {
  if (!filePath) return null;
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}
