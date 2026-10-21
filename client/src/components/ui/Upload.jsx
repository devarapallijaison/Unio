import { useQuery } from '@tanstack/react-query';
import { Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { endpoints, uploadFile } from '../../services/api.js';
import { sha256Hex } from '../../lib/media.js';
import { Button } from './Button.jsx';

/** Upload limits and whether storage is set up. Cached for the session. */
export function useUploadConfig() {
  return useQuery({ queryKey: ['uploads', 'config'], queryFn: endpoints.uploads.config, staleTime: Infinity, retry: false });
}

const EXT = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/gif': 'GIF', 'video/mp4': 'MP4', 'video/webm': 'WebM', 'video/quicktime': 'MOV', 'application/pdf': 'PDF' };
const mb = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`;

/**
 * "Upload a file" button with a progress bar. It renders nothing when storage is not configured, so every
 * form keeps working with its link field alone. `onUploaded({ url, file, hash })` receives the saved file URL;
 * `hash` (sha256 hex) is only computed when `hash` is set, for the portfolio duplicate check.
 */
export function UploadButton({ purpose, label = 'Upload a file', onUploaded, hash = false, className = '' }) {
  const config = useUploadConfig().data;
  const input = useRef(null);
  const abort = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  const accepted = config?.enabled ? config.purposes?.[purpose] : null;
  if (!accepted) return null;

  const validate = (file) => {
    if (!accepted.includes(file.type)) return `That file type is not supported here. Use ${[...new Set(accepted.map((t) => EXT[t]))].join(', ')}.`;
    const max = file.type.startsWith('video/') ? config.maxVideoBytes : config.maxImageBytes;
    if (file.size > max) return `That file is ${mb(file.size)}. The limit here is ${mb(max)}.`;
    return '';
  };

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = validate(file);
    if (problem) return setError(problem);
    setError('');
    setProgress(0);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const [url, digest] = await Promise.all([
        uploadFile(file, purpose, { onProgress: setProgress, signal: controller.signal }),
        hash ? sha256Hex(file) : null,
      ]);
      await onUploaded?.({ url, file, hash: digest });
    } catch (err) {
      if (err.code !== 'ABORTED') setError(err.message || 'The upload did not finish. Try again, or paste a link instead.');
    } finally {
      setProgress(null);
      abort.current = null;
    }
  };

  const uploading = progress !== null;
  return (
    <div className={`space-y-1.5 ${className}`}>
      <input ref={input} type="file" accept={accepted.join(',')} onChange={onPick} className="sr-only" tabIndex={-1} aria-hidden />
      {uploading ? (
        <div className="flex items-center gap-2.5">
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="h-2 flex-1 overflow-hidden rounded-full bg-line"
          >
            <div className="h-full rounded-full bg-navy transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="w-10 text-right font-mono text-[11px] text-steel">{Math.round(progress * 100)}%</span>
          <button type="button" onClick={() => abort.current?.abort()} className="rounded-full p-1 text-steel hover:bg-soft hover:text-ink" aria-label="Cancel upload">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
          <Upload className="size-3.5" aria-hidden /> {label}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-[12.5px] font-medium text-att">
          {error}
        </p>
      )}
    </div>
  );
}
