# UNIO — Round 2 Build Guide (for Claude Code)

> **Who this is for:** Claude Code, working inside the existing UNIO repository (`fawazahmed-byte/Unio`).
> **Goal:** turn the working Round 1 MERN app into the Round 2 product — the screens in `design/UNIO-design-v9.html` with every feature working on real data.
> **Deadline:** demo on **Saturday 24 Oct 2026**. Code freeze **Friday 23 Oct, 8 pm IST**.
> **Owner / decision maker:** Fawwaz. Azure hosting is set up in parallel by a teammate (see section 12).

---

## 0. How to work through this guide

Read sections 1–7 once before writing any code. Then build **one phase at a time** (section 11). For every phase:

1. **Plan first.** Read the phase, the feature spec it points to, and the v9 screens it lists. Open the screenshot(s) in `design/screens/` and the matching `S2.<ID>=` function inside `design/UNIO-design-v9.html`. Write a short plan (files to touch, schema changes, endpoints, UI pieces) and show it to Fawwaz before large changes.
2. **Backend before frontend.** Model → validator (Zod) → service → controller → route → test. Then the API client in `client/src/services/api.js`, then the page.
3. **Keep Round 1 working.** All 50 existing server tests must stay green (`npm test`). Never remove a working flow (apply, invite, accept → project, verification, AI brief, matching) — extend it.
4. **Add tests** for every new rule (status transitions, permissions, validation). Use the existing helpers in `server/tests/helpers.js` (in-memory replica set via `mongodb-memory-server`).
5. **Check the UI** at 1440 px and 390 px against the screenshot. Every list needs loading, empty, error and success states (Round 1 already does this — keep the habit).
6. **Commit after each phase** with a clear message (`feat(f6): deliverable versions + feedback notes`). Small commits; never one giant commit.
7. **Stop and ask Fawwaz** when: a requirement here is unclear, a change would break a Round 1 rule, a migration would delete data, or you want to add a new npm dependency not listed in this guide.

**Definition of done for a phase:** tests pass · the screen matches v9 (layout, colours, type, states) · works on phone width · no console errors · seed data shows the feature · committed.

**Priority if time runs short** (do not skip ahead): Must = Phases 0–6 and 11 · Should = 7–8 · Could = 9–10. Fawwaz decides cuts.

---

## 1. Product overview

UNIO is an India-first marketplace where **brands and agencies hire AI content creators** (AI filmmakers, AI video creators, animators, graphic designers, thumbnail designers, UGC/avatar creators, 3D artists, motion designers…). It was built for the Kampus.VC problem statement at HacXLerate 2026.

**What makes Round 2 different** (the story the demo tells — "Every frame has a story. UNIO shows it."):

| # | Feature | One line |
|---|---|---|
| F1 | Profiles & portfolios | Creators show *how* each piece was made (tool chain, generations, versions), skills backed by work, and are found through rich filters. |
| F2 | Brand & agency workspaces | One dashboard for brands; agencies additionally manage clients, tag campaigns by client and send a no-login approval link. |
| F3 | AI brief builder | One line in → full structured brief (content type, formats, style, language, budget, deliverables, rights). "I want something like this" starts a brief from any portfolio piece. |
| F4 | Matching | Explainable score (0–100) with a per-signal breakdown and plain reasons; verified tools count full, self-reported half. |
| F5 | UNIO Trust | Five trust levels: Self-reported → Pending → Certified → Verified → ★ Made on UNIO. Tool verification by a one-time challenge code on a screen recording; certificates with a verify link; badges expire after 12 months. |
| F6 | Projects | Deliverables have versions (v1, v2, v3…). Requesting changes needs a written note (≥ 10 chars). Project messages tagged "about v2". Final delivery hands over the files plus a Rights & usage card. |
| F7 | Licensing | Every brief answers 7 rights questions (usage, region, duration, exclusivity, commercially-safe tools, AI label, real likeness). At completion the project gets a Rights & usage card. It is a plain-language summary, **not a legal contract** — say so in the UI. |

**Users (roles):**

| Role in DB (`users.role`) | Who | Notes |
|---|---|---|
| `creator` | AI content creator | Self-serve sign-up. |
| `brand` | Brand **or agency** | Self-serve. Agencies are `role: 'brand'` with `BrandProfile.accountType: 'agency'` — so every existing `requireRole('brand')` guard keeps working. |
| `reviewer` | UNIO trust reviewer | **Never** on the sign-up page. Created only by `npm --prefix server run create-reviewer -- <email> "Name"` (uses `REVIEWER_PASSWORD`). |
| (no account) | Agency's client approver | Uses a one-time approval link (F2, Phase 9). |

Honesty rules that already exist and must stay: no fabricated signals (verified, ratings, counts come only from real records) · the server decides role/ownership from the session, never from the request body · nothing is sent without a review step · demo numbers on public pages must be real counts or removed.

---

## 2. The existing codebase (Round 1) — what is already there

Repository root: `client/` (React app) and `server/` (Express API), plus root `package.json` scripts (`dev`, `dev:memory`, `seed`, `test`, `build`). One commit today (`c5083a7`). About 9,700 lines.

### 2.1 Stack (keep it — no framework changes)

| Layer | Tech (installed versions) |
|---|---|
| Frontend | React 19.3, Vite 8, Tailwind CSS 4.3 (tokens in `@theme`), React Router 8.4 (`createBrowserRouter`, lazy dashboard routes), TanStack Query 5, React Hook Form + Zod 3, lucide-react icons |
| Backend | Node ≥ 20.6 (22 LTS in production), Express 5.3 (ES modules), Mongoose 9.11, Zod 4.6, jsonwebtoken + cookie-parser (7-day JWT in HTTP-only cookie `unio_session`), bcryptjs, helmet, cors, express-rate-limit, `@anthropic-ai/sdk` |
| Database | MongoDB (Atlas today → Azure Cosmos DB for MongoDB vCore in Round 2; same driver, only `MONGODB_URI` changes) |
| Tests | `node --test`, Supertest, `mongodb-memory-server` (replica set, so transactions work) |
| Hosting today | Vercel (client, rewrites `/api/*`) + Render (API). Round 2 → one Azure App Service (section 12). |

### 2.2 Server layout and conventions

```
server/src/
  app.js            helmet → cors (CLIENT_ORIGIN allowlist, credentials) → json(100kb) → cookieParser → /api routes → notFound → errorHandler
  server.js         connectDB() then listen(env.port)
  config/env.js     all env reads live here (PORT, MONGODB_URI, CLIENT_ORIGIN, TRUST_PROXY, JWT_SECRET, COOKIE_NAME, ANTHROPIC_API_KEY, BRIEF_AI_MODEL, OPENROUTER_*, DNS_SERVERS)
  config/db.js      mongoose.connect with SRV DNS fallback
  models/           User, CreatorProfile, BrandProfile, PortfolioItem, Campaign, Application, Invitation, Project, VerificationSubmission + enums.js
  validators/       Zod schemas per endpoint (strip unknown keys, coerce query numbers); parsed values land on req.valid
  middleware/       auth.js (requireAuth, optionalAuth, requireRole, cookieOptions), validate.js, rateLimit.js, errors.js
  services/         business rules, one file per domain (applications, auth, briefBuilder, campaigns, creators, invitations, matching, profile, projects, verification, serializers)
  controllers/      thin HTTP adapters (auth, brand, creator, project, public, verification)
  routes/index.js   EVERY route in one file, guards inline
  utils/            ApiError, http.ok(), db.withTransaction()
server/scripts/     seed.js (idempotent demo data), dev-memory.js, create-reviewer.js
server/tests/       api, verification, briefBuilder, seed (+ helpers.js)
```

Rules to follow for all new code (same as Round 1):

- Response shape: `{ success: true, data }` via `ok(res, data)`; errors via `throw new ApiError(status, CODE, message, details)` → central handler returns `{ success:false, error:{ code, message, details } }`.
- Wrong role → **403**; someone else's record → **404** (never confirm a hidden record exists); duplicates / bad transitions → **409** with a specific code.
- Writable fields are whitelisted by Zod. `brandId`, `creatorId`, `userId`, `status` (when server-controlled) always come from the session/service, never from the body.
- Multi-document changes go through `withTransaction()` with conditional updates (see how accepting an application creates exactly one project).
- Lists: `page`, `limit` (max 50) → `{ items, page, limit, total, totalPages }`.
- All env reads go through `config/env.js`. Secrets never in `VITE_*` variables.

### 2.3 Data model today (9 collections)

| Collection | Key fields today |
|---|---|
| `users` | name, email (unique), passwordHash (select:false), role ∈ creator/brand/reviewer |
| `creatorProfiles` | userId (unique), displayName, bio, photoUrl, location, skills[], tools[], specialties[], startingPrice (INR), availability ∈ available/busy/unavailable, featured, isDemo |
| `brandProfiles` | userId (unique), companyName, logoUrl, websiteUrl, industry, description, isDemo |
| `portfolioItems` | creatorId, title, description, mediaType ∈ image/video, mediaUrl (required URL), thumbnailUrl, tools[], category, featured |
| `campaigns` | brandId (User), title, brief (≤5000, objective/audience/style are labelled sections inside it), category, budgetMin/Max, deadline, requiredSkills[], requiredTools[], deliverables[{title, description, quantity}], status ∈ draft/open/closed |
| `applications` | campaignId, creatorId, proposal, proposedPrice, status ∈ pending/accepted/rejected/withdrawn — unique {campaignId, creatorId} |
| `invitations` | campaignId, brandId, creatorId, message, status ∈ pending/accepted/declined/cancelled — unique {campaignId, creatorId} |
| `projects` | campaignId, brandId, creatorId, sourceType/sourceId, status ∈ not_started/in_progress/submitted/revision_requested/completed/cancelled, deliverables[{title, description, dueDate, mediaUrl, status ∈ pending/submitted/approved/revision_requested}], feedback{rating 1–5, comment} — unique {campaignId, creatorId} |
| `verificationSubmissions` | creatorId, type ∈ tool/workflow/portfolio, key (e.g. `tool:kling`, unique per creator), subject, portfolioItemId, description, evidenceUrls[], status ∈ SELF_REPORTED/PENDING/VERIFIED/REJECTED, reviewerId, reviewNote, reviewedAt |

