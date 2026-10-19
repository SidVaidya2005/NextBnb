# Deploying NextBnb to Render

> **Role:** The procedure for getting NextBnb live, and the order it has to happen in.
> **Relates to:** `render.yaml` (the Blueprint this applies), `context/architecture.md`
> → Redirect URL responsibilities, `context/code-standards.md` → Environment Variables.

Follow this top to bottom. Three of the steps happen outside Render, and two of
them are ordering-sensitive in ways that fail *silently* — you get a working
build and a broken sign-in, with nothing in any log pointing at the cause.

---

## Before you start

Have open in separate tabs:

- **Render** — https://dashboard.render.com
- **Supabase** — your project → Authentication → URL Configuration
- **Google Cloud Console** — APIs & Services → Credentials → your OAuth 2.0 Client

And have the eight values from your local `.env.local` to hand. They are the same
eight; nothing new is needed for production except the site URL, which you will
not know until step 3.

---

## The one thing to understand first

**`NEXT_PUBLIC_*` variables are compiled into the JavaScript bundle during
`npm run build`. They are not read at runtime.**

Everything awkward about this deploy follows from that single fact:

- Setting a `NEXT_PUBLIC_*` value in the Render dashboard does nothing until you
  **redeploy**. The running server keeps serving the bundle built with the old value.
- `NEXT_PUBLIC_SITE_URL` must be the service's own public URL, which does not
  exist until Render has created the service. So the first build necessarily has
  the wrong value and **must** be followed by a second one.

If sign-in bounces you to `localhost` from production, this is why. Redeploy.

---

## Step 1 — Google Cloud: point the OAuth client at Supabase

**Not at your app.** This is the leg of the flow people get wrong, because it is
the one place the URL is *not* your own domain. Google talks to Supabase; Supabase
talks to your app.

APIs & Services → Credentials → your OAuth 2.0 Client ID → **Authorised redirect URIs**:

```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

Exactly that one entry. It is identical for local and production — you do not add
a Render URL here, now or ever.

> **If this is missing:** Google rejects the sign-in outright with
> `redirect_uri_mismatch`, before Supabase or your app is ever involved.

---

## Step 2 — Render: create the service from the Blueprint

1. Dashboard → **New** → **Blueprint**.
2. Connect the repository and select the branch. Render reads `render.yaml`.
3. It will prompt for every variable marked `sync: false`. Fill in **seven** of
   the eight from `.env.local`:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | from `.env.local` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from `.env.local` |
   | `SUPABASE_SERVICE_ROLE_KEY` | from `.env.local` (see note below) |
   | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | from `.env.local` |
   | `CLOUDINARY_API_KEY` | from `.env.local` |
   | `NEXT_PUBLIC_CLOUDINARY_API_KEY` | same value as `CLOUDINARY_API_KEY` |
   | `CLOUDINARY_API_SECRET` | from `.env.local` |
   | `NEXT_PUBLIC_SITE_URL` | **leave blank — step 3 fills it** |

4. Apply. The first build runs. **Expect sign-in to be broken after it** — that is
   the two-pass behaviour, not a fault.

> **On the service-role key:** nothing in a request path uses it —
> `code-standards.md` restricts it to standalone seed/migration scripts, and the
> admin dashboard deliberately goes through `admin_list_users()` instead. It is
> declared so a seed run from the Render shell has it. If you would rather it
> never exist in the production environment, delete it from `render.yaml` and skip
> it here; the app will not notice.

---

## Step 3 — The second pass: set the real site URL and redeploy

1. Copy the URL Render assigned: `https://<name>.onrender.com`.
2. Service → **Environment** → set `NEXT_PUBLIC_SITE_URL` to it.

   **It is the bare origin — scheme + host, nothing else.** Two ways to get the
   value wrong, both of which produce a site that looks completely healthy:

   | Value | Result |
   | --- | --- |
   | `https://<name>.onrender.com` | ✅ correct |
   | `https://<name>.onrender.com/` | `//auth/callback` — a *protocol-relative* path browsers read as a different origin |
   | `https://<name>.onrender.com/auth/callback` | `/auth/callback/auth/callback` — a **404**. Observed live on 2026-07-29 |

   The last one is the easy mistake, because step 4 below asks for the callback
   URL and it is natural to paste the same string into both. They are different
   values: **Supabase wants the callback path, this variable wants the origin.**
   `signInWithGoogle` appends `/auth/callback` itself.

3. **Manual Deploy → Deploy latest commit.**

Step 3.3 is not optional and is not a cache flush. Without it the bundle still
carries whatever `NEXT_PUBLIC_SITE_URL` was at build time.

---

## Step 4 — Supabase: allow the redirect back into the app

Authentication → **URL Configuration**:

- **Site URL:** `https://<name>.onrender.com`
- **Redirect URLs** — add both, keeping localhost so local dev still works:
  ```
  http://localhost:3000/auth/callback
  https://<name>.onrender.com/auth/callback
  ```

> **If this is missing:** Google consent succeeds, then Supabase refuses to
> redirect back and the user lands on an error page having already authorised.
> The failure appears *after* a successful login, which is why it reads as an app
> bug rather than a configuration one.

---

## Step 5 — Verify, in this order

Each step assumes the previous one passed. If one fails, fix it before moving on —
a later failure caused by an earlier misconfiguration is much harder to read.

