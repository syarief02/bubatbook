import { supabase } from './supabase';

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
 * Fire-and-forget — never blocks or breaks the upload flow.
 */
async function logUploadStep(step, message, metadata = {}) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
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
 * Mobile-friendly upload:
 * 1. Rejects HEIC and oversized files up front with a clear message.
 * 2. Compresses large photos so phones don't run out of memory.
 * 3. Falls back to a MIME type from the extension (Android often reports "").
 * 4. Times out after 35s instead of hanging on a bad connection.
 * 5. Logs each step to bubatrent_booking_upload_logs for remote debugging.
 */
export async function uploadFileRobust(bucket, path, file, toast = null) {
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

  logUploadStep(
    'preflight',
    `Starting upload: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`,
    logMeta
  );

  try {
    if (file.name.match(/\.(heic|heif)$/i) || file.type.match(/heic|heif/i)) {
      logUploadStep('error', 'HEIC format rejected', logMeta);
      return {
        data: null,
        error: new Error(
          'HEIC format not supported. Please change camera settings to JPEG or use a different file.'
        ),
      };
    }
    if (file.size > 15 * 1024 * 1024) {
      logUploadStep('error', `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB`, logMeta);
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
      logMeta
    );

    const kbSize = Math.round(file.size / 1024);
    if (toast) toast.info(`Step 2: Uploading ${kbSize}KB...`);
    logUploadStep('uploading', `Upload starting: ${kbSize}KB to ${bucket}/${path}`, {
      ...logMeta,
      kbSize,
    });

    // Android gallery often returns file.type = "" — fall back to the extension
    const mimeType = file.type || guessMimeFromName(file.name) || 'image/jpeg';

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () =>
          reject(
            new Error('Upload timed out after 35 seconds. Please check your network connection.')
          ),
        35000
      );
    });
    const uploadPromise = supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: mimeType,
    });

    let uploadErr;
    try {
      ({ error: uploadErr } = await Promise.race([uploadPromise, timeoutPromise]));
    } finally {
      clearTimeout(timeoutId);
    }

    if (uploadErr) {
      console.error('[UploadHelper] Storage upload error:', uploadErr);
      logUploadStep('error', uploadErr.message || 'Storage upload failed', logMeta);
      return { data: null, error: uploadErr };
    }

    logUploadStep('success', `Upload complete! Path: ${path}`, logMeta);
    return { data: { path }, error: null };
  } catch (err) {
    console.error('[UploadHelper] Unexpected error:', err);
    logUploadStep('error', `Unexpected error: ${err.message}`, {
      ...logMeta,
      stack: err.stack?.substring(0, 500),
    });
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
