# NextBnb

A full-stack Airbnb-style marketplace where users discover, filter, and instantly
book short-term stays — and any user can host: create listings, upload photos, set
pricing and availability, and manage reservations. Includes favorites, reviews, and
guest↔host messaging.

> **Status:** Pre-build. The `context/` folder and `CLAUDE.md` define the product,
> architecture, and build plan; application code has not been written yet.
> Building starts at Feature 01 in `context/build-plan.md`.

## Stack

- **Next.js 16** (App Router, React Server Components, server actions) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS v4** — design tokens from `context/DESIGN.md`
- **Supabase** — Postgres, Google OAuth, Row Level Security, Realtime
- **Cloudinary** — image storage, optimization, responsive delivery
- **Zod** + **react-hook-form**, **date-fns**
- **Vitest** (unit) + **Playwright** (E2E)
- Deploys to **Render** (Web Service)

## Requirements

- Node.js **≥20.9** (LTS) and TypeScript **≥5.1** (Next.js 16 minimums)
- Accounts: a Supabase project, a Google OAuth client, and a Cloudinary account (free tier)

## Getting started

The repo currently ships the planning docs plus starter config (`.nvmrc`,
`.env.example`). The Next.js app itself is scaffolded in **Feature 01** of the
build plan, which creates `package.json` and the npm scripts.

Works now:

```bash
nvm use                      # Node 20 (reads .nvmrc)
cp .env.example .env.local   # then fill in the values below
```

After Feature 01 has scaffolded the app:

```bash
npm install
npm run dev                  # http://localhost:3000
```

## Environment variables

Set these in `.env.local` (dev) and in the Render dashboard (prod). Full table in
`context/code-standards.md` → Environment Variables.

| Variable | Secret? |
| -------- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** |
| `NEXT_PUBLIC_SITE_URL` | no |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | no |
| `CLOUDINARY_API_KEY` | sensitive |
| `CLOUDINARY_API_SECRET` | **yes** |

## Scripts

Defined by Feature 01; available once the app is scaffolded.

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck |
| `npm run test` | Vitest unit/component tests |
| `npm run test:e2e` | Playwright end-to-end tests |

## Project docs

The `context/` folder is the source of truth. Start with `CLAUDE.md`, then read
`context/` in the order listed there: project overview → architecture → code
standards → library docs → build plan → progress tracker, plus `DESIGN.md` for the
visual system.

## Out of scope

Real payments, interactive maps, email/push notifications, request-to-book approval,
multi-currency/i18n, and Airbnb branding or sub-brands.