- [ ] **The site loads.** `https://<name>.onrender.com` renders the listing grid
      with seeded stays. → Proves the build shipped, Supabase is reachable, and
      anon RLS reads work.
- [ ] **Images are transformed, not just displayed.** Right-click a listing photo →
      the URL should be a Cloudinary or `/_next/image` delivery URL, not a bare
      `images.unsplash.com` link on an uploaded photo. → Proves
      `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` reached the build. If images render but
      untransformed, `ListingImage` has fallen back to its raw-`url` branch, which
      is exactly the degradation it was built to do rather than 500.
- [ ] **`NEXT_PUBLIC_SITE_URL` baked correctly — check this *before* touching a
      browser.** The sign-in button is a no-JS form post, so the OAuth hand-off can
      be triggered with curl and the `redirect_to` it builds read straight off the
      `location` header. Grab the action id out of the page, then post it:

      ```sh
      BASE=https://<name>.onrender.com
      AID=$(curl -s "$BASE/" | grep -o '\$ACTION_ID_[0-9a-f]\{40,\}' | head -1)
      curl -s -i -X POST "$BASE/" -F "$AID=" -F 'next=/' | grep -i '^location:'
      ```

      Decode the `redirect_to` in the result. It must be exactly
      `https://<name>.onrender.com/auth/callback?next=%2F` — **one**
      `/auth/callback`, no doubling, no `//`. If it is doubled or protocol-relative,
      the variable is wrong: fix it and **redeploy** (step 3), because no amount of
      Supabase or Google configuration can compensate for a bad `redirectTo`.
      → Proves the two-pass build actually took, without spending a Google consent.

- [ ] **Google sign-in completes** and returns you to the page you started from.
      → Proves all three redirect allow-lists agree.
- [ ] **Sign-in from a deep link returns you there,** not to `/`. Open
      `/listings/<some-id>` signed out, click a heart, sign in. → Proves
      `safeNextPath` and the `next` round trip.
- [ ] **A favorite persists.** Save a listing, then open `/favorites`. → Proves
      an authenticated write and its `revalidatePath`.
- [ ] **`/admin` redirects you home** unless your profile has `is_admin`. → Proves
      the route gate survived the deploy.

---

## When something is wrong

| Symptom | Cause |
| --- | --- |
| `redirect_uri_mismatch` at Google | Step 1 missing, or points at your app instead of Supabase |
| Consent succeeds, then an error page | Step 4 missing — Supabase will not redirect to an unlisted URL |
| Sign-in bounces to `localhost` | `NEXT_PUBLIC_SITE_URL` baked at build. Step 3, including the redeploy |
| Sign-in lands on `//auth/callback` | Trailing slash on `NEXT_PUBLIC_SITE_URL` |
| Sign-in lands on `/auth/callback/auth/callback` (404) | `NEXT_PUBLIC_SITE_URL` was set to the **callback URL** instead of the origin — the value step 4 wants, pasted into step 3. Set it to the bare `https://<name>.onrender.com` and redeploy |
| Photos route 500s | `NEXT_PUBLIC_CLOUDINARY_API_KEY` unset — `CldUploadWidget` throws during render |
| Health check fails, build was green | `/` cannot reach Supabase. Check the URL and anon key |
| First request after idle takes ~30s | The `free` plan spun down. Expected; upgrade to `starter` to stop it |

---

## Supabase keep-alive

As of 2026-10-19, cron-job.org job `8675651` checks Supabase directly at 09:00 Asia/Kolkata on the 1st, 4th, 7th and subsequent three-day dates through the 31st. Month boundaries can shorten the interval. It reads at most one published listing through the Data API using a publishable key and existing anonymous access policies. It does not contact Render or perform a write.

The job emails the cron-job.org account after one failure, on recovery and on automatic disablement. Its timeout is 30 seconds; response bodies are not saved. Manage it in the [cron-job.org console](https://console.cron-job.org/), then inspect execution history for HTTP 200. If the public key is rotated or revoked, replace the job's `apikey` header and test again. Never use a service-role key for this check.

This is a free-tier mitigation. Supabase's [pausing policy](https://supabase.com/docs/guides/platform/free-project-pausing) evaluates low database activity, so one query every three days does not guarantee the project will remain active. Resume a paused project in the Supabase dashboard; upgrading to Pro removes inactivity pausing. The job does not prevent Render cold starts. See [Setup and verification](../context/work-notes.md#supabase-keep-alive-2026-10-19).

## Known gaps at deploy time

Recorded here rather than discovered later. Both are tracked in
`context/progress-tracker.md`.

- **Email/password signup is reachable on the Supabase project**, even though the
  app offers Google only, because the Playwright fixture signs in through it and
  `disable_signup` is `false`. Low severity — email confirmation is required and
  the resulting account is an ordinary guest with no privilege path (RLS + column
  grants) — but it is a real gap between the docs and the live config. The fix is
  a **separate Supabase project for E2E** so production can disable the provider
  outright. Out of scope for F18 by agreement; still open.
- **`e2e/global-setup.ts` reads `.env.local` from disk** via
  `process.loadEnvFile()`. It therefore cannot run in an environment that supplies
  variables through the process environment instead of a file. This does not affect
  the deploy — the E2E suite does not run on Render — but it is the thing to fix
  first if CI is ever added.