### 2.4 API today (base `/api`)

Auth: `POST /auth/register` (role creator|brand), `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
Public: `GET /creators` (search, skills, tools, availability, price, sort), `GET /creators/:id`, `GET /campaigns`, `GET /campaigns/categories`, `GET /campaigns/:id`, `POST /campaigns/:id/applications` (creator).
Creator: `GET|PUT /creator/profile`, `GET|POST /creator/portfolio`, `PUT|DELETE /creator/portfolio/:id`, `GET /creator/applications`, `PATCH /creator/applications/:id/withdraw`, `GET /creator/invitations`, `PATCH /creator/invitations/:id/respond`, `GET /creator/projects`.
Brand: `GET|PUT /brand/profile`, `GET|POST /brand/campaigns`, `GET|PUT /brand/campaigns/:id`, `PATCH /brand/campaigns/:id/status`, `GET /brand/campaigns/:id/applications`, `GET /brand/campaigns/:id/recommendations`, `POST /brand/campaigns/:campaignId/invitations`, `POST /brand/briefs/draft` (AI, 10 per 15 min), `GET /brand/applications`, `PATCH /brand/applications/:id/status`, `GET /brand/invitations`, `PATCH /brand/invitations/:id/cancel`, `GET /brand/projects`.
Verification: `GET|POST /creator/verifications`, `PUT|DELETE /creator/verifications/:id`, `GET /review/verifications`, `PATCH /review/verifications/:id` (reviewer; reject needs note ≥ 10).
Projects: `GET /projects/:id`, `PATCH /projects/:id/status`, `PATCH /projects/:id/deliverables/:deliverableId`, `POST /projects/:id/feedback`.

### 2.5 Client layout

```
client/src/
  app/            App.jsx, providers.jsx (QueryClient, Auth, Toast), router.jsx (public routes eager, dashboards lazy)
  components/
    layout/       Layouts.jsx (RootLayout = public header/footer, DashboardLayout = sidebar), ProtectedRoute.jsx (+ GuestOnly), SiteHeader, SiteFooter
    ui/           Avatar, Badge, Button(+ButtonLink), Dialog, Feedback (Loading/Empty/Error), Form, Logo, MediaFrame, Pagination, SearchField, Toast
    creators/     CreatorCard        portfolio/ PortfolioGrid      campaigns/ AiBriefBuilder, CampaignRow
    applications/ ApplicationCard, ApplyDialog      invitations/ InviteDialog      verification/ VerificationBadge     dashboard/ Kit
  context/AuthContext.jsx         services/api.js (the ONLY place that calls fetch; BASE_URL = VITE_API_URL || '/api')
  hooks/ useUrlFilters (filters live in the URL), useDocumentTitle
  lib/ format.js, status.js (status labels/tones), taxonomy.js (SKILLS, TOOLS, CATEGORIES — suggestions only today), returnTo.js
  pages/ public/ (Home, Creators, CreatorDetail, Campaigns, CampaignDetail, About, AuthPages, NotFound)
         creator/ (Dashboard, ProfileEdit, Portfolio, Applications, Invitations, Verification)
         brand/ (Dashboard, Campaigns, CampaignFormPage, CampaignApplicants, Applications, Invitations, Profile)
         review/ReviewQueue.jsx      shared/ (ProjectDetail, ProjectsList)
  styles/index.css  Tailwind import + @theme tokens (Round 1 "forest" palette — REPLACED in Phase 1)
```

Round 1 design (forest green, Fraunces + Inter Tight) is **retired**. Round 2 uses the Steel design in section 3.

---

## 3. Design system — "Steel" (from v9)

**Source of truth:** `design/UNIO-design-v9.html` (open it in a browser; pick screens with the dropdown, toggle Desktop/Phone) and the screenshots in `design/screens/`. The CSS at the top of the v9 file (`:root` tokens, `.btn`, `.card`, `.tc`, `.chain`, `.ladder`, `.ring`, `.ticket`, `.film`, `.cc`, `.side` …) is the reference implementation — translate it to Tailwind utilities/components, do not paste the prototype's global CSS wholesale. The prototype's screens are JS functions named `S2.P1`, `S2.P2`, `S2.B3`, … — search for `S2.<ID>=` to read a screen's exact markup and copy.

**The final website must look like v9.** Match layout, spacing, colours, type, components and copy. Data is real (from the API) instead of the prototype's demo arrays. The CSS-drawn artworks in v9 (`.art.a-serum`, `.a-ugc`…) are **placeholders** for real thumbnails — in the app use `MediaFrame` with the real `thumbnailUrl/mediaUrl`, and keep Round 1's fallback composition for missing media (restyled in Steel colours).

### 3.1 Palette (finalised — do not invent new colours)

Darkness carries hierarchy. `#11212D` is the action colour on light backgrounds; `#CCD0CF` is the action colour on dark. `#9BA8AB` only on dark surfaces or as a line. Functional colours appear only for status.

| Token | Hex | Use |
|---|---|---|
| `ink` | `#06141B` | Darkest: hero backgrounds, footer, headings, ticket start |
| `navy` | `#11212D` | Primary buttons, sidebar, dark cards, verified tool chips, selected states |
| `slate` | `#253745` | Gradients, borders on dark, secondary dark |
| `steel` | `#4A5C6A` | Muted text on light, eyebrow labels, light-weight heading words (`<em>`) |
| `mist` | `#9BA8AB` | Muted text **on dark**, dividers on dark |
| `bone` | `#CCD0CF` | Primary button on dark, sidebar active item, selected text on dark |
| `page` | `#EEF0EF` | App/page background |
| `card` | `#FFFFFF` | Cards, header bar |
| `line` | `#D9DDDC` | Card borders; `line2` `#C4CACB` stronger borders/inputs; `soft` `#F5F6F6` subtle fills |
| `ok` / `ok-bg` / `ok-ln` | `#2F6B4F` / `#E3F0E8` / `#9CC7B0` | Verified, approved, available, success |
| `wait` / `wait-bg` / `wait-ln` | `#7A4F00` / `#FBECC8` / `#ECC977` | Pending, review needed, warnings |
| `att` / `att-bg` / `att-ln` | `#9B2C3A` / `#F8DFE2` / `#E7A9B3` | Changes requested, rejected, danger |
| `info` / `info-bg` / `info-ln` | `#1D4A6E` / `#DDE9F3` / `#A9C6DE` | In progress, shortlisted |
| `ai` / `ai-bg` / `ai-ln` | `#3B4F9A` / `#E6EAF7` / `#B7C1E6` | Anything AI-generated/filled (AI mark, AI-filled brief fields) |
| `gold` | `#B8862A` (+ `#E9C46A` on dark) | ★ Made on UNIO only; highlighted stat outline |

The **logo** is the only multi-colour element (violet→cyan mark). Never reuse the logo's purple/cyan for UI. Files: `design/logo/unio-logo-on-light.png` (ink text, for light headers), `unio-logo-on-dark.png` (white text, for dark heroes/sidebar/footer), `unio-mark.png` (icon only → favicon/app icon). Copy them to `client/public/` and update `components/ui/Logo.jsx` to pick the variant by background.

### 3.2 Type

- **Manrope** 300–800 for everything (headings 800, tight letter-spacing −0.03 to −0.05em; the light "accent" word inside a heading is weight 300 in `steel`, e.g. "AI creators, *proven.*").
- **JetBrains Mono** 400/500/700 for eyebrows (10.5–11px, uppercase, letter-spacing .14–.16em), codes (`UNIO-7F3K`), versions (`v3`), small labels.
- Replace the Google Fonts link in `client/index.html` with: `https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap`.
- Sizes: page title 38–44px (30 on phone), hero 68–72px (40–42 on phone), section titles 34–40px, card titles 15–17px, body 14px, small 12.5px.

### 3.3 Replace `client/src/styles/index.css` tokens (Phase 1)

```css
@theme {
  --color-ink:#06141b; --color-navy:#11212d; --color-slate:#253745; --color-steel:#4a5c6a;
  --color-mist:#9ba8ab; --color-bone:#ccd0cf; --color-page:#eef0ef; --color-card:#ffffff;
  --color-line:#d9dddc; --color-line2:#c4cacb; --color-soft:#f5f6f6;
  --color-ok:#2f6b4f; --color-ok-bg:#e3f0e8; --color-ok-ln:#9cc7b0;
  --color-wait:#7a4f00; --color-wait-bg:#fbecc8; --color-wait-ln:#ecc977;
  --color-att:#9b2c3a; --color-att-bg:#f8dfe2; --color-att-ln:#e7a9b3;
  --color-info:#1d4a6e; --color-info-bg:#dde9f3; --color-info-ln:#a9c6de;
  --color-ai:#3b4f9a; --color-ai-bg:#e6eaf7; --color-ai-ln:#b7c1e6;
  --color-gold:#b8862a; --color-gold-lt:#e9c46a;
  --font-sans:'Manrope', ui-sans-serif, system-ui, sans-serif;
  --font-mono:'JetBrains Mono', ui-monospace, monospace;
  --radius-sm:4px; --radius-md:8px; --radius-lg:14px; --radius-xl:20px;
  --shadow-card:0 1px 2px rgba(6,20,27,.05),0 8px 24px -16px rgba(6,20,27,.35);
  --shadow-pop:0 2px 4px rgba(6,20,27,.06),0 24px 48px -24px rgba(6,20,27,.45);
}
```

Remove `forest/sage/mint/sand/beige/ivory/muted/danger` and `--font-display`; then fix every usage (grep for `forest`, `ivory`, `sage`, `mint`, `sand`, `beige`, `muted`, `font-display`). Body: `bg-page text-ink font-sans`. Headings: `font-sans font-extrabold tracking-tight`. Focus ring: 2px `navy`.

### 3.4 Component kit (build these in `components/ui/` first — every page uses them)

