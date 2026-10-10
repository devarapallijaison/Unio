/**
 * Idempotent demo seed for UNIO.
 *   npm run seed            (uses MONGODB_URI and SEED_DEMO_PASSWORD from server/.env)
 *
 * - Users are keyed by email, profiles by userId, campaigns by (brandId, title),
 *   portfolio items by (creatorId, title), applications/invitations/projects by
 *   (campaignId, creatorId). Running it twice produces no duplicates.
 * - All demo emails use the reserved `.example` domain.
 * - Media URLs point at `media.unio.example/placeholder/...`; the frontend renders
 *   these as labelled placeholders. Replace them with hosted media before a demo.
 * - Team member profiles are DRAFTS: skills, tools and bios are suggestions to be
 *   confirmed by each person. They are not verified facts.
 */
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import {
  Application,
  BrandProfile,
  Campaign,
  CreatorProfile,
  Invitation,
  PortfolioItem,
  Project,
  User,
} from '../src/models/index.js';
import { hashPassword } from '../src/services/auth.service.js';
import { createProjectFromSource } from '../src/services/projects.service.js';

const PASSWORD = process.env.SEED_DEMO_PASSWORD;
if (!PASSWORD || PASSWORD.length < 8) {
  console.error('Set SEED_DEMO_PASSWORD (min 8 chars) in server/.env before seeding.');
  process.exit(1);
}

const media = (slug, ext = 'jpg') => `https://media.unio.example/placeholder/${slug}.${ext}`;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const inDays = (n) => new Date(Date.now() + n * 86_400_000);

/* ------------------------------------------------------------------ */
/* Team members — DRAFT profiles, to be edited by each person          */
/* ------------------------------------------------------------------ */
const DRAFT_NOTE = 'Draft profile — skills, tools and work samples are placeholders until confirmed.';
const team = [
  { name: 'Fawaz Ahmed', email: 'fawaz.ahmed@unio.example', location: 'Hyderabad', skills: ['AI Video', 'Creative Direction'], tools: ['Runway', 'CapCut'], specialties: ['Product Advertising'] },
  { name: 'Sai Charitha', email: 'sai.charitha@unio.example', location: 'Hyderabad', skills: ['AI Image Generation', 'Brand Design'], tools: ['Midjourney', 'Figma'], specialties: ['Beauty'] },
  { name: 'Roha Nawaz', email: 'roha.nawaz@unio.example', location: 'Hyderabad', skills: ['Storyboarding', 'AI Video'], tools: ['Kling', 'Premiere Pro'], specialties: ['Fashion'] },
  { name: 'Shameer', email: 'shameer@unio.example', location: 'Hyderabad', skills: ['Motion Design', 'AI Animation'], tools: ['After Effects', 'Pika'], specialties: ['Tech'] },
  { name: 'Jaison', email: 'jaison@unio.example', location: 'Hyderabad', skills: ['AI Voice', 'Video Editing'], tools: ['ElevenLabs', 'DaVinci Resolve'], specialties: ['Education'] },
].map((t) => ({
  ...t,
  bio: `Part of the team building UNIO. ${DRAFT_NOTE}`,
  startingPrice: null,
  availability: 'available',
  featured: false,
  isDemo: false,
  portfolio: [],
}));

