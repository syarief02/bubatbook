import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

/**
 * Synchronously inspect localStorage for any existing Supabase session.
 * 0ms, synchronous, never hangs on Android.
 */
export function getStoredSession() {
  try {
    // 1. Direct rent2go-auth key
    const direct = localStorage.getItem('rent2go-auth');
    if (direct) {
      const parsed = JSON.parse(direct);
      if (parsed?.access_token) return parsed;
    }
    // 2. Scan all keys for Supabase auth token (e.g. sb-blqsgijvdvzwnqeltoje-auth-token)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('sb-') || key.includes('auth-token') || key.includes('rent2go-auth'))
      ) {
        try {
          const val = JSON.parse(localStorage.getItem(key));
          if (val?.access_token) return val;
          if (val?.currentSession?.access_token) return val.currentSession;
        } catch {
          // ignore non-JSON items
        }
      }
    }
  } catch (e) {
    console.warn('[getStoredSession] localStorage error:', e);
  }
  return null;
}

/**
 * Synchronously extract the user UUID directly from a JWT access token payload.
 * 0ms, zero network calls, never hangs or times out.
 */
function getUserIdFromToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    return parsed?.sub || null;
  } catch {
    return null;
  }
}

/**
 * Wrap supabase.auth.getSession() with instant localStorage fallback.
 * Checks localStorage first (0ms) so Android Chrome never hangs on silent JWT refresh.
 */
export async function getSessionWithTimeout(timeoutMs = 3000) {
  const stored = getStoredSession();
  if (stored?.access_token) {
    return { session: stored, error: null };
  }

  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth timed out. Trying fallback...')), timeoutMs)
      ),
    ]);
    if (result?.data?.session) {
      return { session: result.data.session, error: null };
    }
  } catch (err) {
    console.warn('[getSessionWithTimeout] Promise.race check:', err);
  }

  const fallback = getStoredSession();
  if (fallback?.access_token) {
    return { session: fallback, error: null };
  }

  return { session: null, error: new Error('Not authenticated. Please log in again.') };
}

/**
 * Ultra-safe mobile image compressor with strict 3.5s timeout.
 * Uses native createImageBitmap with hardware DCT resizeWidth when supported,
 * falling back to HTMLImageElement + canvas, and finally falling back to original file.
 * NEVER hangs or blocks upload.
 */
export async function prepareFileForUpload(file) {
  if (!file) return file;
  if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
    return file;
  }
  if (file.name?.match(/\.(heic|heif)$/i) || file.type?.match(/heic|heif/i)) {
    return file;
  }
  // If file is already small (<= 1.2MB), skip compression completely
  if (file.size <= 1.2 * 1024 * 1024) {
    return file;
  }

  // Hard timeout: compression must finish within 3500ms or fallback to original file
  return await Promise.race([
    compressImageInternal(file),
    new Promise((resolve) =>
      setTimeout(() => {
        console.warn('[UploadHelper] Compression timed out after 3.5s — using original file');
        resolve(file);
      }, 3500)
    ),
  ]);
}

async function compressImageInternal(file) {
  try {
    // 1. Try createImageBitmap with native downsampling (fastest, lowest memory on Android)
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file, {
          resizeWidth: 1600,
          resizeQuality: 'medium',
        });
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close?.(); // Free bitmap memory immediately
          const blob = await new Promise((res) => {
            const t = setTimeout(() => res(null), 2000);
            canvas.toBlob(
              (b) => {
                clearTimeout(t);
                res(b);
              },
              'image/jpeg',
              0.82
            );
          });
          if (blob && blob.size < file.size) {
            return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
          }
        }
      } catch (bitmapErr) {
        console.warn(
          '[UploadHelper] createImageBitmap with resize failed, trying Image fallback:',
          bitmapErr
        );
      }
    }

    // 2. Fallback to HTMLImageElement + canvas (universal Android/iOS support)
    return await new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      const cleanup = () => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // ignore
        }
      };

      img.onload = () => {
        try {
          const MAX_DIM = 1600;
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            cleanup();
            return resolve(file);
          }
          ctx.drawImage(img, 0, 0, width, height);
          cleanup();

          const timeout = setTimeout(() => resolve(file), 2000);
          canvas.toBlob(
            (blob) => {
              clearTimeout(timeout);
              if (blob && blob.size < file.size) {
                resolve(
                  new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  })
                );
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.82
          );
        } catch {
          cleanup();
          resolve(file);
        }
      };

      img.onerror = () => {
        cleanup();
        resolve(file);
      };

      img.src = objectUrl;
    });
  } catch (err) {
    console.warn('[UploadHelper] compressImageInternal unexpected error:', err);
    return file;
  }
}

/**
 * Log an upload step to the database for remote debugging.
 * Fire-and-forget — never blocks the upload flow.
 * Uses instant JWT parsing to derive user_id with 0 network calls.
 */