| Component | Spec (see v9 class) |
|---|---|
| `Button` | Pill (`rounded-full`), heights 34/42/50. Variants: `primary` navy→ink on hover · `secondary` navy outline · `ghost` · `light` (bone, for dark backgrounds) · `outline-light` (on dark) · `success` (ok) · `danger` (att outline on white). (`.btn`) |
| `Card` | White, 1px `line`, radius 14; `dark` variant navy. Section header row `.sec-h` (title left, link right, bottom border). |
| `Pill` (status) | Rounded, 1px border, dot + label; tones ok/wait/att/info/neutral/dark/ai. Map every status in `lib/status.js` to a tone. (`.pill`) |
| `ToolChip` | Trust state of a tool: **verified** = navy fill, white text, green ✓ · **certified** = white, navy border, clip icon · **pending** = wait colours, clock icon · **self-reported** = white, grey border, steel text. Tooltip text: "Verified by UNIO", "Certificate checked", "Review pending", "Self-reported". (`.tc`) |
| `MadeOnUnio` badge | Ink→slate gradient, gold "★ Made on UNIO · N". (`.tc.m`, `.lvl.lv5`) |
| `ToolChain` | Workflow as connected pills `Midjourney → Kling ✓ → Runway ✓ → CapCut`; verified steps green. (`.chain`) |
| `TrustLadder` | 5 segments + labels Self · Pending · Certified · Verified · ★ Made; filled up to level; dark variant for dark cards. (`.ladder`, `.ladder-dk`) |
| `TrustLevelTag` | Small mono tag per level (lv1 grey outline … lv4 navy … lv5 gradient gold text). (`.lvl.lvN`) |
| `MatchRing` | Conic ring with score number (sizes 46/56/84, dark variant). (`.ring`) |
| `ScoreBars` | Label · bar · value rows (used for match breakdown). Half-weight bars in `mist`. (`.bars/.bar`) |
| `Reasons` | Green ✓ list of plain reasons. (`.reasons`) |
| `RightsStrip` | One-line rights summary with lock icon, dashed border (`.bc-r`) — on every brief card. |
| `RightsTicket` | Dark gradient "ticket" with side notches, perforation line, stamp (`RIGHTS` / `LICENSED`), definition list of rights. (`.ticket`) |
| `VersionTimeline` | Vertical v1→v2→v3 with note + status; current version highlighted wait/amber. (`.tl-v/.tv`) and filmstrip grid of versions (`.film`). |
| `CreatorCard` | 8 parts: (1) thumbnail with content-type label + "★ N on UNIO" corner tag, (2) avatar, name, city, availability dot, (3) rating **or** match ring, (4) headline skill, (5) tool chips with trust state, (6) tool chain, (7) "From ₹X / piece", (8) trust level tag. (`.cc`, see `ccard()` in v9) |
| `BriefCard` | Brand logo tile, title, client "via Agency", match ring, deliverable/deadline tags, RightsStrip, tools, budget range. (`.bc`) |
| `StatTile` | Variants: navy, bone, grey, white, gold-outline highlight. (`.stat`) |
| `AiMark` | Mono "AI" tag in ai colours; AI-filled form fields get the ai tint. (`.ai-mark`, `.input.ai`, `.bf.ai`) |
| Form inputs | Height 44, radius 8, border `#9AA5AA`; chip selectors (`.chipsel`, selected = navy); segmented control (`.seg`); checkbox rows with counts (`.chk`). |

### 3.5 Layout shells

- **Public pages** (`RootLayout`): white header 68px — logo, nav **Discover · Campaigns · How it works**, right: Sign in (ghost) + Join UNIO (primary). On dark heroes the header is transparent with light logo. Footer: ink background, light logo, three link columns (Brands / Creators / Company), bottom row "© 2026 UNIO · Made in India". Content max width 1240px, side padding 40px (16px on phone).
- **App pages** (`DashboardLayout`): 262px **navy sidebar** — light logo; workspace card (brand name / agency name + client `<select>` / creator name + trust level / reviewer); mono section labels WORKSPACE / ACCOUNT; nav items with icon, count badge; active item = bone background with ink text. White top bar 68px: breadcrumb (`Workspace / **Overview**`), bell, primary CTA (brand: "New brief with AI", agency: "New brief for…", creator: "Add work"). Body padding 28px 36px. Phone: sidebar hidden, bottom tab bar (navy) with the first 5 items.
- **Page header** (`.ph`): mono eyebrow, 38px title, one-line subtitle, actions right.
- **Banner** (`.banner`): ink→navy→slate gradient, "what needs you today" message + light button. Used on dashboards.

### 3.6 Sidebar navigation per role

| Role | WORKSPACE | ACCOUNT |
|---|---|---|
| Brand | Overview · Campaigns · Applicants (n) · Recommended · Projects (n) · Messages (n) | Brand profile |
| Agency | Overview · Campaigns · Applicants · Recommended · Projects · Client approvals (n) | Clients · Agency profile |
| Creator | Dashboard · Find campaigns · Applications (n) · Projects (n) · Messages (n) · Invitations | Edit profile · Portfolio · UNIO Trust |
| Reviewer | Verification queue (n) · Trust rules | — |

(Round 1 pages Brand Applications, Brand/Creator Invitations stay — add them to the nav and restyle with the kit.)

### 3.7 Copy & tone

Short, plain, specific. Eyebrows in mono caps. Use the v9 wording (e.g. "Say it in one line. *We'll write the brief.*", "Work you can trace back.", "Make it. Prove it. License it."). Never name competitors. Never show invented statistics — remove a stat rather than fake it.

---

## 4. Page map — v9 screen → route → file → work

Screenshots: `design/screens/<ID>-*.jpg`. Phone samples: `phone-P1/P2/B3/S1.jpg`.

| v9 | Screen | Route | File (existing → new) | Work |
|---|---|---|---|---|
| P1 | Home ("anatomy of a piece") | `/` | `pages/public/HomePage.jsx` | Rebuild to v9 (hero with labelled piece, marquee, "What are you here to do?" tabs, proof wall from featured portfolio items, journey band, closing CTA). |
| P2 | Discover creators | `/creators` | `CreatorsPage.jsx` | Rebuild: category rail (12), facet panel with counts, active-filter chips, sort, 8-part cards, mobile "Filters" toggle. Filters in URL (`useUrlFilters`). |
| P3 | Creator profile | `/creators/:id` | `CreatorDetailPage.jsx` | Banner, sticky identity card (trust ladder, stats, Invite / Message), tabs, tools with proof, featured work grid, How I work steps, Skills backed by work, Trust card, Reviews. |
| P3W | Portfolio piece | `/creators/:id/work/:itemId` | **new** `PortfolioPiecePage.jsx` | Player/image, version tabs, fact tiles, How it was made timeline, Brief vs delivered, rights notice, "I want something like this", versions & feedback filmstrip. |
| P4 | Campaigns | `/campaigns` | `CampaignsPage.jsx` | Brief cards with match ring (for signed-in creators), RightsStrip, filter chips. |
| P5 | Campaign + apply | `/campaigns/:id` | `CampaignDetailPage.jsx` + `ApplyDialog` | Fact tiles, AI-structured deliverables, style + tools, RightsTicket, sticky apply panel with "You're a strong match" reasons, rights checkbox. |
| P6 | How it works | `/how-it-works` (redirect `/about`) | `AboutPage.jsx` → rename | Trust levels, challenge code explainer, honest limits, 8 rights questions. |
| P7 | Sign in | `/login` | `AuthPages.jsx` | Split screen (dark quote + art left, form right). |
| P8 | Join | `/register` | `AuthPages.jsx` | Role cards Creator/Brand/Agency; **different fields per role** (section 6.1); "After sign-up · 3 quick steps". |
| P9 | Not found | `*` | `NotFoundPage.jsx` | Restyle. |
| B1 | Brand overview | `/brand/dashboard` | `BrandDashboard.jsx` | Banner, 4 stat tiles, projects table, top matches, campaigns. |
| B2 | Campaigns | `/brand/campaigns` | `BrandCampaigns.jsx` | Table with deliverables, rights, budget, applicants; tabs Live/Drafts/Closed. |
| B3 | AI brief builder | `/brand/campaigns/new` (+ `/:id/edit`) | `CampaignFormPage.jsx` + `AiBriefBuilder.jsx` | Split screen: idea + AI questions left, live brief right with AI-tinted fields, warnings, Commercial use (rights) block, Publish. |
| B4 | Applicants + match | `/brand/campaigns/:id/applicants` | `CampaignApplicants.jsx` | Rows sorted by match; expanded row shows pitch, samples, score bars. |
| B5 | Recommended creators | `/brand/campaigns/:id/matches` | **new** `CampaignMatches.jsx` (move "Suggested creators" here) | Top match hero card with full breakdown + reasons + warnings; 3 more cards. |
| B7 | Projects board | `/brand/projects` | `ProjectsList.jsx` | Kanban by status (In progress / Review needed / Changes requested / Completed). |
| B8 | Brand profile + kit | `/brand/profile` | `BrandProfile.jsx` | Profile form + Brand kit (colours, fonts, tone, never-do, assets) + "What creators see" preview. |
| A1 | Agency overview | `/brand/dashboard` when `accountType=agency` | `BrandDashboard.jsx` (agency branch) | Client strip, stats incl. "Awaiting client", waiting-on-client list, projects with Client column + client tabs. |
| A2 | Clients | `/brand/clients` | **new** `AgencyClients.jsx` | Client cards (colour tag, counts, approver, approval link on/off), add/edit client dialog. |
| A3 | Client approval (no login) | `/approve/:token` | **new** `ClientApprovalPage.jsx` | Minimal page: video, "what changed", Approve / Request changes (note ≥ 10). |
| C1 | Creator dashboard | `/creator/dashboard` | `CreatorDashboard.jsx` | Banner (latest feedback), stats, matched campaigns, trust card, profile strength. |
| C2 | Edit profile | `/creator/profile/edit` | `CreatorProfileEdit.jsx` | Basics, What you make (category, also-do, content types, specializations, styles, skills with proof counts), formats/languages/turnaround/price, tools with trust state, default workflow, pricing & availability; sticky live card preview. |
| C3 | Portfolio + add piece | `/creator/portfolio` | `CreatorPortfolio.jsx` | Grid with "Workflow added / Add workflow" pills; Add-piece panel with upload/link, fields, How it was made steps. |
| C4 | Applications | `/creator/applications` | `CreatorApplications.jsx` | Table with match %, price, rights, status pill. |
| C6 | Projects | `/creator/projects` | `ProjectsList.jsx` | Project cards. |
| C7 | UNIO Trust | `/creator/verification` | `CreatorVerification.jsx` | Trust header (level + score ring), summary tiles, verify-a-tool stepper with challenge code, your tools list, certificates. |
| S1/S2 | Project (brand / creator view) | `/projects/:id` | `ProjectDetail.jsx` | Dark header (status, due, revisions used, rights), 5-step tracker, deliverable with version timeline + decision box (brand) or submit-version form (creator), other deliverables, messages panel. |
| S3 | Final delivery + rights card | `/projects/:id` when completed (section) or `/projects/:id/delivery` | `ProjectDetail.jsx` / **new** `ProjectDelivery.jsx` | Completed header, final files, rate creator, RightsTicket with number, Download/Print. |
| R1 | Verification queue | `/review` | `ReviewQueue.jsx` | Left queue list, right evidence viewer (recording, code overlay, screenshots), pre-check checklist, reason box, Approve (sets 12-month expiry) / Reject / Ask for more. |

