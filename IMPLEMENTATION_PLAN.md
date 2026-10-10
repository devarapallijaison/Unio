# UNIO — Implementation Plan

Source of truth: `PROJECT_SPEC.md` (the master specification). This plan turns it into ordered, testable phases.
Status legend: `[ ]` todo · `[~]` in progress · `[x]` done and tested.

---

## 0. Current state (2026-10-10)

- Repo contains only `README.md`. Remote: `github.com/devarapallijaison/Unio`.
- Local toolchain: Node 25.7, npm 11.10.
- Nothing to preserve; full scaffold required.

### Blockers / inputs needed
| Item | Needed for | Fallback until supplied |
|---|---|---|
| MongoDB Atlas URI (cluster, DB user, IP access) | Phase 1 checkpoint, seed, all API work against real DB | Local `mongod` or `mongodb-memory-server` for tests |
| UNIO logo file | Brand header, favicon | Original SVG wordmark + connected-shapes icon (replaceable) |
| Cloudinary keys | Media uploads | Validated media URLs only (spec allows this) |
| Real team photos / bios | Seed profiles | Neutral monogram placeholders, "Demo profile" labels |
| Deployment accounts (Vercel/Render) | Phase 10 | Local production build verification |

---

## 1. Architecture

```
unio/
├── client/                React + Vite + Tailwind (JS, ES modules)
│   ├── public/            logo.svg, logo-light.svg, favicon.svg
│   └── src/
│       ├── app/           App.jsx, router.jsx, providers.jsx
│       ├── components/    layout/ ui/ creators/ campaigns/ portfolio/ projects/
│       ├── features/      auth/ creators/ campaigns/ applications/ invitations/ projects/
│       ├── pages/         public/ creator/ brand/
│       ├── services/api.js     single fetch wrapper (credentials: 'include')
│       ├── context/AuthContext.jsx
│       ├── hooks/ lib/ styles/
│       └── main.jsx
├── server/
│   ├── src/
│   │   ├── config/        db.js, env.js (validated env)
│   │   ├── models/        8 Mongoose models (Section 7 of spec, exact fields)
│   │   ├── validators/    Zod schemas per resource
│   │   ├── middleware/    auth, requireRole, validate, errorHandler, notFound, rateLimit
│   │   ├── services/      auth, campaign, application, invitation, project, matching
│   │   ├── controllers/   thin; call services
│   │   ├── routes/        auth, public, creator, brand, campaigns, projects
│   │   ├── utils/         ApiError, asyncHandler, pagination, respond
│   │   ├── app.js         express app (no listen) — importable by tests
│   │   └── server.js      connect DB + listen
│   ├── scripts/seed.js
│   ├── tests/             node:test + supertest + mongodb-memory-server
│   └── .env.example
├── IMPLEMENTATION_PLAN.md
├── PROJECT_SPEC.md
└── README.md
```

