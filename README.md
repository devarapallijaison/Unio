# UNIO — Where Creators and Brands Unite

UNIO is a marketplace that connects AI content creators with brands. Brands publish briefs, review proposals and invite creators; creators show their portfolios, apply to briefs and deliver projects. Anyone can browse; an account is only needed to take action.

**Stack:** React 19 + Vite + Tailwind CSS 4 · React Router · TanStack Query · React Hook Form + Zod · Express 5 · Mongoose 9 · MongoDB Atlas (`invitaizen` database) · JWT in HTTP-only cookies.

```
unio/
├── client/          React app (Vite)
├── server/          Express API, Mongoose models, seed script, tests
├── IMPLEMENTATION_PLAN.md
└── package.json     root scripts (runs both apps)
```

## Quick start

Requirements: Node.js 22.12+ (developed on Node 25).

```bash
npm run install:all                 # installs root, server and client deps
cp server/.env.example server/.env  # then fill in the values (see below)
npm run seed                        # loads demo data into Atlas (safe to re-run)
npm run dev                         # API on :5000, web on http://localhost:5173
```

**No Atlas access yet?** Run `npm run dev:memory`. It starts a throwaway in-memory MongoDB, seeds it and runs both apps. The data is lost when it stops.

### Environment variables (`server/.env`)

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Atlas connection string ending in `/invitaizen?...`. Atlas → Network Access must allow your IP (or `0.0.0.0/0` for hosted deploys). |
| `JWT_SECRET` | Long random string. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_ORIGIN` | Allowed frontend origin(s) for CORS, comma-separated. |
| `COOKIE_NAME` | Session cookie name (default `unio_session`). |
| `SEED_DEMO_PASSWORD` | Password given to every seeded demo account. For local or hackathon use only. |
| `DNS_SERVERS` | Optional. Set it if Node can't resolve `mongodb+srv` records (common on Windows), e.g. `8.8.8.8,1.1.1.1`. The app also retries with public DNS automatically. |
| `REVIEWER_PASSWORD` | Password used by `npm run create-reviewer` when provisioning a verification reviewer. |
| `ANTHROPIC_API_KEY` | Optional. Enables the AI Brief Builder (Claude). Without it, “Create with AI” returns a clearly labelled template draft. Server-side only. |
| `BRIEF_AI_MODEL` | Optional. Claude model for the Brief Builder (default `claude-opus-5-5`). |
| `CLOUDINARY_*` | Optional. Media is stored as URLs, so the app works without them. |

The client has one optional variable, `VITE_API_URL` (see `client/.env.example`). Leave it empty in development, where Vite proxies `/api`. Never put secrets in `VITE_*` variables: they end up in the browser bundle.

## Demo data

`npm run seed` is idempotent: it upserts on stable keys, so running it twice creates nothing new. It seeds:

- **5 team member profiles** (Fawaz Ahmed, Sai Charitha, Roha Nawaz, Shameer, Jaison). These are **drafts**: skills, tools and bios are suggestions to be edited by each person, and their emails are `firstname.lastname@unio.example`.
- **10 fictional demo creators** (`isDemo: true`). The UI labels them "Demo".
- **1 reviewer account**, `reviewer@unio.example`, plus a few demo verification claims. These are only ever SELF_REPORTED or PENDING: nothing is seeded as verified.
- **3 demo brands**, 8 campaigns (open, draft and closed), 21 portfolio items, plus applications, invitations and 2 projects.

Every demo account uses the `SEED_DEMO_PASSWORD` password. Useful logins:

| Role | Email |
|---|---|
| Creator | `meera-kulkarni@creators.unio.example` |
| Creator | `zoya-siddiqui@creators.unio.example` |
| Brand | `team@verdant.unio.example` |
| Brand | `studio@northwind.unio.example` |

Portfolio media uses placeholder URLs on the reserved `media.unio.example` domain. The UI renders these as clearly labelled "media pending" artwork, never as broken images. Upload real files to Cloudinary (or any host), then replace the URLs from the creator's Portfolio page before a demo.

## Creator verification

Creators can back up three kinds of claim with evidence links: the **tools** they use, their **AI workflows**, and individual **portfolio pieces**.

| Status | Meaning | Public display |
|---|---|---|
| `SELF_REPORTED` | Listed by the creator, no evidence reviewed | “Self-reported” (no badge) |
| `PENDING` | Evidence submitted, waiting for a reviewer | Clock icon, “Pending review” |
| `VERIFIED` | A reviewer confirmed the evidence | Check mark, “Verified” |
| `REJECTED` | Evidence not sufficient; the reviewer's note goes to the creator | Shown publicly as self-reported |

- **Creator side:** the **Verification** page in the creator dashboard (`/creator/verification`). Each portfolio piece also has a “Verify this piece” link. Creator API payloads have no `status` field, so a creator can only save a claim (SELF_REPORTED) or submit it (PENDING).
- **Reviewer side:** the review queue at `/review`. A reviewer opens the evidence, then marks the claim verified or rejects it with a note. Reviewers use a separate `reviewer` role that can't be chosen at sign-up.
- **Creating a reviewer:** set `REVIEWER_PASSWORD` in `server/.env`, then run:
  ```bash
  npm --prefix server run create-reviewer -- reviewer@yourdomain.com "Reviewer Name"
  ```
- **Automatic resets:** VERIFIED claims are locked. Changing a verified portfolio piece's media sends its claim back to PENDING.
- **Track record:** “Completed on UNIO” counts real completed projects. Client feedback appears only after a brand rates a completed project, once per project. Nothing is shown when there is no data.

## AI Brief Builder

When creating a campaign, a brand can click **Create with AI** and describe the idea in a sentence. `POST /api/brand/briefs/draft` returns these fields, which fill the existing form as a **draft**:

- title, category
- objective, target audience and creative style (written into the brief as labelled sections)
- deliverables
- skills and tools
- budget range
- deadline

The brand edits anything, can undo, and saves through the normal campaign endpoint.

- **With `ANTHROPIC_API_KEY`:** Claude generates the draft using the Anthropic SDK's structured outputs. Every response is then validated and normalized on the server (budgets swapped or capped, deadline clamped to 3–365 days, tags deduplicated, empty deliverables dropped), and anything filled with a default is reported as a warning.
- **Without a key, or on request:** a keyword-based template draft is returned instead, labelled “Template draft (no AI used)”.
- **Errors:** rate limits, timeouts, refusals, malformed responses and API errors each return a clear error code, and the UI offers “Use template instead”.
- **Rate limit:** each brand is limited to 10 drafts per 15 minutes. The key never leaves the server.

## Tests

```bash
npm test
```

47 API integration tests (Node test runner + Supertest) run against an in-memory MongoDB replica set. Claude calls are stubbed with a fake client, so no API key is needed. They cover:

- auth
- role and ownership checks (401, 403 and 404 cases)
- validation
- the apply → accept → project and invite → accept → project workflows
- duplicate blocking
- deliverable and project state transitions
- matching
- seed idempotency and reference integrity
- verification permissions and status lifecycle
- project feedback rules
- brief draft normalization, template fallback and AI error mapping

## How it works

- **Roles:** the user picks `creator` or `brand` at sign-up. The role is always read from the database, and every protected route checks it on the server along with ownership.
- **Intent preservation:** clicking *Apply* or *Invite* while logged out sends you to `/login?returnTo=/campaigns/:id?intent=apply` (or `intent=invite`). After signing in you return to the same page with the form open for review. Nothing is submitted automatically, and `returnTo` only accepts allow-listed internal paths, which prevents open redirects.
- **Projects:** accepting an application, or a creator accepting an invitation, creates exactly one project per campaign and creator pair. This uses a transaction plus an idempotent upsert, backed by a unique index. Deliverables are copied from the campaign brief.
- **Matching:** suggested creators on a campaign's applicants page are ranked by explainable rules: skills 40%, tools 25%, category 20%, budget 10%, availability 5%. Each suggestion shows its reasons.

API reference: every route is in [`server/src/routes/index.js`](server/src/routes/index.js). Responses use `{ success, data }` or `{ success: false, error: { code, message, details } }`.

## Deployment

**API on Render (or similar):**

| Setting | Value |
|---|---|
| Root directory | `server` |
| Build command | `npm install` |
| Start command | `npm start` |
| Environment | the variables above, plus `NODE_ENV=production` |
| `CLIENT_ORIGIN` | your frontend URL |

In production the cookie is `Secure; SameSite=None`, so the API must be served over HTTPS. In Atlas → Network Access, allow the host's outbound IPs (or `0.0.0.0/0`).

**Web on Vercel:**

| Setting | Value |
|---|---|
| Root directory | `client` |
| Framework preset | Vite |
| `VITE_API_URL` | `https://<your-api-host>/api` |

`client/vercel.json` rewrites all routes to the SPA.

## Out of scope (MVP)

Payments, subscriptions, real-time chat, notifications, and direct file uploads. Media is attached by URL.