---

## 5. Data model changes

All changes are **additive** (new optional fields with defaults) so existing documents and the 50 tests keep working. Write a one-off migration script only where noted.

### 5.1 Shared taxonomy (controlled lists — no free text)

Create `server/src/models/taxonomy.js` exporting the lists below as `[{ id, label }]` (ids are stable slugs stored in the DB; labels are display text). Serve them at `GET /api/taxonomy` (public, cache headers 1 h). The client loads them once with TanStack Query (`staleTime: Infinity`) — replace the free-text suggestions in `client/src/lib/taxonomy.js` with this. Validators accept only known ids (`z.enum(ids)`).

**Creator categories (12)** — `category` (one) + `secondaryCategories` (max 2):
`filmmaker` AI Filmmakers · `video` AI Video Creators · `animator` AI Animators · `graphic` AI Graphic Designers · `thumb` AI Thumbnail Designers · `photo` AI Product Photographers · `ugc` UGC & AI Avatar Creators · `3d` AI 3D Artists · `motion` AI Motion Designers · `music` AI Music Video Artists · `voice` AI Voice & Audio · `illus` AI Illustrators. Each also has a one-line description (from v9 `TAX.cat`) shown on the Discover rail.

**Content types (14)** `contentTypes[]`: `short` Short-form video (Reels/Shorts) · `long` Long-form / film · `ad` Video ad · `ugcv` UGC / testimonial · `avatar` AI avatar / presenter · `anim` Animation · `static` Social post / graphic · `thumb` Thumbnail / cover art · `poster` Poster / print · `photo` Product photos · `render3d` 3D render / spin · `motion` Motion graphics · `musicvid` Music video · `audio` Voice-over / audio.

**Specializations / industries (14)** `specializations[]`: `beauty` Beauty & skincare · `food` Food & beverage · `fashion` Fashion · `d2c` D2C / e-commerce · `tech` Tech & SaaS · `finance` Finance · `education` Education · `youtube` YouTube creators · `gaming` Gaming · `music` Music & entertainment · `travel` Travel · `realestate` Real estate · `weddings` Weddings & events · `kids` Kids & family. (Campaign `category` uses this same list from now on; map Round 1 campaign categories: Beauty→beauty, Fashion→fashion, Food & Beverage→food, Electronics/Tech→tech, Travel→travel, Education→education, Music→music, D2C→d2c, Wellness/Lifestyle/Hospitality→d2c — confirm with Fawwaz.)

**Skills (15)** `skills[]`: `prompt` Prompt engineering · `story` Storyboarding · `script` Scriptwriting · `consist` Character consistency · `lipsync` Lip-sync · `vclone` Voice cloning · `grade` Colour grading · `comp` Compositing · `upscale` Upscaling · `edit` Video editing · `kinetic` Kinetic typography · `roto` Rotoscoping · `model3d` 3D modelling · `regional` Regional-language VO · `ctr` Thumbnail CTR design.

