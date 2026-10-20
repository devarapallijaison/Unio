/**
 * Seed creators (Round 2). The 11 v9 demo creators plus one extra demo creator and the team's DRAFT profiles.
 * Every value uses taxonomy ids (src/models/taxonomy.js). Demo data only (isDemo: true for fictional people).
 *
 * Tool states (`toolStates`) drive verification claims in seed.js:
 *   v = verified  → a real claim approved through verification.service.decide() by the seeded reviewer
 *                   ("Demo seed" note), so trust levels come from the real recompute.
 *   p = pending   → a submitted claim waiting in the reviewer queue.
 *   c = certified → shown as self-reported until certificates exist (Phase 8).
 * Ratings and ★ Made on UNIO counts are NOT seeded here: they only come from completed projects.
 */

const step = (tool, version, generations, note) => ({ tool, version, generations, note });

/* ------------------------------------------------------------------ */
/* Team members — DRAFT profiles, to be edited by each person          */
/* ------------------------------------------------------------------ */
const DRAFT_NOTE = 'Draft profile — skills, tools and work samples are placeholders until confirmed.';
export const team = [
  { name: 'Fawaz Ahmed', email: 'fawaz.ahmed@unio.example', category: 'video', skills: ['edit', 'prompt'], tools: ['Runway', 'CapCut'], specializations: ['d2c'], specialties: ['Product Advertising'] },
  { name: 'Sai Charitha', email: 'sai.charitha@unio.example', category: 'graphic', skills: ['prompt'], tools: ['Midjourney', 'Figma'], specializations: ['beauty'], specialties: ['Beauty'] },
  { name: 'Roha Nawaz', email: 'roha.nawaz@unio.example', category: 'filmmaker', skills: ['story'], tools: ['Kling', 'Premiere Pro'], specializations: ['fashion'], specialties: ['Fashion'] },
  { name: 'Shameer', email: 'shameer@unio.example', category: 'motion', skills: ['kinetic'], tools: ['After Effects', 'Pika'], specializations: ['tech'], specialties: ['Tech'] },
  { name: 'Jaison', email: 'jaison@unio.example', category: 'voice', skills: ['vclone', 'edit'], tools: ['ElevenLabs', 'DaVinci Resolve'], specializations: ['education'], specialties: ['Education'] },
].map((t) => ({
  ...t,
  location: 'Hyderabad',
  bio: `Part of the team building UNIO. ${DRAFT_NOTE}`,
  startingPrice: null,
  availability: 'available',
  featured: false,
  isDemo: false,
  toolStates: {},
  portfolio: [],
}));

