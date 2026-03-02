/**
 * Centralized storage configuration.
 * All file uploads/downloads MUST use this bucket constant
 * to prevent bucket name mismatches.
 */
import { supabase } from './supabase';

export const STORAGE_BUCKET = 'customer-documents';

/**
 * Get a public URL for a file in the storage bucket.
 * Returns null if path is empty/falsy.
 */
export function getDocumentUrl(filePath) {
    if (!filePath) return null;
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
    return data?.publicUrl || null;
}

/**
 * Generate a signed URL for a private file (expires in 1 hour).
 * Falls back to public URL if signing fails.
 */
export async function getSignedDocumentUrl(filePath, expiresIn = 3600) {
    if (!filePath) return null;
    const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(filePath, expiresIn);
    if (error) {
        console.error('[storage] Signed URL failed, falling back to public:', error.message);
        return getDocumentUrl(filePath);
    }
    return data?.signedUrl || null;
}

/**
 * Upload a file to the storage bucket.
 * @returns {string} The file path in storage
 */
export async function uploadDocument(filePath, file, options = {}) {
    console.log('[storage] Uploading to bucket:', STORAGE_BUCKET, 'path:', filePath);
    const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, options);
    if (error) {
        console.error('[storage] Upload failed:', error.message, 'bucket:', STORAGE_BUCKET);
        throw error;
    }
    console.log('[storage] Upload success:', filePath);
    return filePath;
}