**Tools (17+)**: Kling, Runway, Veo, Midjourney, Flux, ComfyUI, HeyGen, ElevenLabs, Suno, Blender, After Effects, CapCut, Photoshop, Canva, Premiere Pro, DaVinci Resolve, Lightroom (+ keep Round 1's Pika, Stable Diffusion, Firefly, Figma). Tools stay **names** (strings) to match `verificationSubmissions.key = tool:<lowercase>`.

**Styles (8)** `styles[]`: `cine` Cinematic · `real` Photoreal · `anime` Anime · `cartoon` 3D cartoon · `flat` Flat / minimal · `retro` Retro / vintage · `festive` Indian festive · `bold` Bold / high-contrast.

**Formats** `formats[]`: `9:16`, `16:9`, `1:1`, `4:5`. **Languages**: Hindi, English, Tamil, Telugu, Marathi, Bengali, Malayalam, Gujarati, Punjabi, Kannada, Urdu (+ Odia, Assamese).

Seed data and `seed.js` must be migrated to these ids (Round 1 free-text skills like "AI Video" map to category/contentTypes; do the mapping in the seed, not at runtime).

### 5.2 `users` — unchanged. `role` stays creator/brand/reviewer.

### 5.3 `creatorProfiles` — add

```js
headline:            { type: String, trim: true, maxlength: 140, default: '' },
category:            { type: String, enum: CATEGORY_IDS, index: true },          // required for new sign-ups
secondaryCategories: { type: [{ type: String, enum: CATEGORY_IDS }], default: [] }, // max 2 (validator)
contentTypes:        { type: [{ type: String, enum: CONTENT_TYPE_IDS }], default: [] },
specializations:     { type: [{ type: String, enum: SPECIALIZATION_IDS }], default: [] }, // replaces free-text specialties (keep old field, stop writing it)
styles:              { type: [{ type: String, enum: STYLE_IDS }], default: [] },
formats:             { type: [{ type: String, enum: FORMAT_IDS }], default: [] },
languages:           stringList,
turnaroundDays:      { type: Number, min: 1, max: 60 },
revisionsIncluded:   { type: Number, min: 0, max: 10, default: 2 },
workflow:            { type: [{ type: String, trim: true, maxlength: 40 }], default: [] }, // default tool chain shown on the card, ordered
howIWork:            { type: [{ title: String, detail: String }], default: [] },       // max 6 steps
commerciallySafe:    { type: Boolean, default: false },  // "I can deliver with commercially-licensed tools only"
// Denormalised trust (recomputed by trust.service — never written by the client):
verifiedTools:       stringList,    // tool names with a VERIFIED, non-expired tool claim
certifiedTools:      stringList,    // tool names with a VERIFIED certificate claim
pendingTools:        stringList,
madeOnUnioCount:     { type: Number, default: 0 },   // completed projects on UNIO
ratingAvg:           { type: Number }, ratingCount: { type: Number, default: 0 },
trustLevel:          { type: Number, min: 1, max: 5, default: 1, index: true },
```

Indexes: `category`, `secondaryCategories`, `contentTypes`, `specializations`, `skills`, `tools`, `verifiedTools`, `styles`, `languages`, `startingPrice`, `trustLevel`. `skills` now holds skill **ids**.

**Trust level rule** (`trust.service.recomputeCreatorTrust(creatorId)`): 5 = ≥ 1 verified non-expired tool **and** `madeOnUnioCount ≥ 1` · 4 = ≥ 1 verified non-expired tool · 3 = ≥ 1 certified tool/certificate · 2 = any PENDING claim · 1 = otherwise. Call it after: reviewer decision, project completion, claim create/delete, nightly-style lazy check on read if an `expiresAt` has passed (cheap: compare dates when serving the profile).

**Skill proof counts:** a skill counts as "backed" when ≥ 1 portfolio item of the creator lists it (`portfolioItems.skills`). Public serializers hide skills with 0 pieces and show "N pieces" next to each.

### 5.4 `brandProfiles` — add (agency support + brand kit)

```js
accountType: { type: String, enum: ['brand', 'agency'], default: 'brand', index: true },
contactName: { type: String, trim: true, maxlength: 120 }, jobTitle: { type: String, trim: true, maxlength: 80 },
teamSize:    { type: String, enum: ['1', '2-10', '11-50', '50+'] },
clients: [{  // agencies only
  name: { type: String, required: true, trim: true, maxlength: 120 },
  industry: { type: String, enum: SPECIALIZATION_IDS },
  initials: String, color: String,        // tag colour from a fixed list of 8 Steel-friendly pairs (bg/fg)
  approverName: String, approverEmail: { type: String, lowercase: true, trim: true },
  archived: { type: Boolean, default: false },
}],
brandKit: {
  colors: [{ name: String, hex: { type: String, match: /^#[0-9a-f]{6}$/i } }],   // max 8
  headingFont: String, bodyFont: String,
  tone: { type: [String], default: [] },          // e.g. Warm, Homely, Regional (max 6)
  neverDo: { type: String, maxlength: 500 },
  assetUrls: { type: [urlField()], default: [] }, // max 12
},
```

`industry` switches to a specialization id. Agencies can switch `accountType` brand↔agency in settings; creators can never become brands.

### 5.5 `portfolioItems` — add ("how it was made")

```js
contentType: { type: String, enum: CONTENT_TYPE_IDS }, format: { type: String, enum: FORMAT_IDS },
industry:    { type: String, enum: SPECIALIZATION_IDS }, skills: { type: [{ type: String, enum: SKILL_IDS }], default: [] },
styles:      { type: [{ type: String, enum: STYLE_IDS }], default: [] },
workflow: [{ tool: { type: String, required: true, maxlength: 40 }, version: String, generations: Number, note: { type: String, maxlength: 200 } }], // ordered steps
generations:   Number,  // total, may be computed from steps
versionsCount: Number, timeTakenDays: Number, durationSec: Number,
briefSummary:     { type: String, maxlength: 500 },   // "Brief asked"
deliveredSummary: { type: String, maxlength: 500 },   // "Delivered"
versions: [{ label: String, mediaUrl: urlField(), thumbnailUrl: urlField(), note: { type: String, maxlength: 300 }, status: { type: String, enum: ['changes', 'approved'] } }], // optional, shown only if the creator chooses
madeOnUnio: { type: Boolean, default: false }, projectId: { type: ObjectId, ref: 'Project' },
licence: { licensedTo: String, summary: String, notForLicensing: { type: Boolean, default: false } },
contentHash: { type: String, index: true },   // sha256 of the uploaded file (uploads only) — duplicate check, F5
```

"Workflow added" = `workflow.length ≥ 1`. Pieces with a workflow rank higher on the profile.

### 5.6 `campaigns` — add (F3 + F7 + F2)

```js
contentType: { type: String, enum: CONTENT_TYPE_IDS }, formats: { type: [{ type: String, enum: FORMAT_IDS }], default: [] },
style: { type: String, maxlength: 300 }, languages: stringList, lengthNote: { type: String, maxlength: 80 },
revisionsIncluded: { type: Number, min: 0, max: 5, default: 2 },
clientId: { type: ObjectId },             // agency only: _id of an entry in brandProfiles.clients
clientName: { type: String, maxlength: 120 }, // denormalised for listing
sourcePortfolioItemId: { type: ObjectId, ref: 'PortfolioItem' }, // "I want something like this"
aiFilledFields: { type: [String], default: [] },   // which fields the AI filled (UI tint)
rights: {                                          // F7 — required before status 'open'
  usage:       { type: [{ type: String, enum: ['paid_ads', 'organic_social', 'website', 'print', 'tv_ott', 'internal'] }], default: [] },
  region:      { type: String, enum: ['india', 'worldwide', 'custom'] }, regionNote: String,
  durationMonths: { type: Number, enum: [3, 6, 12, 24, 0] },   // 0 = perpetual
  exclusive:   { type: Boolean },
  portfolioAllowed: { type: String, enum: ['yes', 'after_launch', 'no'], default: 'after_launch' },
  commerciallySafeTools: { type: Boolean, default: true },
  aiLabel:     { type: Boolean, default: true },
  likeness:    { type: String, enum: ['none', 'ai_only', 'real_with_consent'], default: 'none' },
},
```

Validation: opening a campaign (`status → open`) requires `rights.usage.length ≥ 1`, `region`, `durationMonths` (0 allowed), `exclusive` set. Drafts may be incomplete (show "Rights missing" pill, as B2 does). Provide `rightsSummary(campaign)` → `"Paid ads · India · 6 months · Non-exclusive"` in `services/serializers.js`, used everywhere.

### 5.7 `projects` — add (F6 + F7 + F2)

```js
// inside deliverableSchema:
specNote: { type: String, maxlength: 200 },  // "9:16 · 15–20 s · Hindi VO"
versions: [{
  number:    { type: Number, required: true },        // 1, 2, 3…
  mediaUrl:  urlField('Media link is required'), thumbnailUrl: urlField(),
  changeNote:{ type: String, trim: true, maxlength: 1000, required: true }, // "what changed" (v1: "first version")
  toolsUsed: stringList,
  status:    { type: String, enum: ['submitted', 'changes_requested', 'approved'], default: 'submitted' },
  feedback:  { note: { type: String, maxlength: 2000 }, byUserId: ObjectId, byName: String, byRole: { type: String, enum: ['brand', 'client'] }, at: Date },
  submittedAt: { type: Date, default: Date.now },
}],
currentVersion: { type: Number, default: 0 },
// keep mediaUrl + status on the deliverable as the "current" values (mirror of the latest version) so Round 1 code/tests keep working

// on projectSchema:
revisionsIncluded: { type: Number, default: 2 },   // copied from campaign at creation
revisionsUsed:     { type: Number, default: 0 },
rightsSnapshot:    { type: Object },               // copy of campaign.rights at project creation (rights can't change under a live project)
rightsCard: {                                       // created when status → completed
  number: String,              // "UN-2026-1043" (counter collection or date+random, unique index sparse)
  validFrom: Date, validTo: Date,                   // validTo null when perpetual
  summary: String, toolsUsed: [String], creatorName: String, brandName: String, clientName: String,
  createdAt: Date,
},
clientId: ObjectId, clientName: String,            // agency projects
lastMessageAt: Date,
approvalLinks: [{ tokenHash: String, deliverableId: ObjectId, versionNumber: Number, approverName: String, approverEmail: String,
                  createdAt: Date, expiresAt: Date, openedAt: Date, usedAt: Date, decision: { type: String, enum: ['approved', 'changes'] } }], // F2, Phase 9
```

### 5.8 New collection `messages` (F6)

```js
{ projectId: { type: ObjectId, ref: 'Project', required: true, index: true },
  senderId: { type: ObjectId, ref: 'User' },          // null for system messages
  senderRole: { type: String, enum: ['creator', 'brand', 'system'] },
  body: { type: String, trim: true, maxlength: 2000, required: true },
  about: { deliverableId: ObjectId, versionNumber: Number },  // optional "about v2" tag
  kind: { type: String, enum: ['user', 'system'], default: 'user' },
  readBy: [{ type: ObjectId, ref: 'User' }],
}  // timestamps; index { projectId: 1, createdAt: 1 }
```

System messages are written by the server on: version submitted, changes requested, version approved, project completed, approval link sent/used.

### 5.9 `verificationSubmissions` — add (F5)

```js
// VERIFICATION_TYPES += 'certificate'
method:        { type: String, enum: ['challenge', 'certificate', 'evidence'] },
challengeCode: { type: String },              // e.g. "UNIO-7F3K" — generated by server, uppercase A–Z/2–9 without O/0/I/1
challengeIssuedAt: Date, challengeExpiresAt: Date,   // 48 h validity, one use
recordingUrl:  urlField(), screenshotUrls: { type: [urlField()], default: [] },
certificate:   { issuer: String, title: String, verifyUrl: urlField(), fileUrl: urlField() },
checks:        [{ id: String, label: String, result: { type: String, enum: ['pass', 'fail', 'unknown'] }, detail: String }], // pre-check results
expiresAt:     Date,                           // VERIFIED + 12 months
```

Public status shown: tool + VERIFIED + not expired → **Verified**; certificate + VERIFIED → **Certified**; PENDING → **Pending**; else **Self-reported**. Expired → shown as Self-reported with "expired — re-verify" for the owner only.

### 5.10 Indexes to add

`messages {projectId, createdAt}` · `projects {'rightsCard.number'}` unique sparse · `projects {'approvalLinks.tokenHash'}` sparse · creatorProfiles fields in 5.3 · `portfolioItems {creatorId, featured}`, `{contentHash}` · `campaigns {status, contentType}`, `{brandId, clientId}`.

---

## 6. API changes (all under `/api`)

New endpoints follow the existing guard style in `routes/index.js`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/taxonomy` | public | All controlled lists (5.1) |
| POST | `/auth/register` | public | **Changed:** body by role (6.1) |
| GET | `/creators` | public | **Changed:** new filters + facet counts (7.F1-b) |
| GET | `/creators/:id` | public | **Changed:** adds trust (level, per-tool state), skills with proof counts, howIWork, workflow, stats (madeOnUnioCount, rating), featured work with workflow |
| GET | `/portfolio/:itemId` | public | **New:** one piece + creator summary + versions (if shared) + licence notice |
| PUT | `/creator/profile` | creator | **Changed:** new fields (5.3), recompute trust |
| POST/PUT | `/creator/portfolio[/:id]` | creator | **Changed:** new fields (5.5); changing `mediaUrl` of a verified piece puts its claim back to PENDING (Round 1 rule) |
| GET | `/campaigns`, `/campaigns/:id` | public | **Changed:** include `rightsSummary`, `rights`, contentType, formats, client name ("For X via Agency"); when the caller is a creator also `match {score, reasons}` |
| POST | `/brand/briefs/draft` | brand | **Changed:** richer AI output + clarifying questions (7.F3) |
| POST/PUT | `/brand/campaigns[/:id]` | brand | **Changed:** new fields, rights, clientId (agency) |
| PATCH | `/brand/campaigns/:id/status` | brand | **Changed:** `open` requires complete rights |
| GET | `/brand/campaigns/:id/recommendations` | brand | **Changed:** new weights, `breakdown[]`, `reasons[]`, `warnings[]` (7.F4) |
| GET | `/brand/clients` · POST · PUT `/:clientId` · DELETE (archive) | brand(agency) | **New:** agency clients |
| GET | `/brand/dashboard` · `/creator/dashboard` | role | **New (optional):** one call for the dashboard tiles/lists (counts are real) |
| GET | `/projects/:id` | participant | **Changed:** versions, revisions, rightsSnapshot, rightsCard, unread count |
| POST | `/projects/:id/deliverables/:deliverableId/versions` | creator participant | **New:** submit version {mediaUrl, thumbnailUrl?, changeNote, toolsUsed} |
| POST | `/projects/:id/deliverables/:deliverableId/versions/:n/decision` | brand participant | **New:** {decision: approve \| changes, note} — `changes` requires note ≥ 10 chars |
| GET | `/projects/:id/messages?after=<iso>` | participant | **New:** messages after a timestamp (polling every 10 s) |
| POST | `/projects/:id/messages` | participant | **New:** {body, about?} (rate limit 30/min) |
| POST | `/projects/:id/read` | participant | **New:** mark messages read |
| GET | `/me/unread` | signed in | **New:** `{ total, byProject: {id: n} }` for sidebar badges |
| GET | `/projects/:id/rights-card` | participant | **New:** card data (print view on client) |
| POST | `/projects/:id/approval-links` | brand(agency) participant | **New (Phase 9):** create link for a version → returns URL once |
| GET / POST | `/approve/:token` | **no auth**, rate-limited | **New (Phase 9):** view version / decide |
| POST | `/creator/verifications/challenge` | creator | **New:** {tool} → issues code, 48 h |
| POST | `/creator/verifications/:id/submit` | creator | **New:** {recordingUrl, screenshotUrls[]} or certificate fields → PENDING + runs pre-checks |
| GET | `/review/verifications` | reviewer | **Changed:** include checks, code, expiry countdown |
| PATCH | `/review/verifications/:id` | reviewer | **Changed:** approve sets `expiresAt = now + 12 months` and recomputes trust; reject needs note ≥ 10 (exists); new `ask_more` → back to SELF_REPORTED with note |
| POST | `/uploads/sas` | signed in | **New (Phase 10):** short-lived Azure Blob upload URL (section 9) |

### 6.1 Register body by role

| Role | Required | Optional |
|---|---|---|
| creator | name, email (any), password, category (id), city | displayName |
| brand (`accountType: 'brand'`) | name, jobTitle, companyName, industry (id), email, password | websiteUrl |
| agency (`role: 'brand'`, `accountType: 'agency'`) | name, jobTitle, agencyName (→ companyName), teamSize, email, password, websiteUrl | firstClientName (creates `clients[0]`) |

Use a Zod discriminated union on `role` + `accountType`. The client shows "Use your company email" for brand/agency but does not block Gmail. Reviewer is still not allowed.

---

## 7. Feature specifications (rules + acceptance criteria)

### F1 — Creator profiles, portfolios and Discover

**a) Profile & portfolio (P3, P3W, C2, C3)**
- Edit profile (C2) saves every field in 5.3. "Main category" is one select; "Also do" max 2; chips for content types, specializations, styles, skills. Skills show a green count badge = pieces proving them; skills with 0 pieces get a hint "add a piece to show this skill".
- Live card preview on C2 renders the real `CreatorCard` with unsaved form values.
- Add/edit piece (C3): link **or** upload (upload only when Phase 10 is live and env is configured; otherwise link only), title, content type, format, industry, skills, styles, "How it was made" steps (tool, version, generations, note; add/remove/reorder), versions made, time taken, client work yes/no (+ licensed-to text, or "Not for licensing"), brief summary / delivered summary.
- Profile page (P3) order: banner (first featured image, darkened) · identity card (avatar, name, category · city · availability, ★ Made on UNIO count, trust ladder, stats rating/projects/avg reply, Invite to a brief, Message (only when a project exists; otherwise hide), price/turnaround/languages/revisions) · tabs Work / How I work / Tools & trust / Reviews · headline paragraph · Tools card (chip + proof line per tool: "Challenge UNIO-7F3K · 14 Oct 2026 · expires Oct 2027", "Certificate checked", "Self-reported") · Featured work grid (first piece tall) with tool chain + "42 generations · 3 versions · ★ Made on UNIO" · How I work steps · Skills backed by work · Trust card (dark) · Reviews (only real project feedback).
- Piece page (P3W): left player (image or video; YouTube/Vimeo links embed via iframe — add `frame-src https://www.youtube.com https://player.vimeo.com` to Helmet CSP), version tabs if versions exist; right: badges, title, creator, fact tiles (type, format, generations, versions, time, industry — hide empty ones), How it was made timeline (verified tools green), Brief vs delivered, licence notice (if `licence.licensedTo`: "This piece was licensed to X. You can commission a similar piece — not reuse this one."), **I want something like this** → `/brand/campaigns/new?from=<itemId>` (logged-out → login with returnTo, Round 1 pattern). Bottom: versions & feedback filmstrip only if the creator shared versions.
- Acceptance: a creator can fill all fields, the public profile and card show them, pieces with workflow show the chain; nothing on these pages is invented (no fake stats).

**b) Discover (P2) — filters**
- Query params (all optional, multi-values comma-separated): `q, cat, types, spec, skills, tools, vonly (1), styles, formats, langs, trust (v,c,m), maxPrice, maxDays, avail (1), sort (match|rating|price|fast|mou|newest), page, limit`. Keep them in the URL (`useUrlFilters`).
- Logic: **OR within one filter, AND across filters**. `cat` matches `category` or `secondaryCategories`. `tools` with `vonly=1` matches `verifiedTools`; without it matches `tools`. `trust=v` → `verifiedTools` non-empty, `c` → `certifiedTools` non-empty, `m` → `madeOnUnioCount > 0`. `q` = escaped case-insensitive regex over displayName, headline, location, tools, and the *labels* of category/skills/specializations/contentTypes (resolve q against taxonomy labels server-side to ids).
- Response: `{ items, page, limit, total, totalPages, facets }` where `facets[field][optionId] = count` computed **with all other active filters applied but not the field's own** (standard faceted search). Implement with one `$facet` aggregation (one sub-pipeline per facet). If `$facet` misbehaves on the production DB, fall back to computing facets in Node over the filtered-by-others id lists (the dataset is small) — keep the same response shape.
- Sort `match` only when the brand passes `briefId` (rank by F4 score against that campaign); otherwise default `rating` then `madeOnUnioCount`.
- UI exactly as v9: category rail with 12 tiles + "All creators" (counts, zero = greyed), left facet panel (Content type, Specialization, Skills, Tools with "Verified tools only" toggle, Budget chips, Availability, then a "More filters" button revealing Turnaround, Style, Format, Language, Trust level), "Show all N" per long list, active-filter chips with × and "Clear all", result count + "Within one filter = any · across filters = all", sort select, empty state with "Clear all filters". Phone: Filters button toggles the panel.
- Acceptance: every filter changes results and counts correctly; URL reload restores state; a test covers OR/AND logic and facet counts.