/* ------------------------------------------------------------------ */
/* Fictional demo creators (isDemo: true)                              */
/* ------------------------------------------------------------------ */
const demoCreators = [
  {
    name: 'Meera Kulkarni', location: 'Pune', startingPrice: 12000, availability: 'available', featured: true,
    bio: 'Short-form product films for skincare and wellness brands. I storyboard by hand, generate shots in Kling and Runway, and finish the edit and sound myself so the result feels directed rather than generated.',
    skills: ['AI Video', 'Product Advertising', 'Storyboarding'], tools: ['Kling', 'Runway', 'CapCut'], specialties: ['Beauty', 'Wellness'],
    portfolio: [
      { title: 'Dewdrop serum — 15s vertical', mediaType: 'video', category: 'Beauty', tools: ['Kling', 'CapCut'], featured: true, description: 'Macro liquid shots and a single-take reveal, cut to a 15-second 9:16 spot.' },
      { title: 'Morning ritual — product stills', mediaType: 'image', category: 'Beauty', tools: ['Runway'], description: 'Soft daylight still-life set for a launch carousel.' },
      { title: 'Herbal tea launch teaser', mediaType: 'video', category: 'Wellness', tools: ['Runway', 'CapCut'], description: 'Steam, botanicals and a slow push-in, built for Reels.' },
    ],
  },
  {
    name: 'Arjun Menon', location: 'Kochi', startingPrice: 8000, availability: 'available', featured: true,
    bio: 'AI-assisted product photography for fashion and lifestyle labels. Consistent lighting across a whole catalogue is the part I care about most.',
    skills: ['AI Image Generation', 'Product Photography', 'Retouching'], tools: ['Midjourney', 'Photoshop', 'Magnific'], specialties: ['Fashion', 'Lifestyle'],
    portfolio: [
      { title: 'Linen capsule — catalogue set', mediaType: 'image', category: 'Fashion', tools: ['Midjourney', 'Photoshop'], featured: true, description: 'Twelve looks on a consistent sand backdrop for an e-commerce drop.' },
      { title: 'Leather goods on stone', mediaType: 'image', category: 'Lifestyle', tools: ['Magnific', 'Photoshop'], description: 'Upscaled hero images with hand-retouched stitching detail.' },
    ],
  },
  {
    name: 'Zoya Siddiqui', location: 'Bengaluru', startingPrice: 15000, availability: 'busy', featured: true,
    bio: 'Motion designer turning SaaS product stories into crisp explainer animation. I combine After Effects with generated textures and transitions.',
    skills: ['Motion Design', 'AI Animation', 'Explainer Video'], tools: ['After Effects', 'Runway', 'Pika'], specialties: ['Tech', 'SaaS'],
    portfolio: [
      { title: 'Fintech onboarding explainer', mediaType: 'video', category: 'Tech', tools: ['After Effects', 'Runway'], featured: true, description: '60-second walkthrough with generated ambient backgrounds.' },
      { title: 'Feature launch loop', mediaType: 'video', category: 'SaaS', tools: ['Pika'], description: 'Seamless 6-second loop for a product announcement.' },
      { title: 'Data-viz title cards', mediaType: 'image', category: 'Tech', tools: ['After Effects'], description: 'Title system for a quarterly report video.' },
    ],
  },
  {
    name: 'Kabir Malhotra', location: 'Mumbai', startingPrice: 20000, availability: 'available', featured: false,
    bio: 'Music visuals and lyric videos for independent artists and audio brands. Every frame is cut to the beat.',
    skills: ['AI Video', 'Music Visuals', 'Color Grading'], tools: ['Kling', 'Suno', 'DaVinci Resolve'], specialties: ['Music', 'Entertainment'],
    portfolio: [
      { title: 'Neon monsoon — lyric video', mediaType: 'video', category: 'Music', tools: ['Kling', 'DaVinci Resolve'], featured: true, description: 'Rain-soaked city visuals graded to a single teal-amber palette.' },
      { title: 'Album cover series', mediaType: 'image', category: 'Music', tools: ['Midjourney'], description: 'Four alternate covers explored for an EP release.' },
    ],
  },
  {
    name: 'Ananya Rao', location: 'Hyderabad', startingPrice: 6000, availability: 'available', featured: true,
    bio: 'UGC-style ads with AI avatars and natural voiceover for D2C brands. Fast turnarounds, multiple hooks per brief.',
    skills: ['AI Avatars', 'UGC Ads', 'Scriptwriting'], tools: ['HeyGen', 'ElevenLabs', 'CapCut'], specialties: ['D2C', 'Beauty'],
    portfolio: [
      { title: 'Three hooks, one sunscreen', mediaType: 'video', category: 'Beauty', tools: ['HeyGen', 'ElevenLabs'], featured: true, description: 'A/B test set: same product, three opening hooks.' },
      { title: 'Snack brand testimonial', mediaType: 'video', category: 'D2C', tools: ['HeyGen', 'CapCut'], description: 'Talking-head avatar with subtitles burned in.' },
    ],
  },
  {
    name: 'Rohan Das', location: 'Kolkata', startingPrice: 18000, availability: 'available', featured: false,
    bio: '3D product visualisation for consumer electronics, mixing Blender scenes with diffusion-based texturing.',
    skills: ['3D Visualization', 'AI Image Generation', 'Product Advertising'], tools: ['Blender', 'Stable Diffusion', 'ComfyUI'], specialties: ['Electronics', 'Tech'],
    portfolio: [
      { title: 'Earbuds exploded view', mediaType: 'image', category: 'Electronics', tools: ['Blender', 'ComfyUI'], featured: true, description: 'Component breakdown render for a spec sheet.' },
      { title: 'Smartwatch turntable', mediaType: 'video', category: 'Electronics', tools: ['Blender'], description: '360° turntable with generated material variations.' },
    ],
  },
  {
    name: 'Ishita Bansal', location: 'New Delhi', startingPrice: 7000, availability: 'available', featured: false,
    bio: 'Food and beverage imagery that looks cooked, not rendered. Menus, packaging mockups and seasonal campaigns.',
    skills: ['AI Image Generation', 'Food Styling', 'Packaging Mockups'], tools: ['Midjourney', 'Firefly', 'Lightroom'], specialties: ['Food & Beverage'],
    portfolio: [
      { title: 'Festive mithai box', mediaType: 'image', category: 'Food & Beverage', tools: ['Midjourney', 'Lightroom'], featured: true, description: 'Overhead packaging shot for a Diwali gifting range.' },
      { title: 'Cold brew summer menu', mediaType: 'image', category: 'Food & Beverage', tools: ['Firefly'], description: 'Menu board imagery in a warm, sunlit style.' },
    ],
  },
  {
    name: 'Vihaan Shah', location: 'Ahmedabad', startingPrice: 25000, availability: 'busy', featured: false,
    bio: 'Brand films and travel stories. I write the script first, then build each scene with generated footage and real sound design.',
    skills: ['Brand Storytelling', 'AI Video', 'Scriptwriting'], tools: ['Veo', 'Runway', 'Premiere Pro'], specialties: ['Travel', 'Hospitality'],
    portfolio: [
      { title: 'Stepwell at dawn — brand film', mediaType: 'video', category: 'Travel', tools: ['Veo', 'Premiere Pro'], featured: true, description: '90-second heritage-hotel story with original narration.' },
      { title: 'Coastal resort stills', mediaType: 'image', category: 'Hospitality', tools: ['Runway'], description: 'Key art for a monsoon-season booking campaign.' },
    ],
  },
  {
    name: 'Nikhil Varma', location: 'Chennai', startingPrice: 4000, availability: 'available', featured: false,
    bio: 'Social carousels and explainer graphics for education and creator-economy brands. Clear type, clean grids.',
    skills: ['Social Media Design', 'AI Image Generation', 'Copywriting'], tools: ['Ideogram', 'Canva', 'Figma'], specialties: ['Education'],
    portfolio: [
      { title: 'Exam-prep carousel series', mediaType: 'image', category: 'Education', tools: ['Ideogram', 'Figma'], featured: true, description: 'Ten-slide carousels with generated illustrations.' },
    ],
  },
  {
    name: 'Sana Qureshi', location: 'Jaipur', startingPrice: 10000, availability: 'unavailable', featured: false,
    bio: 'Fashion lookbooks with a handcrafted feel: block-print textures, desert light, and consistent model styling across a collection.',
    skills: ['AI Image Generation', 'Fashion Lookbooks', 'Art Direction'], tools: ['Flux', 'Midjourney', 'Photoshop'], specialties: ['Fashion'],
    portfolio: [
      { title: 'Block-print resort lookbook', mediaType: 'image', category: 'Fashion', tools: ['Flux', 'Photoshop'], featured: true, description: 'Sixteen-page lookbook for a resort-wear capsule.' },
      { title: 'Indigo textures study', mediaType: 'image', category: 'Fashion', tools: ['Midjourney'], description: 'Texture explorations used as campaign backdrops.' },
    ],
  },
].map((c) => ({ ...c, email: `${slugify(c.name)}@creators.unio.example`, isDemo: true }));

