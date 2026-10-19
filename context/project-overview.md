# Project overview

> **Role:** Explain what NextBnb does, who uses it and what belongs in scope. Read first in every session.

## The product

NextBnb is a portfolio application for finding and booking short-term stays. A guest can search for a place, inspect its photos and reviews, and reserve available dates. The reservation is confirmed immediately. No card details are collected and no money changes hands.

Guests and hosts share one account model. Any signed-in user can create a listing and act as a host. A small set of administrators can moderate users, listings and bookings.

The original 18-feature build is complete. The last recorded live deployment is at [nextbnb-h4ov.onrender.com](https://nextbnb-h4ov.onrender.com). Deployment and verification claims retain their recorded dates; the URL has not been retested as part of the documentation rewrite.

## What users can do

A guest searches by destination, dates, number of guests, price, property type and amenities. Filters stay in the URL, so searches can be shared and restored after a reload. Listing pages show photos, amenities, house rules, location text, the host and reviews.

After choosing dates, the guest sees the nightly charge, cleaning fee and service fee before reserving. Upcoming and past stays appear under Trips. An eligible upcoming booking can be cancelled, freeing its dates. After checkout has passed, the booking's guest can leave one review.

A host creates a draft listing, adds photos, sets a cover image and publishes it. The host can edit details, change pricing, block dates, unpublish, and delete a listing when the deletion rules allow it. Reservations across the host's listings appear in one view. Hosts cannot cancel guest reservations in this build.

Guests can start a conversation from a listing page. Messages arrive live while the thread is open. Hosts can reply; the inbox updates when revisited. Administrators can view users, unpublish or delete listings, and cancel bookings. They cannot read private message threads.

## Pages and navigation

| Page | Purpose and access |
| --- | --- |
| `/` | Public search and listing grid |
| `/listings/[id]` | Listing details; published listings are public, drafts are visible to their host and admins |
| `/favorites` | A signed-in user's saved listings |
| `/trips` | The user's bookings as a guest |
| `/host/listings` | The host's published listings and drafts |
| `/host/listings/new` | Create a draft |
| `/host/listings/[id]/edit` | Edit listing details |
| `/host/listings/[id]/photos` | Manage photos, order, cover and publishing |
| `/host/listings/[id]/availability` | Add and remove blocked dates |
| `/host/reservations` | Incoming reservations across owned listings |
| `/messages` and `/messages/[threadId]` | Inbox and private conversation |
| `/admin` | Admin-only moderation |
| `/auth/callback` | OAuth return handler; no page UI |
| `/api/sign-cloudinary` | Authenticated upload-signing endpoint; no page UI |

The top navigation provides access to search, favorites, trips, hosting, messages and the account menu. Signed-out users see Google sign-in. A protected action sends a signed-out user through sign-in and returns them to a safe local destination. Non-admins visiting `/admin` are sent home.

## Scope

The build includes Google sign-in, discovery and filtering, listing details, favorites, instant reservations, trips and cancellation, hosting with photo uploads and blocked dates, reviews, private messaging, an admin dashboard and sample data.

The following remain outside scope: real payments or payouts; maps or geocoding; email, SMS or push notifications; host approval before booking; multiple currencies or languages; Superhost status; multiple wishlists; seasonal pricing; and native mobile apps. Location is text only. These choices keep the project focused on the marketplace flows. See D-001 in [Decision records](decisions.md#product-and-system-decisions).

## Success criteria

These were reported met at the original build's close on 2026-07-29. They remain the acceptance criteria for future changes, subject to the verification limits below.

- Google sign-in returns the user to the page they started from.
- Search returns matching, published listings available for the requested dates.
- A reservation appears in Trips and prevents an overlapping confirmed reservation.
- An eligible cancellation frees the dates.
- A host can create a listing with photos, publish it, block dates and inspect reservations.
- A guest can leave exactly one review per completed booking, and averages display correctly.
- Guests and hosts can exchange messages without reloading an open thread.
- Admin functions are available only to admins; private records remain restricted to their permitted users.
- Every screen works across the documented phone, tablet, laptop and wide layouts.

The recorded acceptance evidence combines automated tests against a development server with manual checks of the deployment. The production-build suite has an older baseline. Cloudinary transform delivery on the deployed site and a human screen-reader pass remain unverified. See [Open work](progress-tracker.md#open-work) and [Standing constraints](standing-constraints.md).

## How this file is maintained

Update this file when product behavior, access, scope or acceptance criteria change. Record the decision and reason in its authoritative home, then update the build/work notes and tracker. Keep implementation details in Architecture and preserve old acceptance evidence in history rather than relabelling it as current.