### F2 — Brand & agency workspaces

- Brand (B1, B2, B4, B5, B7, B8) = Round 1 brand features restyled + new data.
- Agency = `accountType: 'agency'`: sidebar workspace card has a **client switcher** (`All clients` + each client) stored in the URL (`?client=<id>`); every brand list endpoint accepts `clientId` and filters campaigns/projects/applications by it. Campaign create requires choosing a client ("New brief for…"). Brief cards and campaign pages show "For **Client** · via **Agency** · Agency".
- Clients page (A2): add/edit/archive client (name, industry, colour tag from 8 presets, approver name + email). Cards show campaign/project/awaiting counts (real).
- A1 overview = brand overview + client strip + "Awaiting client" stat + "Waiting on client" list (approval links sent, opened/not opened) + Client column in the projects table.
- Brand kit (B8): colours, fonts, tone, never-do, assets → passed to the AI brief builder as context and shown read-only to hired creators on the project page.
- **Approval link (Phase 9, "Could")**: agency creates a link for a specific version → server stores sha256(token), returns `https://<site>/approve/<token>` once (copy button; sending email is out of scope — the agency shares the link). Link valid 7 days, one decision. Page A3 (no login): version media, what changed, Approve or Request changes (note ≥ 10). Decision is recorded as feedback `byRole: 'client'` and a system message; the agency still controls the project status (client "approve" marks the version approved only if the agency enabled "client decision is final" — default: it notifies the agency, which confirms). Rate-limit `/approve/*`.

### F3 — AI brief builder (B3)

- Extend `AiDraftSchema` + `normalizeDraft()` + `templateDraft()` with: `contentType`, `formats[]`, `lengthNote`, `style`, `languages[]`, `rights {usage[], region, durationMonths, exclusive, portfolioAllowed, aiLabel, likeness}`, `questions[] {id, question, options[]}` (max 3 clarifying questions when the idea is ambiguous, e.g. real actors vs AI people, India vs worldwide, portfolio allowed), `warnings[]` (e.g. "4 days before Diwali — creators may charge rush"). Map AI-chosen values onto taxonomy ids; unknown → drop + warning. Keep every Round 1 safety rule (untrusted output, `<idea>` wrapping, clamps, rate limit, template fallback, error codes).
- Inputs to the model: the idea, the brand kit summary (tone, never-do, industry), and — when `from=<portfolioItemId>` — that piece's contentType, format, styles, tools, industry, title (as data, not instructions).
- Likeness rule: if the idea mentions people and no answer is given, default `likeness: 'none'` and add the warning "Because they're AI-generated, Real likeness is set to none."
- UI: split screen. Left: idea textarea, chips (Add reference, Brand kit attached, From: <piece>), "Rewrite brief", AI-asked questions as chip choices (answers are sent back with the next rewrite). Right: "Live brief" card with progress ("11 of 12 filled" + meter), title, a 2-column grid of fields — AI-filled fields tinted `ai` with an `AI` mark until the brand edits them (then normal), warnings inline — then the **Commercial use** block (navy border) with the 7 rights tiles, then Save draft / Publish & see matches. Everything is editable; nothing is saved until the brand clicks.
- Acceptance: one sentence produces a valid draft that passes the campaign validator (extend the existing test), rights are filled, questions appear for ambiguous ideas, the `from=` flow pre-fills from a piece.

### F4 — Matching

Replace `WEIGHTS` in `services/matching.service.js` (keep the function names and response contract, add `breakdown`):

| Signal | Points | Rule |
|---|---|---|
| Content type | 20 | campaign.contentType ∈ creator.contentTypes → 20; category affinity (e.g. `ad` ↔ `video/ugc`) → 10 |
| Skills | 20 | share of campaign requiredSkills present in creator.skills **backed by ≥ 1 piece** |
| Tools | 15 | per required tool: verified = 1, certified = 0.75, self-reported = 0.5; average × 15 |
| Industry | 10 | campaign.category ∈ creator.specializations |
| Budget | 10 | startingPrice ≤ budgetMax → 10; ≤ 1.25 × budgetMax → 5 |
| Trust | 10 | trustLevel 5→10, 4→8, 3→6, 2→3, 1→0 |
| Format | 5 | any campaign format ∈ creator.formats |
| Language | 5 | any campaign language ∈ creator.languages (no language asked → 5) |
| Availability | 5 | available 5, busy 2, unavailable → excluded |

