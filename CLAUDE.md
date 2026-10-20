# UNIO — notes for Claude Code

UNIO is an AI content creator marketplace (MERN): React 19 + Vite + Tailwind 4 + TanStack Query in `client/`, Express 5 + Mongoose 9 + Zod in `server/`. Round 1 works; we are building **Round 2** on branch `round-2`.

## Read first
- `docs/ROUND2_BUILD_GUIDE.md` — the full plan: design system, page map, schema/API changes, feature rules F1–F7, phased steps, Azure changes. Work **one phase at a time** (section 11), plan first, then build.
- `design/UNIO-design-v9.html` — the final look (open in a browser; screens are `S2.<ID>=` functions). `design/screens/*.jpg` — full-page screenshots of every screen. `design/logo/` — logo files.

## Rules
- The final site must match v9 (Steel palette, Manrope + JetBrains Mono). No new colours; the logo is the only multi-colour element.
- Keep Round 1 behaviour and all existing tests passing (`npm test`). Add tests for every new rule.
- Server conventions: route guards in `server/src/routes/index.js`, Zod validators, services hold business rules, `ok()` responses, `ApiError` codes, 403 wrong role / 404 not yours / 409 conflicts, `withTransaction()` for multi-document writes. Env only via `server/src/config/env.js`.
- Client: only `client/src/services/api.js` calls fetch; filters live in the URL; every list has loading/empty/error states; check 1440 px and 390 px.
- Controlled lists (taxonomy) — no free-text categories/skills/specializations.
- Never invent stats, reviews or verification. The rights card is "not a legal contract".
- Ask Fawwaz before: new dependencies (allowed: `@azure/storage-blob`), destructive migrations, changing a Round 1 rule, or cutting scope.
- Commit after each phase with a clear message.

## Commands
`npm run install:all` · `npm run dev` (Atlas/Azure DB via server/.env) · `npm run dev:memory` (in-memory seeded DB) · `npm test` · `npm run build` · `npm run seed` · `npm --prefix server run create-reviewer -- <email> "Name"`