### Key technical decisions
- **Frontend data layer:** TanStack Query on top of one `services/api.js`. Query keys per resource; mutations invalidate lists (dashboard updates automatically after apply/accept).
- **Forms:** React Hook Form + Zod; Zod schemas mirror the server validators.
- **Auth:** JWT (7d) in HTTP-only cookie `unio_session`; `sameSite=lax` in dev, `sameSite=none; secure` in production (cross-domain Vercel↔Render). `GET /api/auth/me` restores session on load.
- **Validation:** Zod on server (`validate({ body, query, params })` middleware). Writable fields whitelisted via schema `.strict()`/pick — prevents mass assignment.
- **Responses:** `{ success: true, data, meta? }` / `{ success: false, error: { code, message, details } }` via a central error handler. Mongo duplicate-key `11000` → `409 CONFLICT`. Invalid ObjectId → `400`. Non-owned resource → `404` (don't leak existence) except role mismatch → `403`.
- **Accept → project creation:** service function `createProjectFromSource()` using `findOneAndUpdate({campaignId, creatorId}, {$setOnInsert}, {upsert:true})` + unique index → idempotent even without transactions. Uses a transaction when the Atlas deployment supports it (replica set — Atlas always does), with the upsert as a safety net.
- **Status transitions:** explicit transition maps (e.g. application `pending → accepted|rejected|withdrawn` only). Invalid → `409 INVALID_TRANSITION`.
- **Security:** helmet, CORS allowlist from `CLIENT_ORIGIN` with credentials, `express-rate-limit` on `/api/auth/login` and `/register`, bcryptjs (cost 12), `passwordHash` has `select: false` + `toJSON` transform strips it, body size limit 100kb.
- **Redirect safety:** `returnTo` accepted only if it starts with `/` and not `//`, and matches an allowlist of route patterns.

---

## 2. Design system — "editorial, not template"

The goal is a site that looks art-directed. Concrete rules, so it doesn't drift into generic AI aesthetics:

### Tokens (exact palette — CSS variables + Tailwind theme)
| Token | HEX | Role |
|---|---|---|
| `forest` | `#47553A` | Primary buttons, nav accents, key headings, dark sections |
| `sage` | `#C7D2C2` | Secondary surfaces, cards, tags (large/bold text only) |
| `mint` | `#E6EEE4` | Soft page sections, dashboard canvas |
| `sand` | `#EADFCF` | Editorial / portfolio sections |
| `beige` | `#D4C7A1` | Borders, dividers, restrained highlights |
| `ivory` | `#FAF9F5` | Page background |
| `white` | `#FFFFFF` | Form fields, elevated cards |
| `ink` | `#20251D` | Body text |
| `muted` | `#656B60` | Secondary text |

Contrast checks: ink on any palette surface ✓; ivory/white on forest ✓; muted text only on ivory/white/mint/sand — never small muted text on sage.

### Typography
- Display: **Fraunces** (variable serif, soft optical sizes) — headlines, section titles, big numerals.
- UI/body: **Inter Tight** — tight, modern grotesk for interface and copy.
- Mono accents: **JetBrains Mono** for small labels (indices like `01 —`, metadata, budgets).
- Scale: fluid `clamp()` headings; large display sizes on marketing pages (up to ~96px), restrained on dashboards.

### Visual language
- Hairline borders (`beige`) instead of shadows; at most one subtle shadow for menus/dialogs.
- Small radii (4–8px) — no pill-everything.
- Asymmetric 12-column grids on marketing pages; staggered/masonry portfolio layouts; varied card sizes (not repeated identical grids).
- Editorial details: section numbering, captions under media, running metadata lines (`Kling · Runway · Beauty`), marquee of tools, generous whitespace.
- Dark `forest` bands for contrast sections and footer with reversed logo.
- Motion: subtle fade/translate on reveal, image hover scale ≤1.03; all disabled under `prefers-reduced-motion`.
- Icons: `lucide-react` only, 1.5px stroke, consistent 16/20px sizes.
- Media: neutral tonal placeholders (palette-tinted with monogram/category label) — never broken images; `isDemo` badge visible on demo profiles and their work.
- Copy: specific, plain, confident. No fake metrics ("10k+ creators"), no filler.

### Component kit (`components/ui`)
Button (primary/secondary/ghost/danger, loading state), Input, Textarea, Select, TagInput, Checkbox/RadioCard (role picker), Badge/StatusPill (one colour mapping per status enum), Card, Dialog, Drawer (mobile filters), Tabs, Pagination, EmptyState, ErrorState, Skeleton, Toast, Avatar (monogram fallback), MediaFrame (image/video/placeholder), Logo.

---

## 3. Phased build (vertical slices)

Each phase ends with: build passes, tests pass, manual check, small commit(s) (`feat(scope): …`).

### Phase 1 — Scaffold & infrastructure
- [ ] Root `.gitignore` (node_modules, .env, dist, coverage), copy spec to `PROJECT_SPEC.md`
- [ ] `server/`: Express app, helmet, CORS, cookie-parser, JSON limit, `/api/health` (reports DB state), central error + 404 handlers, env validation, `db.js`
- [ ] `server/.env.example` exactly as spec Section 13
- [ ] `client/`: Vite + React + Tailwind, tokens, fonts, router skeleton, layout shell, Logo SVGs, favicon
- [ ] Root scripts: `npm run dev` runs both (concurrently)
- **Checkpoint 1:** both start locally; `/api/health` → `{ success: true, data: { status: 'ok', db: 'connected' } }` against Atlas

### Phase 2 — Models & seed
- [ ] 8 models with exact fields, enums, refs, timestamps, indexes (spec §7)
- [ ] Model tests: required fields, enums, `budgetMax >= budgetMin`, unique compounds
- [ ] `scripts/seed.js`: idempotent upserts keyed by email / natural keys
  - 5 team members (Fawaz Ahmed, Sai Charitha, Roha Nawaz, Shameer, Jaison) — editable descriptions labelled as draft, placeholder photos
  - 10 fictional demo creators `isDemo: true`, `@example.com` emails
  - 3 demo brands, ~8 campaigns (mix open/closed/draft), portfolio items, sample applications/invitations/projects
  - Demo password from `SEED_DEMO_PASSWORD` env, hashed
- **Checkpoint 2:** run seed twice → identical counts, all refs valid

### Phase 3 — Auth
- [ ] `POST /register` (creates user + empty creator/brand profile), `/login` (generic 401), `/logout`, `GET /me`
- [ ] `requireAuth`, `requireRole('creator'|'brand')` middleware
- [ ] Frontend: AuthContext, Login, Register (role cards), `ProtectedRoute` with loading / logged-out / wrong-role states, safe `returnTo` handling
- [ ] Tests: register both roles, duplicate email 409, bad login 401, `/me` with/without cookie, passwordHash never returned
- **Checkpoint 4**

### Phase 4 — Public discovery: creators
- [ ] `GET /api/creators` (search via text index, skill/tool/specialty/availability/price filters, sort: featured/newest/price), pagination
- [ ] `GET /api/creators/:id` with portfolio; no private fields
- [ ] Pages: `/creators` (filter sidebar → drawer on mobile, URL-synced filters), `/creators/:id` (editorial profile, portfolio grid, lightbox, Invite CTA)
- **Checkpoint 3 (creators)**

### Phase 5 — Campaigns (public + brand management)
- [ ] `GET /api/campaigns` (open only), `/:id`
- [ ] Brand: profile GET/PUT, campaigns CRUD, status PATCH; `brandId` from session only
- [ ] Pages: `/campaigns`, `/campaigns/:id`, `/brand/dashboard`, `/brand/campaigns`, `/new`, `/:id/edit` (deliverables repeater)
- [ ] Tests: non-owner edit → 404, public hides draft/closed

### Phase 6 — Creator profile, portfolio, applications
- [ ] Creator profile GET/PUT, portfolio CRUD (owner-scoped)
- [ ] `POST /api/campaigns/:id/applications` (open campaign, profile exists, no duplicate), list own, withdraw pending
- [ ] Brand: `GET /brand/campaigns/:id/applications`, `PATCH /brand/applications/:id/status` → accept creates project
- [ ] Pages: `/creator/dashboard` (incl. profile completeness), `/creator/profile/edit`, `/creator/portfolio`, `/creator/applications`, `/brand/campaigns/:id/applicants`; Apply flow with intent resume + confirmation step
- **Checkpoint 5**

### Phase 7 — Invitations
- [ ] Brand invite (owns campaign, creator exists, no duplicate active), list sent, cancel pending
- [ ] Creator list received, respond accept/decline → accept creates project
- [ ] Invite dialog on creator profile (choose own campaign or link to create one); intent resume
- [ ] Pages: `/creator/invitations`, `/brand/invitations`
- **Checkpoint 6**

### Phase 8 — Projects & deliverables
- [ ] Project created from accepted application/invitation, deliverables pre-filled from campaign deliverables
- [ ] `GET /api/projects/:id` (participants only), status PATCH with role-based transition map, deliverable PATCH (creator: mediaUrl + submit; brand: approve / request revision)
- [ ] Pages: `/creator/projects`, `/brand/projects`, project detail view
- [ ] Tests: duplicate project blocked, non-participant 404, invalid transitions 409
- **Checkpoint 7**

### Phase 9 — Matching
- [ ] `services/matching.js` with spec weights (40/25/20/10/5) + reasons
- [ ] `GET /api/brand/campaigns/:id/recommendations` → shown on brand campaign page ("Suggested creators", with honest wording)

### Phase 10 — Home, polish, QA, deploy
- [ ] Home page: editorial hero, how-it-works, featured creators & selected work (live API), open campaigns preview, dual CTA, About page, 404
- [ ] Responsive pass at 360 / 768 / 1024 / 1440
- [ ] Accessibility pass: focus rings, labels, alt text, keyboard nav for dialogs/menus
- [ ] Every button wired; loading/empty/error/success states everywhere
- [ ] Production build; deploy client (Vercel) + server (Render) with CORS/cookies verified
- [ ] README: setup, env, seed, tests, deploy, demo accounts
- **Checkpoint 8**

---

## 4. Status maps (single source for UI badges + server transitions)

| Entity | Transitions |
|---|---|
| Campaign | draft → open; open → closed; closed → open (reopen) |
| Application | pending → accepted / rejected (brand); pending → withdrawn (creator) |
| Invitation | pending → accepted / declined (creator); pending → cancelled (brand) |
| Project | not_started → in_progress (creator); in_progress / revision_requested → submitted (creator); submitted → completed / revision_requested (brand); any open → cancelled (brand) |
| Deliverable | pending / revision_requested → submitted (creator, needs mediaUrl); submitted → approved / revision_requested (brand) |

---

## 5. Testing strategy
- `node:test` + `supertest` + `mongodb-memory-server` (replica set mode, so transactions are also tested).
- Per feature: happy path, validation error, unauthenticated (401), wrong role (403), non-owner (404), duplicate (409).
- Client: `vite build` must pass; manual walkthrough of both workflows per checkpoint.

## 6. Out of scope (per spec)
Payments, subscriptions, realtime chat, notifications, direct file upload (unless Cloudinary keys are supplied — then signed uploads are an optional add-on).
