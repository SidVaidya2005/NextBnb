# Project Overview

> **Role:** Product source of truth — what this product is, who it's for, what's in and out of scope.
> **Read first**, before any other context file.
> **Relates to:** scope drives `build-plan.md`; progress tracked in `progress-tracker.md`.

## About the Project

NextBnb is a full-stack Airbnb-style marketplace for short-term stays. Guests
discover accommodations (homes, apartments, villas, cabins, and other unique
stays), filter by destination, dates, guests, price, property type, and
amenities, save favorites, and book instantly. Any signed-in user can also
become a host: create listings, upload photos, set pricing, availability, and
house rules, and manage the reservations that come in. Guests and hosts message
each other in-app, and guests review stays after they finish.

## The Problem It Solves

Travelers need one place to find and book a stay that fits their trip — the
right city, dates, group size, and budget — while property owners need a simple
way to list a space and manage bookings. Without a unified platform, discovery,
availability, and reservation management are scattered across listings, emails,
and spreadsheets. NextBnb brings search, booking, hosting, and communication
into a single application.

## Pages

- **Home / Search Results (`/`)** — Search bar (destination, dates, guests) plus a filterable grid of listing cards; the primary discovery surface.
- **Listing Detail (`/listings/[id]`)** — Photo gallery, description, amenities, house rules, location text, host info, reviews, and the booking widget.
- **Favorites (`/favorites`)** — The signed-in user's saved listings.
- **Trips (`/trips`)** — The user's bookings as a guest: upcoming and past reservations, with cancel.
- **Host — Listings (`/host/listings`)** — The user's own listings with create / edit / publish / delete.
- **Host — Create/Edit Listing (`/host/listings/new`, `/host/listings/[id]/edit`)** — Multi-section form for listing details, photos, pricing, availability, and rules.
- **Host — Reservations (`/host/reservations`)** — Incoming bookings across the user's listings.
- **Messages (`/messages`)** — Inbox of guest ↔ host conversation threads with realtime updates.
- **Admin (`/admin`)** — Internal moderation dashboard (users, listings, bookings); admins only.
- **Auth callback (`/auth/callback`)** — OAuth redirect handler; not a user-facing page.

## Navigation

A persistent top navigation bar exposes search (on `/`), a favorites link, a
"Trips" and "Host" menu, a messages link, and a user avatar menu (profile,
sign out) when signed in, or a "Sign in with Google" action when signed out.
Listing cards link to Listing Detail. Attempting a protected action or page
(favoriting, booking, `/trips`, `/host/**`, `/messages`, `/admin`) while signed
out redirects to Google sign-in and returns the user to where they were. The
`/admin` area is reachable only by users flagged as admins; everyone else is
redirected home.

## Core User Flow

### Discover

The guest lands on Home, enters a destination, check-in/check-out dates, and a
guest count, and applies filters (price range, property type, amenities). The
system queries published listings that match and are available for the dates,
and renders a grid of listing cards with cover photo, title, location, price
per night, and average rating.

### Inspect

The guest opens a Listing Detail page and sees the photo gallery, full
description, amenities, house rules, location text, host, and existing reviews.
A booking widget shows the price per night and a date/guest picker.

### Book

The guest selects available check-in/check-out dates and a guest count. The
system verifies the range is free (no overlapping confirmed booking and no
host-blocked dates), computes a price breakdown (nights × nightly rate +
cleaning fee + service fee), and on "Reserve" creates a **confirmed** booking
immediately (Instant Book, no payment). Those dates are then blocked for other
guests.

### Manage as guest

The booking appears under Trips. The guest can view details and cancel an
upcoming reservation, which frees the dates. After checkout has passed, the
guest can leave a rating and review for that stay.

### Host

Any signed-in user opens the Host area, creates a listing (details, photos,
pricing, availability blocks, house rules), and publishes it. Incoming bookings
appear under Host → Reservations. Hosts and guests can message each other about
a listing.

## Data Architecture

### Identity

User profiles mirrored from Supabase Auth (Google accounts), including display
name, avatar, and an admin flag. "Host" is not a separate account type — any
user who creates a listing acts as a host.

### Listings

The core catalog: each listing has descriptive details, location text, property
type, capacity, pricing, amenities, house rules, publish state, its photos, and
host-managed blocked-date ranges (availability).

### Reservations

Bookings link a guest to a listing for a date range, storing a price snapshot,
guest count, and status. Availability is derived from confirmed bookings plus
host-blocked dates.

### Engagement

Favorites (saved listings per user), reviews (one per completed booking), and
messaging (threads between a guest and host, with messages).

## Features In Scope

- Google (OAuth) sign-in and sign-out with cookie-based sessions.
- Browse published listings in a responsive card grid.
- Search and filter by destination/city, check-in/check-out dates, guest count, price range, property type, and amenities.
- Listing detail page with photo gallery, amenities, house rules, location text, host info, and reviews.
- Save/remove favorites and a dedicated favorites page.
- Instant Book: date + guest selection, availability check, price breakdown, confirmed reservation, with booked dates blocked.
- Trips: guest reservation history (upcoming/past) with cancellation.
- Hosting: create, edit, publish/unpublish, and delete listings, including photo uploads.
- Host-managed availability via blocked-date ranges.
- Host reservations view across owned listings.
- Reviews & ratings after a completed stay, with average rating on listings.
- In-app guest ↔ host messaging with realtime message delivery.
- Admin dashboard to view/moderate users, listings, and bookings.
- Seeded sample data (listings, photos, demo users) for a populated first run.

## Features Out of Scope

- Real payments / payout (bookings are simulated — no card capture, no money movement).
- Interactive/pannable maps and geocoding (location is text only; no lat/lng, no map pins).
- Email / SMS / push notifications (transactional emails are not built).
- Request-to-book / host approval flow (all bookings are Instant Book).
- Multi-currency and internationalization (single currency, single locale).
- Superhost status, wishlists beyond a single favorites list, and dynamic/seasonal pricing.
- Mobile native apps (responsive web only).

## Target User

Two roles sharing one account model: **guests** planning a trip who want to
search, compare, and book a stay quickly; and **hosts** — ordinary users who
own a space and want a simple way to list it, control availability and pricing,
and manage incoming reservations. A small set of **admins** moderate the
platform's users and content.

## Success Criteria

- A user can sign in with Google and is returned to the page they started from.
- Search with any combination of destination, dates, guests, price, property type, and amenities returns only matching, available, published listings.
- A guest can complete a booking end to end; the reserved dates become unavailable to other guests and the booking shows under Trips.
- A guest can cancel an upcoming booking and the dates are freed.
- A host can create a listing with photos, publish it, block dates, and see incoming reservations for it.
- Availability is never double-booked: two confirmed bookings can never overlap on the same listing.
- A guest can leave exactly one review per completed booking, and the listing shows the correct average rating.
- A guest and host can exchange messages in a thread and see new messages without reloading.
- An admin can view and moderate users, listings, and bookings; a non-admin cannot reach `/admin`.
- Every data access is correctly scoped by ownership (no user can read or mutate another user's private data).