/* ------------------------------------------------------------------ */
/* Fictional demo brands and campaigns                                 */
/* ------------------------------------------------------------------ */
const brands = [
  {
    name: 'Verdant Skin Co.', email: 'team@verdant.unio.example', industry: 'Beauty',
    websiteUrl: 'https://verdant.unio.example',
    description: 'Demo brand. Plant-based skincare made in small batches, sold online across India.',
    campaigns: [
      {
        title: 'Summer SPF launch — vertical ads', category: 'Beauty', status: 'open', budgetMin: 8000, budgetMax: 20000, deadline: inDays(30),
        brief: 'We are launching a lightweight SPF 50 gel for humid summers. We need short vertical ads that feel fresh and honest, not glossy. Show texture, absorption and a quick morning routine. No exaggerated skin claims.',
        requiredSkills: ['AI Video', 'Product Advertising'], requiredTools: ['Kling', 'Runway'],
        deliverables: [{ title: 'Vertical video', description: '15–30 seconds, 9:16, with captions', quantity: 2 }, { title: 'Still frames', description: 'Three 4:5 stills pulled from the edit', quantity: 3 }],
      },
      {
        title: 'Ingredient explainer series', category: 'Beauty', status: 'open', budgetMin: 5000, budgetMax: 12000, deadline: inDays(45),
        brief: 'A short series explaining our five hero ingredients. Calm, educational tone with simple motion graphics. Each episode under 40 seconds.',
        requiredSkills: ['Motion Design', 'Explainer Video'], requiredTools: ['After Effects'],
        deliverables: [{ title: 'Explainer episode', description: 'Under 40 seconds, 1:1 and 9:16 exports', quantity: 5 }],
      },
      {
        title: 'Monsoon gift set stills', category: 'Beauty', status: 'closed', budgetMin: 4000, budgetMax: 9000, deadline: inDays(-10),
        brief: 'Product stills for our monsoon gift box: rain-on-glass mood, deep greens, soft reflections.',
        requiredSkills: ['AI Image Generation', 'Product Photography'], requiredTools: ['Midjourney'],
        deliverables: [{ title: 'Hero still', description: '4:5 and 16:9', quantity: 4 }],
      },
    ],
  },
  {
    name: 'Northwind Audio', email: 'studio@northwind.unio.example', industry: 'Electronics',
    websiteUrl: 'https://northwind.unio.example',
    description: 'Demo brand. Independent audio hardware company designing earbuds and studio headphones.',
    campaigns: [
      {
        title: 'Wireless earbuds product film', category: 'Electronics', status: 'open', budgetMin: 15000, budgetMax: 35000, deadline: inDays(40),
        brief: 'A 30-second product film for our new noise-cancelling earbuds. Precise, architectural visuals: the case opening, the fit, sound visualised as space. Must work without voiceover.',
        requiredSkills: ['3D Visualization', 'Product Advertising', 'AI Video'], requiredTools: ['Blender', 'Runway'],
        deliverables: [{ title: 'Product film', description: '30 seconds, 16:9 and 9:16 cut-downs', quantity: 1 }, { title: 'Exploded-view still', description: 'High-res, transparent background', quantity: 1 }],
      },
      {
        title: 'Studio headphones lookbook', category: 'Electronics', status: 'open', budgetMin: 8000, budgetMax: 16000, deadline: inDays(25),
        brief: 'Lifestyle imagery of musicians and producers using our studio headphones at home studios. Warm practical lighting, real-feeling spaces.',
        requiredSkills: ['AI Image Generation', 'Art Direction'], requiredTools: ['Midjourney', 'Photoshop'],
        deliverables: [{ title: 'Lifestyle image', description: '4:5, campaign-ready', quantity: 8 }],
      },
      {
        title: 'Festival sale social pack', category: 'Electronics', status: 'draft', budgetMin: 5000, budgetMax: 10000, deadline: inDays(60),
        brief: 'Draft: social graphics for the festive sale period. Brief to be finalised.',
        requiredSkills: ['Social Media Design'], requiredTools: ['Figma'],
        deliverables: [{ title: 'Social post', description: '1:1 and 9:16', quantity: 10 }],
      },
    ],
  },
  {
    name: 'Masala Trail Foods', email: 'hello@masalatrail.unio.example', industry: 'Food & Beverage',
    websiteUrl: 'https://masalatrail.unio.example',
    description: 'Demo brand. Regional spice blends and ready-to-cook kits from across India.',
    campaigns: [
      {
        title: 'Regional recipe reels', category: 'Food & Beverage', status: 'open', budgetMin: 6000, budgetMax: 14000, deadline: inDays(35),
        brief: 'Short recipe reels for four regional blends. Close-up cooking moments, steam, sizzling tadka. Should feel like a home kitchen, not a studio.',
        requiredSkills: ['AI Video', 'Food Styling'], requiredTools: ['Kling', 'CapCut'],
        deliverables: [{ title: 'Recipe reel', description: '20–40 seconds, 9:16', quantity: 4 }],
      },
      {
        title: 'Packaging hero imagery', category: 'Food & Beverage', status: 'open', budgetMin: 4000, budgetMax: 9000, deadline: inDays(20),
        brief: 'Hero images of our new kraft-paper packaging surrounded by whole spices. Overhead and three-quarter angles.',
        requiredSkills: ['AI Image Generation', 'Packaging Mockups'], requiredTools: ['Midjourney', 'Firefly'],
        deliverables: [{ title: 'Packaging hero', description: '1:1 and 4:5', quantity: 6 }],
      },
    ],
  },
].map((b) => ({ ...b, isDemo: true }));

