# NextBnb

A full-stack Airbnb-style marketplace where users discover, filter, and instantly
book short-term stays — and any user can host: create listings, upload photos, set
pricing and availability, and manage reservations. Includes favorites, reviews, and
guest↔host messaging.

> **Status:** Complete and deployed — **[nextbnb-h4ov.onrender.com](https://nextbnb-h4ov.onrender.com)**.
> All 18 features in `context/build-plan.md` are built and shipped. See
> `context/progress-tracker.md` for the verification baselines and the short list
> of known limitations kept open deliberately.
>
> On the free Render plan the service spins down when idle, so the first request
> after a quiet period takes ~30s. That is the plan, not the app.

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

```bash
nvm use                      # Node 20 (reads .nvmrc)
cp .env.example .env.local   # then fill in the values below
npm install
npm run dev                  # http://localhost:3000
```

The app needs a seeded Supabase project to show anything: apply the migrations in
`supabase/migrations/` and run `supabase/seed.sql`. Note that the seed **begins
with a cascading `delete from auth.users`** — never run it against a database
holding real accounts.

## Environment variables

Set these in `.env.local` (dev) and in the Render dashboard (prod). Full table
with rationale in `context/code-standards.md` → Environment Variables.

| Variable | Secret? |
| -------- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no (RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** — seed/migration scripts only, never a request path |
| `NEXT_PUBLIC_SITE_URL` | no |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | no |
| `CLOUDINARY_API_KEY` | no — a public identifier, see below |
| `NEXT_PUBLIC_CLOUDINARY_API_KEY` | no — same value as above |
| `CLOUDINARY_API_SECRET` | **yes** |

**Eight, not seven** — this table previously omitted `NEXT_PUBLIC_CLOUDINARY_API_KEY`
and mislabelled `CLOUDINARY_API_KEY` as sensitive. Cloudinary's `api_key` is a
public identifier that ships with every browser upload, which is why it is
duplicated into a `NEXT_PUBLIC_` variable that `CldUploadWidget` needs; the
**secret** is what authorises an upload, and it never leaves the server.

## Deploying

See **`docs/deploy-render.md`**. The short version: apply `render.yaml` as a
Render Blueprint, then register the redirect URLs in three separate places
(Google Cloud → Supabase → `NEXT_PUBLIC_SITE_URL`). `NEXT_PUBLIC_*` values are
baked in at build time, so the site URL needs a second deploy after the service
exists — the runbook explains why.

## Scripts

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
visual system. `context/build-journal.md` is the per-feature archive — decisions,
gotchas and verification numbers — read on demand rather than every session.

## Out of scope

Real payments, interactive maps, email/push notifications, request-to-book approval,
multi-currency/i18n, and Airbnb branding or sub-brands.
