/** Where a media link can be played: a file the browser can play, a YouTube/Vimeo embed, or neither (open the link). */
const VIDEO_FILE = /\.(mp4|webm|mov)(\?|$)/i;
export const isVideoFile = (url) => VIDEO_FILE.test(url ?? '');

export function embedUrl(raw) {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host === 'youtube.com' && u.searchParams.get('v')) return `https://www.youtube-nocookie.com/embed/${u.searchParams.get('v')}`;
    if (host === 'vimeo.com' && /^\/\d+/.test(u.pathname)) return `https://player.vimeo.com/video/${u.pathname.split('/')[1]}`;
  } catch {
    /* not a playable link */
  }
  return null;
}
