import { supabase } from './supabase';

/**
 * Wrap supabase.auth.getSession() with a hard timeout.
 * On Android Chrome, the silent JWT refresh can hang indefinitely —
 * this ensures we always resolve or reject within `timeoutMs`.
 */
export async function getSessionWithTimeout(timeoutMs = 8000) {
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Auth timed out. Please refresh the page and try again.')),
          timeoutMs
        )
      ),
    ]);
    return { session: result?.data?.session ?? null, error: result?.error ?? null };
  } catch (err) {
    return { session: null, error: err };
  }
}

/**
 * Log an upload step to the database for remote debugging.
 * Fire-and-forget — never blocks the upload flow.
 * Uses a 3-second timeout on getSession() to avoid hanging on Android.
 */
async function logUploadStep(step, message, metadata = {}, accessToken = null) {
  try {
    let token = accessToken;
    if (!token) {
      const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('log-timeout')), 3000)),
      ]);
      token = result?.data?.session?.access_token;
    }
    if (!token) return;

    // We still need the user_id for the log entry — derive from the session
    // If we only have a token (passed in), do a quick getUser or just get the session data
    let userId = null;
    if (accessToken) {
      // Token was passed in — try to get user id from current session cache
      // (this won't trigger a refresh since we already have a valid token)
      try {
        const {
          data: { session: cachedSession },
        } = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('log-uid-timeout')), 2000)),
        ]);
        userId = cachedSession?.user?.id;
      } catch {
        // Can't get user_id — skip logging
        return;
      }
    } else {
      // We got the session from the getSession call above — re-extract user_id
      try {
        const result2 = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('log-uid-timeout')), 2000)),
        ]);
        userId = result2?.data?.session?.user?.id;
      } catch {
        return;
      }
    }
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

  try {
    if (toast) toast.info('Step 1: Preparing file...');
    logUploadStep(
      'preflight',
      `Starting upload: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`,
      logMeta,
      accessToken
    );

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
    if (file.size > 10 * 1024 * 1024) {
      logUploadStep(
        'error',
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
        logMeta,
        accessToken
      );
      return {
        data: null,
        error: new Error(
          `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max allowed size is 10MB.`
        ),
      };
    }

    // Get auth token — use provided token or fall back to getSessionWithTimeout
    let token = accessToken;
    if (!token) {
      const { session, error: sessionErr } = await getSessionWithTimeout(8000);
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

    // Warn user about large files (> 5MB) — they still upload but may be slow on mobile
    if (file.size > 5 * 1024 * 1024 && toast) {
      toast.warn(
        `Large file (${(file.size / 1024 / 1024).toFixed(1)}MB) — upload may take a moment on mobile.`
      );
    }

    const kbSize = Math.round(file.size / 1024);
    if (toast) toast.info(`Step 2: Uploading ${kbSize}KB...`);
    logUploadStep(
      'uploading',
      `XHR upload starting: ${kbSize}KB to ${bucket}/${path}`,
      { ...logMeta, kbSize },
      accessToken
    );
    console.log(`[UploadHelper] Starting upload of ${kbSize}KB to ${bucket}/${path}`);

    // Determine MIME type — Android often returns file.type = "" for gallery images
    const mimeType = file.type || guessMimeFromName(file.name) || 'application/octet-stream';

    const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_ANON_KEY);
      xhr.setRequestHeader('Content-Type', mimeType);
      xhr.setRequestHeader('x-upsert', 'false');

      xhr.timeout = 90000;

      if (toast) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            if (percent === 50 || percent === 100) {
              console.log(`[UploadHelper] Progress: ${percent}%`);
              if (percent === 50) {
                toast.info(`Uploading: 50%...`);
                logUploadStep('progress', 'Upload 50%', { ...logMeta, percent }, accessToken);
              }
            }
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log(`[UploadHelper] Upload success! HTTP ${xhr.status}`);
          logUploadStep(
            'success',
            `Upload complete! HTTP ${xhr.status}`,
            { ...logMeta, httpStatus: xhr.status },
            accessToken
          );
          resolve({ data: { path }, error: null });
        } else {
          console.error(`[UploadHelper] Upload error: HTTP ${xhr.status}`, xhr.responseText);
          let errMsg;
          try {
            const errBody = JSON.parse(xhr.responseText);
            errMsg = `Upload failed (HTTP ${xhr.status}): ${errBody.message || errBody.error}`;
          } catch {
            errMsg = `Upload failed (HTTP ${xhr.status}): ${xhr.statusText}`;
          }
          logUploadStep(
            'error',
            errMsg,
            { ...logMeta, httpStatus: xhr.status, response: xhr.responseText?.substring(0, 500) },
            accessToken
          );
          resolve({ data: null, error: new Error(errMsg) });
        }
      };

      xhr.onerror = () => {
        console.error('[UploadHelper] XHR network error.');
        logUploadStep(
          'network_error',
          'XHR network error — connection lost or CORS issue',
          logMeta,
          accessToken
        );
        resolve({ data: null, error: new Error('Network error during upload. Check connection.') });
      };

      xhr.ontimeout = () => {
        console.error('[UploadHelper] XHR timeout after 90s.');
        logUploadStep('timeout', 'XHR timed out after 90 seconds', logMeta, accessToken);
        resolve({
          data: null,
          error: new Error('Upload timed out after 90s. Please check your network connection.'),
        });
      };

      xhr.send(file);
    });
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