/* ------------------------------------------------------------------ */
/* Fictional demo creators (isDemo: true) — the v9 cast                */
/* ------------------------------------------------------------------ */
const demo = [
  {
    name: 'Meera Kulkarni', location: 'Pune', startingPrice: 12000, availability: 'available', featured: true,
    headline: 'AI product ads for beauty & D2C · 9:16 first',
    bio: 'I make scroll-stopping product ads for beauty and D2C brands — 9:16 first, built in Kling and Runway, finished in CapCut with Hindi or Marathi voice-over.',
    category: 'video', secondaryCategories: ['graphic'], contentTypes: ['short', 'ad', 'static'], specializations: ['beauty', 'd2c'],
    skills: ['prompt', 'grade', 'edit', 'regional'], styles: ['real', 'cine'], formats: ['9:16', '1:1'], languages: ['Hindi', 'Marathi', 'English'],
    tools: ['Kling', 'Runway', 'CapCut', 'Midjourney'], workflow: ['Midjourney', 'Kling', 'Runway', 'CapCut'], turnaroundDays: 6, commerciallySafe: true,
    toolStates: { Kling: 'v', Runway: 'v' },
    specialties: ['Beauty', 'Wellness'],
    howIWork: [
      { title: 'Brief call', detail: '15 min, align on hook and claims' },
      { title: 'Moodboard', detail: 'Midjourney frames for approval' },
      { title: 'Generate', detail: 'Kling / Runway shots, 30–50 gens' },
      { title: 'Edit', detail: 'CapCut cut, captions, VO' },
      { title: 'Deliver', detail: '2 versions + 1 revision round' },
    ],
    portfolio: [
      {
        title: 'Dewdrop serum — 15s vertical', mediaType: 'video', category: 'Beauty', featured: true, durationSec: 15,
        description: 'Macro liquid shots and a single-take reveal, cut to a 15-second 9:16 spot.',
        contentType: 'ad', format: '9:16', industry: 'beauty', skills: ['prompt', 'grade', 'edit'], styles: ['real'],
        workflow: [step('Midjourney', 'v6', 12, 'Moodboard of the bottle on wet stone'), step('Kling', '1.6', 24, 'Macro liquid reveal shots'), step('Runway', 'Gen-3', 6, 'Light sweep + transitions'), step('CapCut', 'edit', undefined, 'Captions, Hindi VO, music')],
        generations: 42, versionsCount: 3, timeTakenDays: 4,
        briefSummary: 'Serum launch, 9:16, dewy morning light, Hindi VO, no medical claims.',
        deliveredSummary: '3 hooks tested, v3 picked. Warm golden-hour palette, Hindi VO, claim-safe captions.',
        licence: { notForLicensing: true },
        // Versions the creator chose to share on the piece page (demo notes).
        versions: [
          { label: 'v1', note: 'Hook too slow — show the product in the first 2 s', status: 'changes' },
          { label: 'v2', note: 'Love the light. Make the text bigger for mobile', status: 'changes' },
          { label: 'v3', note: 'Final cut', status: 'approved' },
        ],
      },
      {
        title: 'Morning ritual — product stills', mediaType: 'image', category: 'Beauty',
        description: 'Soft daylight still-life set for a launch carousel.',
        contentType: 'static', format: '1:1', industry: 'beauty', skills: ['prompt', 'grade'], styles: ['real'],
        workflow: [step('Midjourney', 'v6', 18, 'Still-life set, consistent daylight'), step('Runway', 'Gen-3', 4, 'Light clean-up')],
        generations: 22, versionsCount: 2, timeTakenDays: 2, licence: { notForLicensing: true },
      },
      {
        title: 'Herbal tea launch teaser', mediaType: 'video', category: 'Wellness', durationSec: 12,
        description: 'Steam, botanicals and a slow push-in, built for Reels.',
        contentType: 'short', format: '9:16', industry: 'd2c', skills: ['edit', 'regional'], styles: ['cine'],
        workflow: [step('Kling', '1.6', 16, 'Steam and botanicals'), step('CapCut', 'edit', undefined, 'Marathi VO + captions')],
        generations: 16, versionsCount: 2, timeTakenDays: 3, licence: { notForLicensing: true },
      },
    ],
  },
  {
    name: 'Ananya Rao', location: 'Hyderabad', startingPrice: 6000, availability: 'available', featured: true,
    headline: 'UGC ads with AI avatars · three hooks per brief',
    bio: 'UGC-style ads with AI avatars and natural voiceover for D2C brands. Fast turnarounds, multiple hooks per brief.',
    category: 'ugc', contentTypes: ['ugcv', 'avatar', 'ad', 'short'], specializations: ['beauty', 'd2c', 'finance'],
    skills: ['lipsync', 'vclone', 'script', 'regional'], styles: ['real'], formats: ['9:16'], languages: ['Telugu', 'Hindi', 'English'],
    tools: ['HeyGen', 'ElevenLabs', 'CapCut'], workflow: ['HeyGen', 'ElevenLabs', 'CapCut'], turnaroundDays: 3, commerciallySafe: true,
    toolStates: { HeyGen: 'v', ElevenLabs: 'c' },
    specialties: ['D2C', 'Beauty'],
    howIWork: [
      { title: 'Script', detail: 'Three hooks per brief' },
      { title: 'Avatar + voice', detail: 'HeyGen presenter, ElevenLabs VO' },
      { title: 'Edit', detail: 'CapCut captions and cut-downs' },
    ],
    portfolio: [
      {
        title: 'Three hooks, one sunscreen', mediaType: 'video', category: 'Beauty', featured: true, durationSec: 22,
        description: 'A/B test set: same product, three opening hooks.',
        contentType: 'ugcv', format: '9:16', industry: 'beauty', skills: ['script', 'lipsync', 'vclone'], styles: ['real'],
        workflow: [step('HeyGen', 'v3', 9, 'Presenter takes, three hooks'), step('ElevenLabs', 'v2', 6, 'Telugu + Hindi VO'), step('CapCut', 'edit', undefined, 'Captions and cut-downs')],
        generations: 15, versionsCount: 3, timeTakenDays: 3,
        briefSummary: '“Sunscreen that doesn’t feel like sunscreen”, three hooks to test.',
        deliveredSummary: 'Three 22-second variants with burned-in captions.',
        licence: { notForLicensing: true },
      },
      {
        title: 'Snack brand testimonial', mediaType: 'video', category: 'D2C', durationSec: 30,
        description: 'Talking-head avatar with subtitles burned in.',
        contentType: 'avatar', format: '9:16', industry: 'd2c', skills: ['lipsync', 'regional'], styles: ['real'],
        workflow: [step('HeyGen', 'v3', 4, 'Avatar testimonial'), step('CapCut', 'edit', undefined, 'Subtitles')],
        generations: 4, versionsCount: 2, timeTakenDays: 2, licence: { notForLicensing: true },
      },
    ],
  },
  {
    name: 'Arjun Menon', location: 'Kochi', startingPrice: 8000, availability: 'available', featured: true,
    headline: 'AI product photography · catalogue-consistent light',
    bio: 'AI-assisted product photography for fashion and lifestyle labels. Consistent lighting across a whole catalogue is the part I care about most.',
    category: 'photo', contentTypes: ['photo', 'static'], specializations: ['fashion', 'd2c'],
    skills: ['prompt', 'upscale', 'comp'], styles: ['real', 'flat'], formats: ['4:5', '1:1'], languages: ['Malayalam', 'English'],
    tools: ['Midjourney', 'Photoshop'], workflow: ['Midjourney', 'Photoshop'], turnaroundDays: 4,
    toolStates: { Midjourney: 'v' },
    specialties: ['Fashion', 'Lifestyle'],
    portfolio: [
      {
        title: 'Linen capsule — catalogue set', mediaType: 'image', category: 'Fashion', featured: true,
        description: 'Twelve looks on a consistent sand backdrop for an e-commerce drop.',
        contentType: 'photo', format: '4:5', industry: 'fashion', skills: ['prompt', 'comp'], styles: ['real'],
        workflow: [step('Midjourney', 'v6', 48, 'Twelve looks, one sand backdrop'), step('Photoshop', 'Beta', undefined, 'Compositing + colour match')],
        generations: 48, versionsCount: 2, timeTakenDays: 4, licence: { notForLicensing: true },
      },
      {
        title: 'Leather goods on stone', mediaType: 'image', category: 'Lifestyle',
        description: 'Upscaled hero images with hand-retouched stitching detail.',
        contentType: 'photo', format: '1:1', industry: 'd2c', skills: ['upscale'], styles: ['real'],
        workflow: [step('Midjourney', 'v6', 20, 'Hero compositions'), step('Photoshop', 'Beta', undefined, 'Upscale and stitching retouch')],
        generations: 20, versionsCount: 1, timeTakenDays: 2, licence: { notForLicensing: true },
      },
    ],
  },
  {
    name: 'Rohan Das', location: 'Kolkata', startingPrice: 18000, availability: 'available', featured: false,
    headline: '3D product visualisation for electronics',
    bio: '3D product visualisation for consumer electronics, mixing Blender scenes with diffusion-based texturing.',
    category: '3d', contentTypes: ['render3d', 'short'], specializations: ['tech', 'd2c'],
    skills: ['model3d', 'comp', 'grade'], styles: ['real', 'cartoon'], formats: ['1:1', '16:9'], languages: ['Bengali', 'English'],
    tools: ['Blender', 'ComfyUI', 'DaVinci Resolve'], workflow: ['Blender', 'ComfyUI', 'DaVinci Resolve'], turnaroundDays: 8,
    toolStates: { Blender: 'c', ComfyUI: 'p' },
    specialties: ['Electronics', 'Tech'],
    portfolio: [
      {
        title: 'Earbuds 360° spin', mediaType: 'video', category: 'Electronics', featured: true, durationSec: 10,
        description: 'Turntable render of a matte earbud case with generated material passes.',
        contentType: 'render3d', format: '1:1', industry: 'tech', skills: ['model3d', 'comp'], styles: ['real'],
        workflow: [step('Blender', '4.2', undefined, 'Model, light and turntable'), step('ComfyUI', 'SDXL', 30, 'Material passes'), step('DaVinci Resolve', '19', undefined, 'Grade')],
        generations: 30, versionsCount: 2, timeTakenDays: 6, licence: { notForLicensing: true },
      },
      {
        title: 'Earbuds exploded view', mediaType: 'image', category: 'Electronics',
        description: 'Component breakdown render for a spec sheet.',
        contentType: 'render3d', format: '16:9', industry: 'tech', skills: ['model3d'], styles: ['real'],
        workflow: [step('Blender', '4.2', undefined, 'Exploded-view layout')],
        versionsCount: 1, timeTakenDays: 3, licence: { notForLicensing: true },
      },
    ],
  },
  {
    name: 'Kabir Malhotra', location: 'Mumbai', startingPrice: 20000, availability: 'available', featured: false,
    headline: 'Music visuals and lyric videos, cut to the beat',
    bio: 'Music visuals and lyric videos for independent artists and audio brands. Every frame is cut to the beat.',
    category: 'music', secondaryCategories: ['filmmaker'], contentTypes: ['musicvid', 'long'], specializations: ['music'],
    skills: ['story', 'grade', 'edit', 'consist'], styles: ['cine', 'retro'], formats: ['16:9', '9:16'], languages: ['Hindi', 'English'],
    tools: ['Suno', 'Kling', 'DaVinci Resolve'], workflow: ['Suno', 'Kling', 'DaVinci Resolve'], turnaroundDays: 10,
    toolStates: { Kling: 'v' },
    specialties: ['Music', 'Entertainment'],
    portfolio: [
      {
        title: 'Midnight single — visualiser', mediaType: 'video', category: 'Music', featured: true, durationSec: 168,
        description: 'Rain-soaked city visuals graded to a single teal-amber palette.',
        contentType: 'musicvid', format: '16:9', industry: 'music', skills: ['story', 'grade', 'consist'], styles: ['cine'],
        workflow: [step('Suno', 'v4', 3, 'Guide track for timing'), step('Kling', '1.6', 60, 'City and rain shots'), step('DaVinci Resolve', '19', undefined, 'Cut to the beat, teal-amber grade')],
        generations: 63, versionsCount: 2, timeTakenDays: 9, licence: { notForLicensing: true },
      },
      {
        title: 'Album cover series', mediaType: 'image', category: 'Music',
        description: 'Four alternate covers explored for an EP release.',
        contentType: 'static', format: '1:1', industry: 'music', skills: ['grade'], styles: ['retro'],
        workflow: [step('Kling', '1.6', 12, 'Cover explorations')],
        generations: 12, versionsCount: 4, timeTakenDays: 2, licence: { notForLicensing: true },
      },
    ],
  },
  {
    name: 'Ishita Bansal', location: 'New Delhi', startingPrice: 7000, availability: 'available', featured: true,
    headline: 'Food & beverage stills that look cooked, not rendered',
    bio: 'Food and beverage imagery that looks cooked, not rendered. Menus, packaging mockups and seasonal campaigns.',
    category: 'photo', secondaryCategories: ['graphic'], contentTypes: ['photo', 'static', 'poster'], specializations: ['food', 'weddings'],
    skills: ['prompt', 'upscale'], styles: ['festive', 'real'], formats: ['4:5', '1:1'], languages: ['Hindi', 'Punjabi', 'English'],
    tools: ['Midjourney', 'Lightroom'], workflow: ['Midjourney', 'Lightroom'], turnaroundDays: 3,
    toolStates: { Midjourney: 'v' },
    specialties: ['Food & Beverage'],
    portfolio: [
      {
        title: 'Festive mithai stills', mediaType: 'image', category: 'Food & Beverage', featured: true,
        description: 'Overhead packaging shot for a Diwali gifting range.',
        contentType: 'photo', format: '4:5', industry: 'food', skills: ['prompt', 'upscale'], styles: ['festive'],
        workflow: [step('Midjourney', 'v6', 18, 'Overhead mithai box set'), step('Lightroom', 'Classic', undefined, 'Warm grade')],
        generations: 18, versionsCount: 2, timeTakenDays: 2, licence: { notForLicensing: true },
      },
      {
        title: 'Cold brew summer menu', mediaType: 'image', category: 'Food & Beverage',
        description: 'Menu board imagery in a warm, sunlit style.',
        contentType: 'static', format: '1:1', industry: 'food', skills: ['prompt'], styles: ['real'],
        workflow: [step('Midjourney', 'v6', 10, 'Menu items')],
        generations: 10, versionsCount: 1, timeTakenDays: 1, licence: { notForLicensing: true },
      },
    ],
  },
  {
    name: 'Zoya Siddiqui', location: 'Bengaluru', startingPrice: 15000, availability: 'busy', featured: true,
    headline: 'Motion design · SaaS and fintech explainers',
    bio: 'Motion designer turning SaaS product stories into crisp explainer animation. I combine After Effects with generated textures and transitions.',
    category: 'motion', secondaryCategories: ['animator'], contentTypes: ['motion', 'anim', 'ad'], specializations: ['tech', 'finance', 'education'],
    skills: ['kinetic', 'story', 'roto'], styles: ['flat'], formats: ['16:9'], languages: ['Urdu', 'Kannada', 'English'],
    tools: ['Figma', 'After Effects', 'Runway'], workflow: ['Figma', 'After Effects', 'Runway'], turnaroundDays: 7,
    toolStates: { 'After Effects': 'c', Runway: 'v' },
    specialties: ['Tech', 'SaaS'],
    portfolio: [
      {
        title: 'Fintech onboarding explainer', mediaType: 'video', category: 'Tech', featured: true, durationSec: 60,
        description: '60-second walkthrough with generated ambient backgrounds.',
        contentType: 'motion', format: '16:9', industry: 'finance', skills: ['kinetic', 'story'], styles: ['flat'],
        workflow: [step('Figma', 'UI3', undefined, 'Storyboard frames'), step('After Effects', '2025', undefined, 'Kinetic type + UI motion'), step('Runway', 'Gen-3', 8, 'Ambient backgrounds')],
        generations: 8, versionsCount: 3, timeTakenDays: 7, licence: { notForLicensing: true },
      },
      {
        title: 'Feature launch loop', mediaType: 'video', category: 'SaaS', durationSec: 6,
        description: 'Seamless 6-second loop for a product announcement.',
        contentType: 'motion', format: '16:9', industry: 'tech', skills: ['kinetic'], styles: ['flat'],
        workflow: [step('After Effects', '2025', undefined, 'Loop animation')],
        versionsCount: 2, timeTakenDays: 2, licence: { notForLicensing: true },
      },
    ],
  },
  {
    name: 'Vihaan Shah', location: 'Ahmedabad', startingPrice: 25000, availability: 'busy', featured: false,
    headline: 'Brand films and travel stories, script first',
    bio: 'Brand films and travel stories. I write the script first, then build each scene with generated footage and real sound design.',
    category: 'filmmaker', contentTypes: ['long', 'ad', 'short'], specializations: ['travel', 'realestate'],
    skills: ['story', 'script', 'grade', 'consist'], styles: ['cine'], formats: ['16:9'], languages: ['Gujarati', 'Hindi', 'English'],
    tools: ['Veo', 'Premiere Pro'], workflow: ['Veo', 'Premiere Pro'], turnaroundDays: 12,
    toolStates: { Veo: 'p' },
    specialties: ['Travel', 'Hospitality'],
    portfolio: [
      {
        title: 'Stepwell at dawn — brand film', mediaType: 'video', category: 'Travel', featured: true, durationSec: 90,
        description: '90-second heritage-hotel story with original narration.',
        contentType: 'long', format: '16:9', industry: 'travel', skills: ['story', 'script', 'grade'], styles: ['cine'],
        workflow: [step('Veo', '3', 40, 'Scene generation, dawn light'), step('Premiere Pro', '2025', undefined, 'Edit, narration, sound design')],
        generations: 40, versionsCount: 2, timeTakenDays: 12, licence: { notForLicensing: true },
      },
    ],
  },
  {
    name: 'Sana Qureshi', location: 'Jaipur', startingPrice: 10000, availability: 'unavailable', featured: false,
    headline: 'Fashion lookbooks with a handcrafted feel',
    bio: 'Fashion lookbooks with a handcrafted feel: block-print textures, desert light, and consistent model styling across a collection.',
    category: 'graphic', contentTypes: ['static', 'poster', 'photo'], specializations: ['fashion', 'weddings'],
    skills: ['prompt', 'comp'], styles: ['retro', 'festive'], formats: ['4:5'], languages: ['Hindi', 'English'],
    tools: ['Flux', 'Photoshop'], workflow: ['Flux', 'Photoshop'], turnaroundDays: 5,
    toolStates: {},
    specialties: ['Fashion'],
    portfolio: [
      {
        title: 'Block-print resort lookbook', mediaType: 'image', category: 'Fashion', featured: true,
        description: 'Sixteen-page lookbook for a resort-wear capsule.',
        contentType: 'poster', format: '4:5', industry: 'fashion', skills: ['prompt', 'comp'], styles: ['festive'],
        workflow: [step('Flux', '1.1', 64, 'Looks with consistent styling'), step('Photoshop', 'Beta', undefined, 'Layout and textures')],
        generations: 64, versionsCount: 2, timeTakenDays: 5, licence: { notForLicensing: true },
      },
    ],
  },
  {
    name: 'Dev Patil', location: 'Indore', startingPrice: 2500, availability: 'available', featured: false,
    headline: 'YouTube thumbnails built for click-through',
    bio: 'Thumbnails and cover art for YouTube and podcast creators. Bold, readable at phone size, tested for click-through.',
    category: 'thumb', secondaryCategories: ['graphic'], contentTypes: ['thumb', 'static'], specializations: ['youtube', 'gaming', 'education'],
    skills: ['ctr', 'comp', 'prompt'], styles: ['bold'], formats: ['16:9'], languages: ['Hindi', 'English'],
    tools: ['Midjourney', 'Photoshop', 'Canva'], workflow: ['Midjourney', 'Photoshop'], turnaroundDays: 1,
    toolStates: { Midjourney: 'v' },
    portfolio: [
      {
        title: '5 AI tools — thumbnail set', mediaType: 'image', category: 'YouTube', featured: true,
        description: 'Three thumbnail options for a tech-explainer video.',
        contentType: 'thumb', format: '16:9', industry: 'youtube', skills: ['ctr', 'comp'], styles: ['bold'],
        workflow: [step('Midjourney', 'v6', 14, 'Background and subject'), step('Photoshop', 'Beta', undefined, 'Type, cut-out, contrast')],
        generations: 14, versionsCount: 3, timeTakenDays: 1, licence: { notForLicensing: true },
      },
    ],
  },
  {
    name: 'Tara Iyer', location: 'Chennai', startingPrice: 14000, availability: 'available', featured: false,
    headline: 'Character animation for explainers and kids’ content',
    bio: 'Character animation for education and YouTube channels — consistent characters across every episode.',
    category: 'animator', contentTypes: ['anim', 'short', 'musicvid'], specializations: ['education', 'youtube', 'kids'],
    skills: ['consist', 'story', 'lipsync'], styles: ['anime', 'cartoon'], formats: ['16:9', '9:16'], languages: ['Tamil', 'English'],
    tools: ['Midjourney', 'Kling', 'After Effects'], workflow: ['Midjourney', 'Kling', 'After Effects'], turnaroundDays: 9,
    toolStates: { Kling: 'c' },
    portfolio: [
      {
        title: 'Counting with Kiki — episode 1', mediaType: 'video', category: 'Kids', featured: true, durationSec: 45,
        description: 'Recurring character in a 45-second counting song.',
        contentType: 'anim', format: '16:9', industry: 'kids', skills: ['consist', 'story', 'lipsync'], styles: ['cartoon'],
        workflow: [step('Midjourney', 'v6', 20, 'Character sheet'), step('Kling', '1.6', 30, 'Animated shots'), step('After Effects', '2025', undefined, 'Lip-sync and titles')],
        generations: 50, versionsCount: 2, timeTakenDays: 8, licence: { notForLicensing: true },
      },
    ],
  },
  {
    name: 'Nikhil Varma', location: 'Chennai', startingPrice: 4000, availability: 'available', featured: false,
    headline: 'Social carousels and explainer graphics',
    bio: 'Social carousels and explainer graphics for education and creator-economy brands. Clear type, clean grids.',
    category: 'graphic', contentTypes: ['static'], specializations: ['education'],
    skills: ['prompt', 'comp'], styles: ['flat'], formats: ['4:5', '1:1'], languages: ['Tamil', 'English'],
    tools: ['Canva', 'Figma'], workflow: ['Canva', 'Figma'], turnaroundDays: 2,
    toolStates: {},
    specialties: ['Education'],
    portfolio: [
      {
        title: 'Exam-prep carousel series', mediaType: 'image', category: 'Education', featured: true,
        description: 'Ten-slide carousels with generated illustrations.',
        contentType: 'static', format: '4:5', industry: 'education', skills: ['prompt', 'comp'], styles: ['flat'],
        workflow: [step('Canva', 'Pro', undefined, 'Layout'), step('Figma', 'UI3', undefined, 'Type system')],
        versionsCount: 1, timeTakenDays: 2, licence: { notForLicensing: true },
      },
    ],
  },
];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
export const demoCreators = demo.map((c) => ({ revisionsIncluded: 2, ...c, email: `${slugify(c.name)}@creators.unio.example`, isDemo: true }));
