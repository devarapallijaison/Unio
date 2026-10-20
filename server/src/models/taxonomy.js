/**
 * Controlled lists (guide §5.1). IDs are stable slugs stored in the database; labels are display text.
 * Creators, brands and briefs pick from these lists — no free text — so filters and matching stay reliable.
 * Served to the client at GET /api/taxonomy.
 */

const list = (pairs) => pairs.map(([id, label, description]) => (description ? { id, label, description } : { id, label }));

export const CATEGORIES = list([
  ['filmmaker', 'AI Filmmakers', 'Short films, brand films, story-led ads'],
  ['video', 'AI Video Creators', 'Reels, product videos, text/image-to-video'],
  ['animator', 'AI Animators', 'Characters, 2D/3D animation, explainers'],
  ['graphic', 'AI Graphic Designers', 'Posters, social creatives, brand visuals'],
  ['thumb', 'AI Thumbnail Designers', 'YouTube & podcast thumbnails, covers'],
  ['photo', 'AI Product Photographers', 'Product, lifestyle and food stills'],
  ['ugc', 'UGC & AI Avatar Creators', 'Talking-head ads, AI presenters'],
  ['3d', 'AI 3D Artists', '3D renders, product spins, CGI'],
  ['motion', 'AI Motion Designers', 'Motion graphics, kinetic type'],
  ['music', 'AI Music Video Artists', 'Visualisers, lyric & music videos'],
  ['voice', 'AI Voice & Audio', 'Voice-overs, dubbing, jingles'],
  ['illus', 'AI Illustrators', 'Illustration, comics, storybooks'],
]);

export const CONTENT_TYPES = list([
  ['short', 'Short-form video (Reels/Shorts)'],
  ['long', 'Long-form / film'],
  ['ad', 'Video ad'],
  ['ugcv', 'UGC / testimonial'],
  ['avatar', 'AI avatar / presenter'],
  ['anim', 'Animation'],
  ['static', 'Social post / graphic'],
  ['thumb', 'Thumbnail / cover art'],
  ['poster', 'Poster / print'],
  ['photo', 'Product photos'],
  ['render3d', '3D render / spin'],
  ['motion', 'Motion graphics'],
  ['musicvid', 'Music video'],
  ['audio', 'Voice-over / audio'],
]);

export const SPECIALIZATIONS = list([
  ['beauty', 'Beauty & skincare'],
  ['food', 'Food & beverage'],
  ['fashion', 'Fashion'],
  ['d2c', 'D2C / e-commerce'],
  ['tech', 'Tech & SaaS'],
  ['finance', 'Finance'],
  ['education', 'Education'],
  ['youtube', 'YouTube creators'],
  ['gaming', 'Gaming'],
  ['music', 'Music & entertainment'],
  ['travel', 'Travel'],
  ['realestate', 'Real estate'],
  ['weddings', 'Weddings & events'],
  ['kids', 'Kids & family'],
]);

export const SKILLS = list([
  ['prompt', 'Prompt engineering'],
  ['story', 'Storyboarding'],
  ['script', 'Scriptwriting'],
  ['consist', 'Character consistency'],
  ['lipsync', 'Lip-sync'],
  ['vclone', 'Voice cloning'],
  ['grade', 'Colour grading'],
  ['comp', 'Compositing'],
  ['upscale', 'Upscaling'],
  ['edit', 'Video editing'],
  ['kinetic', 'Kinetic typography'],
  ['roto', 'Rotoscoping'],
  ['model3d', '3D modelling'],
  ['regional', 'Regional-language VO'],
  ['ctr', 'Thumbnail CTR design'],
]);

/** Tools stay names (verification keys are `tool:<lowercase name>`). */
export const TOOLS = [
  'Kling', 'Runway', 'Veo', 'Midjourney', 'Flux', 'ComfyUI', 'HeyGen', 'ElevenLabs', 'Suno', 'Blender',
  'After Effects', 'CapCut', 'Photoshop', 'Canva', 'Premiere Pro', 'DaVinci Resolve', 'Lightroom',
  'Pika', 'Stable Diffusion', 'Firefly', 'Figma',
].map((name) => ({ id: name, label: name }));

export const STYLES = list([
  ['cine', 'Cinematic'],
  ['real', 'Photoreal'],
  ['anime', 'Anime'],
  ['cartoon', '3D cartoon'],
  ['flat', 'Flat / minimal'],
  ['retro', 'Retro / vintage'],
  ['festive', 'Indian festive'],
  ['bold', 'Bold / high-contrast'],
]);

export const FORMATS = list([
  ['9:16', '9:16 vertical'],
  ['16:9', '16:9 widescreen'],
  ['1:1', '1:1 square'],
  ['4:5', '4:5 portrait'],
]);

export const LANGUAGES = [
  'Hindi', 'English', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Malayalam', 'Gujarati', 'Punjabi', 'Kannada', 'Urdu', 'Odia', 'Assamese',
].map((name) => ({ id: name, label: name }));

/** Agency team sizes (guide §5.4). */
export const TEAM_SIZES = list([
  ['1', 'Just me'],
  ['2-10', '2–10'],
  ['11-50', '11–50'],
  ['50+', '50+'],
]);

const ids = (items) => items.map((i) => i.id);
export const CATEGORY_IDS = ids(CATEGORIES);
export const CONTENT_TYPE_IDS = ids(CONTENT_TYPES);
export const SPECIALIZATION_IDS = ids(SPECIALIZATIONS);
export const SKILL_IDS = ids(SKILLS);
export const TOOL_NAMES = ids(TOOLS);
export const STYLE_IDS = ids(STYLES);
export const FORMAT_IDS = ids(FORMATS);
export const LANGUAGE_NAMES = ids(LANGUAGES);
export const TEAM_SIZE_IDS = ids(TEAM_SIZES);

/** Payload for GET /api/taxonomy. */
export const TAXONOMY = Object.freeze({
  categories: CATEGORIES,
  contentTypes: CONTENT_TYPES,
  specializations: SPECIALIZATIONS,
  skills: SKILLS,
  tools: TOOLS,
  styles: STYLES,
  formats: FORMATS,
  languages: LANGUAGES,
  teamSizes: TEAM_SIZES,
});