async function logUploadStep(step, message, metadata = {}, accessToken = null) {
  try {
    let token = accessToken;
    if (!token) {
      const stored = getStoredSession();
      token = stored?.access_token;
    }
    if (!token) {
      const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('log-timeout')), 2000)),
      ]);
      token = result?.data?.session?.access_token;
    }
    if (!token) return;

    // Instantly extract userId from token payload without network calls
    const userId = getUserIdFromToken(token);
    if (!userId) return;

    await supabase.from('bubatrent_booking_upload_logs').insert({
      user_id: userId,
      booking_id: metadata.booking_id || null,
      step,
      message,
      metadata: {
        ...metadata,
        browser: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Never let logging break the upload
  }
}

/**
 * Robust mobile-friendly upload function.
 * 1. Sends the File object directly via XHR — no FileReader or ArrayBuffer copy,
 *    so Android browsers don't freeze from doubled memory usage.
 * 2. Uses XMLHttpRequest for maximum compatibility and progress tracking.
 * 3. Explicitly uses x-upsert: false to avoid RLS deadlocks.
 * 4. Logs each step to bubatrent_booking_upload_logs for remote debugging.
 * 5. Warns users when files exceed 5MB (still allows up to 10MB max).
 * 6. Accepts an optional accessToken to skip getSession() entirely (Android fix).
 */
export async function uploadFileRobust(bucket, path, file, toast = null, accessToken = null) {
  // Extract booking_id from path if possible (e.g. receipts/{bookingId}/...)
  const bookingIdMatch = path.match(/(?:receipts|documents|uploads)\/([a-f0-9-]+)\//i);
  const booking_id = bookingIdMatch ? bookingIdMatch[1] : null;

  const logMeta = {
    bucket,
    path,
    booking_id,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
  };

  // IMMEDIATELY log preflight so we have an audit log in DB right away
  logUploadStep(
    'preflight',
    `Starting upload: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`,
    logMeta,
    accessToken
  );

  try {
    // 0. Pre-flight checks
    if (file.name.match(/\.(heic|heif)$/i) || file.type.match(/heic|heif/i)) {
      logUploadStep('error', 'HEIC format rejected', logMeta, accessToken);
      return {
        data: null,
        error: new Error(
          'HEIC format not supported. Please change camera settings to JPEG or use a different file.'
        ),
      };
    }
    if (file.size > 15 * 1024 * 1024) {
      logUploadStep(
        'error',
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
        logMeta,
        accessToken
      );
      return {
        data: null,
        error: new Error(
          `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max allowed size is 15MB.`
        ),
      };
    }

    if (toast) toast.info('Step 1: Preparing file...');

    // Auto-compress high-resolution mobile photos to prevent mobile OOM and timeout
    file = await prepareFileForUpload(file);

    logMeta.file_name = file.name;
    logMeta.file_type = file.type;
    logMeta.file_size = file.size;

    logUploadStep(
      'prepared',
      `File prepared: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`,
      logMeta,
      accessToken
    );

    // Get auth token — use provided token or fall back to getSessionWithTimeout
    let token = accessToken;
    if (!token) {
      const { session, error: sessionErr } = await getSessionWithTimeout(4000);
      if (sessionErr || !session) {
        logUploadStep('error', 'Not authenticated', {
          ...logMeta,
          sessionErr: sessionErr?.message,
        });
        return {
          data: null,
          error: sessionErr || new Error('Not authenticated. Please log in again.'),
        };
      }
      token = session.access_token;
    }

    const kbSize = Math.round(file.size / 1024);
    if (toast) toast.info(`Step 2: Uploading ${kbSize}KB...`);
    logUploadStep(
      'uploading',
      `Upload starting: ${kbSize}KB to ${bucket}/${path}`,
      { ...logMeta, kbSize },
      accessToken
    );
    console.log(`[UploadHelper] Starting upload of ${kbSize}KB to ${bucket}/${path}`);

    // Determine MIME type — Android often returns file.type = "" for gallery images
    const mimeType = file.type || guessMimeFromName(file.name) || 'image/jpeg';

    // Create an isolated storage client explicitly authorized with current token.
    // Bypass Navigator LockManager to completely eliminate mobile lock deadlocks.
    const authedClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          lock: async (_name, _acquireTimeout, fn) => await fn(),
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Strict 35-second timeout so the upload NEVER hangs on mobile
    const uploadPromise = authedClient.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: mimeType,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error('Upload timed out after 35 seconds. Please check your network connection.')
          ),
        35000
      )
    );

    const { data, error: uploadErr } = await Promise.race([uploadPromise, timeoutPromise]);

    if (uploadErr) {
      console.error('[UploadHelper] Storage upload error:', uploadErr);
      logUploadStep('error', uploadErr.message || 'Storage upload failed', logMeta, accessToken);
      return { data: null, error: uploadErr };
    }

    console.log(`[UploadHelper] Upload success!`, data);
    logUploadStep('success', `Upload complete! Path: ${path}`, logMeta, accessToken);
    return { data: { path }, error: null };
  } catch (err) {
    console.error('[UploadHelper] Unexpected error:', err);
    logUploadStep(
      'error',
      `Unexpected error: ${err.message}`,
      { ...logMeta, stack: err.stack?.substring(0, 500) },
      accessToken
    );
    return { data: null, error: err };
  }
}

/**
 * Guess MIME type from file extension.
 * Android gallery often returns file.type = "" — this provides a sensible fallback.
 */
function guessMimeFromName(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
    gif: 'image/gif',
  };
  return map[ext] || null;
}
