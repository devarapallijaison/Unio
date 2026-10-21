/** Browser-side helpers for uploads (guide §8, F5). Nothing here talks to the server. */

const HASH_LIMIT = 100 * 1024 * 1024;

/** sha256 of a file as hex, for the duplicate check. Very large files are skipped (returns null). */
export async function sha256Hex(file) {
  if (!globalThis.crypto?.subtle || file.size > HASH_LIMIT) return null;
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/** A still from a video file (at ~1 s) as a JPEG File, to use as its thumbnail. Resolves null if the browser cannot decode it. */
export function captureVideoFrame(file, atSec = 1) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (result) => {
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const timer = setTimeout(() => done(null), 10_000);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.onerror = () => done(null);
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(atSec, (video.duration || atSec * 2) / 2);
    };
    video.onseeked = () => {
      try {
        const scale = Math.min(1, 960 / (video.videoWidth || 960));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((video.videoWidth || 960) * scale));
        canvas.height = Math.max(1, Math.round((video.videoHeight || 540) * scale));
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => done(blob ? new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.85);
      } catch {
        done(null);
      }
    };
    video.src = url;
  });
}