/* ------------------------------------------------------------------ */

async function upsertUser({ name, email, role }, passwordHash) {
  return User.findOneAndUpdate(
    { email },
    { $set: { name, role }, $setOnInsert: { email, passwordHash } },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).lean();
}

async function seedCreator(c, passwordHash) {
  const user = await upsertUser({ name: c.name, email: c.email, role: 'creator' }, passwordHash);
  const profile = await CreatorProfile.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        displayName: c.name, bio: c.bio, location: c.location, skills: c.skills, tools: c.tools,
        specialties: c.specialties, startingPrice: c.startingPrice ?? undefined, availability: c.availability,
        featured: c.featured, isDemo: c.isDemo,
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).lean();

  for (const item of c.portfolio) {
    const slug = `${slugify(c.name)}-${slugify(item.title)}`;
    await PortfolioItem.findOneAndUpdate(
      { creatorId: profile._id, title: item.title },
      {
        $set: {
          ...item,
          mediaUrl: media(slug, item.mediaType === 'video' ? 'mp4' : 'jpg'),
          thumbnailUrl: media(`${slug}-thumb`),
          featured: !!item.featured,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
  }
  return profile;
}

async function seedBrand(b, passwordHash) {
  const user = await upsertUser({ name: b.name, email: b.email, role: 'brand' }, passwordHash);
  await BrandProfile.findOneAndUpdate(
    { userId: user._id },
    { $set: { companyName: b.name, industry: b.industry, websiteUrl: b.websiteUrl, description: b.description, isDemo: true } },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
  const campaigns = {};
  for (const c of b.campaigns) {
    campaigns[c.title] = await Campaign.findOneAndUpdate(
      { brandId: user._id, title: c.title },
      { $set: { ...c, brandId: user._id } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    ).lean();
  }
  return { user, campaigns };
}

async function upsertApplication(campaign, creator, proposal, proposedPrice, status) {
  return Application.findOneAndUpdate(
    { campaignId: campaign._id, creatorId: creator._id },
    { $setOnInsert: { campaignId: campaign._id, creatorId: creator._id, proposal, proposedPrice, status, submittedAt: new Date() } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
}

async function upsertInvitation(campaign, creator, message, status) {
  return Invitation.findOneAndUpdate(
    { campaignId: campaign._id, creatorId: creator._id },
    { $setOnInsert: { campaignId: campaign._id, creatorId: creator._id, brandId: campaign.brandId, message, status } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
}

async function main() {
  await connectDB();
  await Promise.all([User, CreatorProfile, BrandProfile, PortfolioItem, Campaign, Application, Invitation, Project].map((m) => m.syncIndexes()));
  console.log(`Seeding database "${mongoose.connection.name}"...`);

  const passwordHash = await hashPassword(PASSWORD);

  const creators = {};
  for (const c of [...team, ...demoCreators]) creators[c.name] = await seedCreator(c, passwordHash);

  const brandData = {};
  for (const b of brands) brandData[b.name] = await seedBrand(b, passwordHash);

  const v = brandData['Verdant Skin Co.'].campaigns;
  const n = brandData['Northwind Audio'].campaigns;
  const m = brandData['Masala Trail Foods'].campaigns;
  const spf = v['Summer SPF launch — vertical ads'];

  // Applications
  const acceptedApp = await upsertApplication(
    spf, creators['Meera Kulkarni'],
    'I would shoot this as two contrasting spots: a slow macro texture film and a fast 15-second routine cut. I can deliver both vertical edits and the three stills within two weeks.',
    16000, 'accepted',
  );
  await upsertApplication(spf, creators['Ananya Rao'], 'I can deliver UGC-style versions with an AI presenter, three hooks per edit so you can test what performs best.', 9000, 'pending');
  await upsertApplication(spf, creators['Arjun Menon'], 'I focus on stills, so I would propose a still-led version with subtle motion added in post.', 8000, 'rejected');
  await upsertApplication(n['Wireless earbuds product film'], creators['Rohan Das'], 'Blender is my main tool for this kind of brief. I would build the case and buds in 3D and texture the environment with diffusion passes for a premium, precise look.', 30000, 'pending');
  await upsertApplication(m['Regional recipe reels'], creators['Ishita Bansal'], 'Food is all I shoot. I would build each reel around one hero moment, the tadka hitting the oil, and keep the colours warm and homely.', 12000, 'pending');
  await upsertApplication(m['Packaging hero imagery'], creators['Fawaz Ahmed'], 'Draft demo application: I can produce overhead and three-quarter hero images of the new packaging with whole spices styled around it.', 7000, 'pending');

  // Invitations
  await upsertInvitation(v['Ingredient explainer series'], creators['Zoya Siddiqui'], 'We loved your fintech explainer. Would you be open to a calm, educational series for our ingredients?', 'pending');
  const acceptedInv = await upsertInvitation(n['Studio headphones lookbook'], creators['Sana Qureshi'], 'Your lookbook styling is exactly the warmth we want for our headphones campaign.', 'accepted');
  await upsertInvitation(n['Wireless earbuds product film'], creators['Kabir Malhotra'], 'Interested in bringing a music-video energy to our earbuds film?', 'declined');
  await upsertInvitation(m['Regional recipe reels'], creators['Meera Kulkarni'], 'Would you consider a food brief? Your product films have the texture we are after.', 'pending');

  // Projects (exactly one per accepted pair)
  const p1 = await createProjectFromSource({ campaign: spf, creatorId: creators['Meera Kulkarni']._id, sourceType: 'application', sourceId: acceptedApp._id });
  await createProjectFromSource({
    campaign: n['Studio headphones lookbook'], creatorId: creators['Sana Qureshi']._id, sourceType: 'invitation', sourceId: acceptedInv._id,
  });
  // Show some progress on the first project (only if untouched, so reseeding keeps manual changes).
  if (p1.status === 'not_started') {
    await Project.updateOne(
      { _id: p1._id },
      { $set: { status: 'in_progress', 'deliverables.0.status': 'submitted', 'deliverables.0.mediaUrl': media('verdant-spf-vertical-v1', 'mp4') } },
    );
  }

  const counts = {};
  for (const [name, model] of Object.entries({ users: User, creatorProfiles: CreatorProfile, brandProfiles: BrandProfile, portfolioItems: PortfolioItem, campaigns: Campaign, applications: Application, invitations: Invitation, projects: Project })) {
    counts[name] = await model.countDocuments();
  }
  console.table(counts);
  console.log(`Demo accounts use password from SEED_DEMO_PASSWORD. Example creator: meera-kulkarni@creators.unio.example · brand: team@verdant.unio.example`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
