# UNIO --- Where Creators and Brands Unite

UNIO is a marketplace connecting AI content creators with brands and
creative agencies. Brands publish creative briefs, review proposals,
invite creators, and manage engagements. Creators showcase portfolios,
apply to campaigns, respond to invitations, and deliver projects. Anyone
can browse public pages; an account is required to take actions.

**Stack:** React 19, Vite, Tailwind CSS 4, React Router, TanStack Query,
React Hook Form, Zod, Express 5, Mongoose 9, MongoDB Atlas (`invitaizen`
database), and JWT sessions in HTTP-only cookies.

**web application link :**  'https://unio-psi.vercel.app/'

## Repository structure

``` text
unio/
├── client/                 React app (Vite)
├── server/                 Express API, Mongoose models, seed script, tests
├── IMPLEMENTATION_PLAN.md
└── package.json            Root scripts
```

## Quick start

**Requirements:** Use a supported Node.js LTS release. The project has
been developed with Node.js 25; verify the app and tests with your
chosen Node.js version before the demo.

``` bash
npm run install:all
cp server/.env.example server/.env
# Edit server/.env and add your local configuration.
npm run seed
npm run dev
```



### Running without MongoDB Atlas

``` bash
npm run dev:memory
```

This starts a temporary in-memory MongoDB instance, seeds demo data, and
runs both apps. Data is discarded when the process stops. Use this for
local development and demos only, not persistent production data.

## Environment variables