These weights are **proposed** (Fawwaz may change them) — keep them in one exported constant. Return `breakdown: [{signal, points, max}]`, `reasons` (positive, plain: "Kling and Runway verified", "12 food pieces", "Rate fits ₹6K–₹14K", "Hindi voice-over"), `warnings` ("Busy until 26 Oct — lost 5 availability points"). Shown on B4 (expanded row bars), B5 (hero card), P5 sidebar for the signed-in creator, C1 and P4 rings. UI copy: "We never hide why someone ranks high." Test: deterministic scores for fixtures.

### F5 — UNIO Trust

- **Tool verification by challenge:** creator picks a tool → `POST /creator/verifications/challenge` creates/reuses the claim `tool:<name>` with a fresh code (`UNIO-` + 4 chars), `challengeExpiresAt = now + 48 h`. C7 shows the big code and steps: record screen showing the tool account → type the code in the prompt → generate → keep recording until the result → upload recording link (Drive/YouTube unlisted/Blob) + 2 screenshots → Submit. Submitting after expiry → 409 `CHALLENGE_EXPIRED` (issue a new code).
- **Pre-checks** on submit (store in `checks[]`, shown to reviewer and creator): links are https and reachable (HEAD/GET with 5 s timeout, server-side, no redirects to private IPs), submitted within the 48 h window, ≥ 2 screenshots, recording link is a supported host or Blob URL. Optional AI check (only if `ANTHROPIC_API_KEY` and screenshots are image URLs): send the screenshots to Claude asking "Is the text <code> visible? Which tool UI is this?" → `pass/fail/unknown`. **Label them "Automatic pre-checks", never claim certainty**; the reviewer decides.
- **Certificates:** type `certificate` with issuer, title, verify URL (required) and optional file; reviewer opens the verify link → VERIFIED shows as **Certified**.
- **Reviewer (R1):** queue tabs Tools / Certificates / Flagged (duplicates); evidence viewer, checks list, reason box (required to reject), Approve (sets `expiresAt = +12 months`), Reject, Ask for more. Every decision stores reviewerId + time (exists).
- **Expiry:** 30 days before `expiresAt` the creator dashboard shows "Runway badge expires in N days. Re-verify." After expiry the tool counts as self-reported in public and matching.
- **★ Made on UNIO:** on project `completed` → `madeOnUnioCount += 1` (recompute from completed projects to stay exact), offer the creator "Add to portfolio" which creates a portfolio item with `madeOnUnio: true, projectId` and the final version media.
- **Duplicate check:** when a file is uploaded (Phase 10) compute sha256 client-side (Web Crypto) and send it; the server rejects/flags (`Flagged` tab) if the same hash exists on another creator's portfolio. Link-only pieces cannot be hashed — say so in the UI copy (honest limits, P6).
- Trust score ring on C7 (0–100) is **optional**: only show it if defined as a simple formula in code (e.g. level × 15 + min(verifiedTools, 3) × 5 + min(madeOnUnio, 5) × 2, capped 100) and explained in a tooltip; otherwise show only the ladder.

### F6 — Projects, versions, feedback, messages

Status flow (existing statuses, new triggers):

```
not_started ──creator submits first version──▶ in_progress/submitted
submitted ──brand: approve all deliverables──▶ completed  (creates rightsCard, ★ count, system message)
submitted ──brand: changes on any version (note ≥10)──▶ revision_requested (revisionsUsed += 1)
revision_requested ──creator submits next version──▶ submitted
any active ──brand cancels──▶ cancelled
```
- Project `submitted` = every deliverable's latest version is `submitted` or `approved` and at least one is `submitted`. Completed = every deliverable approved. Compute in the service after each decision; reuse Round 1 transition guards.
- Submit version: creator only, deliverable not approved, project not completed/cancelled; `number = currentVersion + 1`; `changeNote` required (v1 default "First version"); mirror `mediaUrl/status` onto the deliverable for Round 1 compatibility.
- Decision: brand only, on the latest submitted version. `changes` requires `note.trim().length ≥ 10` → 400 `NOTE_REQUIRED` otherwise. When `revisionsUsed ≥ revisionsIncluded` still allow but return a `warning` and show "Revision rounds used up — agree extra rounds in messages" (no blocking, no payments in scope).
- Messages: polling every 10 s with TanStack `refetchInterval` while the page is visible (`refetchIntervalInBackground: false`), `GET ?after=` to fetch only new ones; optimistic send; "about vN ▾" selector attaches `about`; system messages in a dashed pill. Unread counts in the sidebar via `/me/unread` (poll 30 s). No websockets, no typing indicators, no messages outside projects (out of scope).
- Project page layout (S1/S2): dark header (breadcrumb, title, status pill, due date, "Revisions 1 of 2 used", rights one-liner, avatars) + 5-step tracker (Hired · Making · Review · Changes · Delivered); left: current deliverable card (player, v-badge, version timeline, brand decision box **or** creator "Submit a new version" form with the latest feedback in a red box), other deliverables list; right (sticky): messages.
- Completed (S3): green-check header "All N deliverables approved", final files list (links), rate the creator (existing feedback endpoint), **Rights & usage card** ticket (number, brand ← creator, usage, region, valid from→to, exclusive + portfolio rule, tools, AI label, likeness) + "Download PDF" (= `window.print()` with a print stylesheet that prints only the ticket) + note "A plain-language summary of what was agreed in the brief. Not a legal contract."

### F7 — Licensing & commerciality

- Rights asked in the brief (F3) and editable in the campaign form; a campaign cannot open without them (5.6).
- Shown: RightsStrip on every brief card (P4, C1, B1, B2) and application row; full RightsTicket on P5 ("What the brand can do with your work"); creators must tick "I've read the rights & usage terms" before applying (validator: `acceptedRights: true`).
- Snapshot at project creation (`rightsSnapshot`) — later campaign edits don't change live projects.
- Rights card at completion (`rightsCard`), visible to both parties, printable.
- P6 lists the questions and states the card is not a legal contract.

---

## 8. File uploads with Azure Blob Storage (Phase 10)

Round 1 stores **links only**. Round 2 adds direct uploads for images, short videos (≤ 200 MB), screenshots, certificates and brand assets. Long videos stay as YouTube/Vimeo/Drive links. Files never pass through Express.

1. Add dependency `@azure/storage-blob` to `server`. Env (set by the Azure teammate): `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_KEY`, `AZURE_STORAGE_CONTAINER=media`, optional `AZURE_STORAGE_PUBLIC_BASE` (default `https://<account>.blob.core.windows.net/<container>`). If any is missing, uploads are disabled and the UI shows link fields only (local dev keeps working).
2. `POST /api/uploads/sas` (signed in, rate-limited 30/10 min) body `{ purpose: 'portfolio'|'thumbnail'|'evidence'|'certificate'|'brandkit'|'version'|'avatar', fileName, contentType, size }`. Validate type (image/jpeg, png, webp, gif; video/mp4, webm, quicktime; application/pdf for certificates) and size (images ≤ 10 MB, video ≤ 200 MB, pdf ≤ 10 MB). Blob name `${purpose}/${userId}/${crypto.randomUUID()}-${slug(fileName)}`. Create a SAS with `create,write` permission, 15-minute expiry, using `StorageSharedKeyCredential` + `generateBlobSASQueryParameters`. Return `{ uploadUrl, blobUrl, maxSize }`.
3. Client `uploadFile(file, purpose)` in `services/api.js`: get SAS → `PUT uploadUrl` with headers `x-ms-blob-type: BlockBlob`, `Content-Type` (use `XMLHttpRequest` for a progress bar) → return `blobUrl`, which is saved through the normal endpoints (portfolio `mediaUrl`, version `mediaUrl`, evidence urls…). Validators already accept https URLs.
4. Video thumbnails: ask for an optional thumbnail image; otherwise capture a frame client-side (`<video>` + `<canvas>` at 1 s) and upload it as `thumbnail`.
5. Container is **public-read for blobs** (anonymous read, no listing) for the demo; names are unguessable. Evidence recordings live in the same container — note this limitation in code comments; a private container + read-SAS is the production upgrade.
6. Helmet CSP: add the blob host to `img-src` and `media-src` (or `https:`), see 12.2.

---

## 9. Seed data

Update `server/scripts/seed.js` (idempotent, `isDemo: true`) so every v9 screen has real data to show: the 11 creators from v9 (Meera Kulkarni — AI Video Creator, Pune; Ananya Rao — UGC & avatars; Arjun Menon — product photographer; Rohan Das — 3D; Kabir Malhotra — music visuals; Ishita Bansal — food photography; Zoya Siddiqui — motion; Vihaan Shah — filmmaker; Sana Qureshi — graphic/fashion; Dev Patil — thumbnails; Tara Iyer — animator) with categories, content types, specializations, skills, styles, formats, languages, prices, workflow, howIWork; portfolio pieces with workflow steps; brands Masala Trail Foods, Northwind Audio and agency **Pixel & Pine Studio** with clients Verdant Skin Co., Brewhaus Coffee, Kinetic Shoes, Nimbu Drinks; campaigns with rights; one project in each status including one with v1–v3 + messages + a completed one with a rights card.

**Honesty rule:** demo creators may have VERIFIED claims only if created through the same service functions with a demo reviewer and a note "demo seed"; keep `isDemo` visible to admins. Never show invented platform totals (e.g. "1,240 creators") — public counts come from the DB.

---

## 10. Testing & the demo checklist

- Server: add tests next to the existing ones — `round2.profile.test.js` (new fields, taxonomy validation, trust recompute), `round2.discover.test.js` (OR/AND, facets, vonly), `round2.projects.test.js` (versions, note ≥ 10, revisions counter, completion → rights card + ★), `round2.messages.test.js` (participants only, `after=`, unread), `round2.verification.test.js` (challenge expiry, approve → expiresAt, certified), `round2.agency.test.js` (clientId scoping, approval link single use). Keep using the in-memory replica set.
- Client: run `npm run build` (must pass) and click through at 1440 and 390 px.
- **End-to-end demo script (must pass on the live Azure link before Friday 8 pm):**
  1. Visitor: Home → Discover → filter "AI Animators" + "Kling, verified only" → open a creator → open a piece → "I want something like this" → login as brand.
  2. Brand: AI brief from one line → answer a question → check rights → Publish → see matches with breakdown → invite/accept an applicant.
  3. Creator: sees brief with rights, applies (ticks rights), gets hired, submits v1.
  4. Brand: requests changes (try a 5-char note → blocked; then a proper note) → message "about v1" → creator submits v2 → brand approves → project completed → Rights & usage card → print.
  5. Creator: ★ Made on UNIO count went up; add the project to portfolio.
  6. Creator: UNIO Trust → get challenge code → submit links → reviewer approves → tool chip turns verified, trust level updates, Discover "verified only" finds them.
  7. Agency (if built): switch client, brief for client, approval link opened in a private window → approve.
  8. Sign up page: creator vs brand vs agency fields differ; no reviewer option.