Configure backend variables in `server/.env`. Start from
`server/.env.example`.

  -----------------------------------------------------------------------------------------------------------------
  Variable                            Purpose
  ----------------------------------- -----------------------------------------------------------------------------
  `MONGODB_URI`                       MongoDB Atlas connection string using the `invitaizen` database.

  `JWT_SECRET`                        Long, random secret used to sign sessions/tokens. Generate one locally, for
                                      example with
                                      `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

  `CLIENT_ORIGIN`                     Allowed frontend origin(s) for CORS. Use the exact deployed frontend origin.

  `COOKIE_NAME`                       Session cookie name; defaults to `unio_session` if not configured.

  `SEED_DEMO_PASSWORD`                Password assigned to seeded demo accounts. Set a strong value and share it
                                      only with intended demo users.

  `DNS_SERVERS`                       Optional DNS resolver override if Node.js cannot resolve MongoDB SRV records.

  `REVIEWER_PASSWORD`                 Password used when provisioning a reviewer account. Keep it private.

  `ANTHROPIC_API_KEY`                 Optional server-side key enabling AI-generated campaign brief drafts.

  `BRIEF_AI_MODEL`                    Optional model identifier for the Anthropic provider. Verify it against the
                                      provider's current model documentation.

  `OPENROUTER_API_KEY`                Optional alternative provider key. Used when the Anthropic key is not
                                      configured.

  `OPENROUTER_MODEL`                  Optional OpenRouter model ID. Choose a currently available model that
                                      supports the response format required by the app.

  `CLOUDINARY_*`                      Optional media-hosting configuration if the app's upload integration uses it.
                                      The app can also store externally hosted media URLs.
  -----------------------------------------------------------------------------------------------------------------

The client may use `VITE_API_URL` as documented in
`client/.env.example`. Never put secrets in `VITE_*` variables:
client-side variables can be included in the browser bundle.

**Secrets:** Do not commit `.env` files, API keys, database credentials,
reviewer passwords, or real demo passwords. Keep `.env.example` limited
to placeholder values.

## Demo data

Run `npm run seed`. The seed script is documented as idempotent and uses
stable keys to avoid duplicate records on repeated runs. According to
the current project documentation, it seeds:

-   Five team-member creator profiles: Fawaz Ahmed, Sai Charitha, Roha
    Nawaz, Shameer, and Jaison. Their bios, tools, and skills are drafts
    and should be reviewed by the respective people.
-   Ten fictional demo creators, marked as demo accounts.
-   One reviewer account and sample verification claims.
-   Three demo brands, eight campaigns, 21 portfolio items, plus sample
    applications, invitations, and two projects.

The seed script uses `SEED_DEMO_PASSWORD` for demo accounts. Set it in
`server/.env` before seeding.

Example demo login emails documented by the project:

  Role      Email
  --------- ----------------------------------------
  Creator   `meera-kulkarni@creators.unio.example`
  Creator   `zoya-siddiqui@creators.unio.example`
  Brand     `team@verdant.unio.example`
  Brand     `studio@northwind.unio.example`

These are example/demo identities, not real email inboxes. Do not
publish the shared demo password in a public repository.

### Portfolio media

Some seeded portfolio items use placeholder URLs under
`media.unio.example`; these are not real media assets. Before a live
demo, replace placeholders for the profiles and campaigns you intend to
show with working, authorized image/video URLs. Open each URL in a
browser and confirm it loads.

UNIO stores media URLs and metadata rather than large media binaries in
MongoDB.

## Creator verification signals

Creators can submit evidence for tools, AI workflows, and individual
portfolio pieces.

  -----------------------------------------------------------------------
  Status                  Meaning                 Public display
  ----------------------- ----------------------- -----------------------
  `SELF_REPORTED`         Creator-listed claim    Shown as self-reported
                          without reviewed        
                          evidence                

  `PENDING`               Evidence submitted and  Pending review
                          awaiting review         

  `VERIFIED`              A reviewer reviewed and Verified
                          confirmed the evidence  

  `REJECTED`              Evidence was not        Displayed as
                          sufficient; a reviewer  self-reported
                          note may explain why    
  -----------------------------------------------------------------------

Creators manage submissions through `/creator/verification`; portfolio
pieces may also offer a verification action. A separate reviewer role
reviews submissions through `/review`. A creator must not be able to set
their own status to `VERIFIED`.

To provision a reviewer, set `REVIEWER_PASSWORD` in `server/.env`, then
use the project script:

``` bash
npm --prefix server run create-reviewer -- reviewer@yourdomain.com "Reviewer Name"
```

Use an address controlled by your team for a real reviewer account.
Never publish the reviewer password.

The project documentation states that verified claims are locked and
that changing the media for a verified portfolio item sends its claim
back to pending review. "Completed on UNIO" and client feedback should
reflect actual project records; do not invent reviews or verification
results.

## AI-Assisted Brief Builder

When creating a campaign, a brand can choose **Create with AI** and
describe the idea in ordinary language. The documented backend endpoint
is `POST /api/brand/briefs/draft`.

The generated draft can include campaign title and category, objective,
target audience, creative style, deliverables, required skills and
tools, budget range, and deadline. The result populates the existing
campaign form as a draft. The brand can edit it before saving through
the normal campaign workflow; it should never publish automatically.

-   **With an Anthropic API key:** the backend requests a structured
    draft and validates/normalizes the response.
-   **With an OpenRouter API key:** the backend can use a configured
    compatible model and the same validation path.
-   **Without an API key or when template fallback is selected:** the
    app returns a clearly labelled template draft. This fallback is
    rule-based and should not be described as AI-generated.
-   **Errors:** check the returned error message and use the template
    fallback when available.
-   **Rate limiting:** the project documentation specifies ten brief
    drafts per brand per 15 minutes.

Keep provider keys on the backend only. Test the AI path with the exact
configured model and valid provider credits; also test the no-key
fallback.

## Tests and build checks

Run these from the repository root:

``` bash
npm test
npm run build
```

The existing project documentation reports 50 API integration tests
using Node's test runner, Supertest, and an in-memory MongoDB replica
set. Treat that number as an expectation until `npm test` passes in the
current checkout. AI provider calls are intended to be stubbed in tests
so a live API key is not required.

Tests cover authentication, role and ownership checks, validation,
application and invitation workflows, project creation, duplicate
prevention, project state transitions, matching, seed idempotency,
verification permissions, feedback rules, brief normalization, template
fallback, and AI error handling.

If a command is missing from `package.json`, use the scripts that are
actually present and update this README to match the repository.

## Roles and core workflows

-   **Roles:** users choose `creator` or `brand` at registration.
    Protected operations must check the user's role and resource
    ownership on the server.
-   **Apply:** logged-out visitors are returned to the intended campaign
    after authentication. The application must be explicitly submitted
    by the creator.
-   **Invite:** brands invite creators to campaigns they own. Creators
    can accept or decline invitations.
-   **Projects:** accepting an application or invitation should create
    at most one project for a campaign/creator pair.
-   **Matching:** the project documentation lists skills (40%), tools
    (25%), category (20%), budget (10%), and availability (5%).
-   **API responses:** the documented response envelope is
    `{ success, data }` for success and
    `{ success: false, error: { code, message, details } }` for errors.

For the route list, see `server/src/routes/index.js`.

## Deployment

### API --- Render or another Node.js host

Verify these settings against your actual host and repository:

  -----------------------------------------------------------------------
  Setting                             Value
  ----------------------------------- -----------------------------------
  Root directory                      `server`

  Install command                     `npm install`

  Start command                       `npm start`

  Environment                         Required variables from above and
                                      `NODE_ENV=production`

  `CLIENT_ORIGIN`                     Exact deployed frontend origin
  -----------------------------------------------------------------------

Serve the API over HTTPS in production. Configure secure cookies and
proxy trust according to the hosting provider and the app's actual
Express configuration.

**MongoDB Atlas network access:** Prefer allowing only the outbound IP
addresses needed by your backend host, where stable egress IPs are
available. Otherwise evaluate the host's recommended networking options
and your security requirements. Avoid `0.0.0.0/0` unless you consciously
accept the exposure and have assessed the risk.

### Frontend --- Vercel

The project documentation says the Vercel configuration rewrites API
requests to the deployed backend and routes frontend paths to the SPA.
Verify `client/vercel.json` contains the correct current backend URL
before deploying. If the backend URL changes, update the rewrite and
redeploy.

  -----------------------------------------------------------------------
  Setting                             Value
  ----------------------------------- -----------------------------------
  Root directory                      `client`

  Framework preset                    Vite

  `VITE_API_URL`                      Leave empty if the configured
                                      `/api` rewrite is used
  -----------------------------------------------------------------------

### Add your real deployment links

Replace these placeholders before publishing:

-   **Live app:** `ADD_YOUR_VERCEL_URL`
-   **Public GitHub repository:** `https://github.com/fawazahmed-byte/Unio.git`
-   **API health endpoint (if available):** `https://unio-gq3j.onrender.com/api/health`

Do not leave placeholder URLs in the final submission.

## Out of scope for this MVP

Payments, subscriptions, real-time chat, notifications, and direct file
uploads are outside the documented MVP scope. Portfolio media is
attached by URL.

## Pre-submission checklist

-   [ ] `npm run install:all` works from a fresh clone.
-   [ ] `npm test` passes and the README test count matches the result.
-   [ ] The production build succeeds.
-   [ ] `npm run seed` works and can be safely rerun.
-   [ ] `.env` and credentials are not committed.
-   [ ] Atlas access is restricted appropriately for deployment.
-   [ ] AI generation and template fallback have both been tested.
-   [ ] Reviewer verification flow has been tested with the reviewer
    role.
-   [ ] Demo portfolio URLs load and intended demo screens show no
    placeholder media.
-   [ ] Live app and GitHub links have been added.
-   [ ] Demo login instructions are available without exposing passwords
    publicly.