---

## 11. Phased build plan (do in order)

Each phase lists what to change. Commit at the end of each.

### Phase 0 — Setup (30 min)
1. `git tag round-1 && git checkout -b round-2`.
2. Confirm `design/` exists (v9 HTML, `screens/`, `logo/`) and this guide is at `docs/ROUND2_BUILD_GUIDE.md`; `CLAUDE.md` at repo root.
3. `npm run install:all`, `npm test` (expect 50 passing), `npm run dev:memory` and open the app — baseline works.

### Phase 1 — Design system reskin (≈ 0.5–1 day) · screens: all
1. Fonts in `client/index.html`; tokens in `styles/index.css` (3.3); remove old palette and fix all class usages.
2. Logo files to `client/public/`, `Logo.jsx` light/dark variants, favicon = mark.
3. Build/restyle the kit (3.4): Button, Card, Pill (+ `lib/status.js` tones), ToolChip, MadeOnUnio, ToolChain, TrustLadder, TrustLevelTag, MatchRing, ScoreBars, Reasons, RightsStrip, RightsTicket, VersionTimeline, StatTile, AiMark, inputs/chip selectors/segmented control, MediaFrame fallback in Steel.
4. Layout shells (3.5, 3.6): SiteHeader/SiteFooter, DashboardLayout sidebar per role + top bar + mobile bottom bar.
5. Restyle every existing page with the kit **without changing behaviour** (P7, P9, B2, C4, invitations, applications…). Compare with screenshots.
Done when: whole app is Steel, Round 1 flows unchanged, tests green.

### Phase 2 — Public pages & auth (≈ 0.5 day) · P1, P6, P7, P8
1. `GET /api/taxonomy` + taxonomy module (5.1) + client hook `useTaxonomy()`.
2. Home (P1) per v9; the proof wall uses `GET /creators?featured` pieces (real), no fake stats.
3. How it works (P6) at `/how-it-works`, redirect `/about`.
4. Sign in (P7); Join (P8) with role cards and per-role fields (6.1) — server register union + BrandProfile `accountType`, `jobTitle`, `teamSize`, `clients[0]`.
Done when: sign-up works for creator/brand/agency with the right fields; reviewer still impossible; tests added.

### Phase 3 — F1 profile & portfolio (≈ 1 day) · C2, C3, P3, P3W
1. Schema 5.3 + 5.5, validators, `profile.service`/`creators.service` serializers (skills with proof counts, trust fields), `trust.service.recomputeCreatorTrust`.
2. `GET /portfolio/:itemId`.
3. C2 edit profile + live card; C3 portfolio grid + add-piece panel (links; upload hook added in Phase 10).
4. P3 creator profile and P3W piece page.
5. Update seed (section 9) for creators/pieces.

### Phase 4 — F1 Discover (≈ 0.5 day) · P2
1. `GET /creators` filters + facets (7.F1-b) with tests.
2. P2 UI: rail, facet panel, chips, sort, empty state, mobile toggle, URL state.

### Phase 5 — F3 + F7 brief builder & rights (≈ 0.5–1 day) · B3, P4, P5, B2
1. Campaign schema 5.6 + validators (open requires rights) + `rightsSummary()`.
2. Brief builder service: schema, normalize, template, questions, warnings, `from=` piece, brand kit context; extend tests.
3. B3 split-screen UI; B2 table with rights; P4 cards with RightsStrip; P5 with RightsTicket + apply panel (rights checkbox, match reasons for creators).
4. Brand profile B8 + brand kit (5.4).

### Phase 6 — F6 projects (≈ 1 day) · S1, S2, S3, B7, C6
1. Project schema 5.7, `messages` model 5.8, endpoints (6), service rules (7.F6), system messages, rightsSnapshot at creation (in `createProjectFromSource`), rightsCard + ★ on completion.
2. `ProjectDetail` brand/creator views, messages panel with polling, `/me/unread` badges, S3 delivery + print stylesheet, B7 kanban, C6 cards.
3. Seed a project with v1–v3 + messages, and a completed one.

### Phase 7 — F4 matching (≈ 0.5 day) · B4, B5, P5, C1
1. New weights + breakdown/reasons/warnings + tests.
2. B4 expandable rows with bars; B5 page; creator-side match on P4/P5/C1.

### Phase 8 — F5 trust (≈ 1 day) · C7, R1
1. Schema 5.9, challenge endpoint, submit + pre-checks, certificate flow, reviewer approve with expiry, recompute trust, expiry warnings.
2. C7 page and R1 queue as in v9.

### Phase 9 — F2 agency (≈ 1 day) · A1, A2, A3
1. Clients CRUD, `clientId` on campaigns/projects, client switcher + scoping, A1/A2.
2. Approval links + public `/approve/:token` page (A3).

### Phase 10 — Uploads to Azure Blob (≈ 0.5–1 day)
Section 8. Wire into C3 (piece media + thumbnail), S2 (version upload), C7 (screenshots/recording), B8 (brand assets), avatar. Duplicate hash check.

### Phase 11 — Azure readiness & release (≈ 0.5 day, together with the Azure teammate)
Section 12 code changes, final seed on the Azure DB, demo script (section 10) on the live link, fix, freeze.

---

## 12. Azure — code changes Claude Code must make

The Azure teammate creates the cloud resources (guide: "UNIO on Azure — Deployment Guide"). Claude Code makes these repo changes so the app runs as **one Azure App Service** (Express serves both the React build and `/api` on one domain).

### 12.1 Serve the React build from Express (`server/src/app.js`)

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
// … after app.use('/api', routes):
app.use(express.static(publicDir, { index: false, maxAge: '1h' }));
app.get(/^\/(?!api\/).*/, (req, res, next) =>
  res.sendFile(path.join(publicDir, 'index.html'), (err) => (err ? next() : undefined)));
app.use(notFound);
app.use(errorHandler);
```
Add `server/public/` to `.gitignore`. Hashed assets under `/assets/` can use `maxAge: '1y', immutable: true`.

### 12.2 Helmet CSP (same file)

```js
app.use(helmet({ contentSecurityPolicy: { directives: {
  'img-src':   ["'self'", 'data:', 'blob:', 'https:'],
  'media-src': ["'self'", 'blob:', 'https:'],
  'frame-src': ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://player.vimeo.com'],
  'connect-src': ["'self'", 'https://*.blob.core.windows.net'],   // direct browser uploads (Phase 10)
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src':  ["'self'", 'https://fonts.gstatic.com', 'data:'],
}}}));
```

### 12.3 Cookies, CORS, proxy

- Same origin now → in `middleware/auth.js` `cookieOptions()` use `sameSite: 'lax'` in production as well (keep `secure: env.isProd`). Update the comment.
- `CLIENT_ORIGIN` = the Azure URL (plus `http://localhost:5173` for dev). CORS code unchanged.
- `TRUST_PROXY=1` on Azure (one front end).

### 12.4 Database

- Cosmos DB for MongoDB vCore needs `retrywrites=false` in the URI (the teammate provides the full string). Mongoose code unchanged. Transactions are supported (30 s limit) — `withTransaction()` already falls back safely.
- Do **not** use `$where`, server-side JS, or `$lookup` with pipelines more complex than needed; keep `$facet` usage simple (fallback described in 7.F1-b).
- Build indexes with `Model.syncIndexes()` in a one-off script `server/scripts/sync-indexes.js` (run once against the Azure DB), not on every boot.

### 12.5 Deployment pipeline (the teammate adds the secret; Claude Code adds the file)

`.github/workflows/azure-deploy.yml` — on push to `main` (and manual): Node 22 → `npm --prefix client ci && npm --prefix client run build` → `rm -rf server/public && cp -r client/dist server/public` → `npm --prefix server ci --omit=dev` → `azure/webapps-deploy@v3` with `app-name` and `publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}`, `package: server`. Startup command on Azure: `node src/server.js`. Merge `round-2` into `main` only when the demo script passes on a preview (or deploy from `round-2` by changing the branch in the workflow).

### 12.6 Environment variables (names the code must read via `config/env.js`)

`NODE_ENV, MONGODB_URI, JWT_SECRET, CLIENT_ORIGIN, TRUST_PROXY, COOKIE_NAME, ANTHROPIC_API_KEY, BRIEF_AI_MODEL, OPENROUTER_API_KEY (optional), AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_KEY, AZURE_STORAGE_CONTAINER, AZURE_STORAGE_PUBLIC_BASE (optional), PUBLIC_SITE_URL` (used to build approval links). Update `server/.env.example` with all of them (no real values). `PORT` comes from Azure.

---

## 13. Out of scope — do not build

Payments/escrow · email sending (approval links are copied by the agency) · real-time websockets, typing indicators, calls · messaging outside projects · legal contracts (the rights card is a summary) · video transcoding/streaming services (Azure Media Services is retired) · AI that "detects AI content" · fake stats or fake reviews · changing the stack (no Next.js, no TypeScript migration, no new UI library).

## 14. Open decisions (ask Fawwaz; defaults in brackets)

1. Matching weights (table in F4). 2. Revision rounds included [2]. 3. Final taxonomy lists — cut/rename before seeding [as in 5.1]. 4. Round 1 campaign category mapping [5.1]. 5. Agency client approval: notify agency vs final decision [notify]. 6. Trust score ring on C7 [hide unless formula approved]. 7. Max video upload size [200 MB]. 8. Deploy branch [`main` after merge].
