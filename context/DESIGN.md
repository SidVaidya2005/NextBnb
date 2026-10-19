# Design system

> **Role:** Define NextBnb's visual rules and responsive behavior. Read every session; use this guide when changing any screen or component.

## Visual direction

NextBnb uses a white canvas, dark text and large property photos. Rausch pink is the only accent. It draws attention to primary actions, the search button and saved hearts; most of the interface stays neutral. Ratings use dark ink rather than gold. See D-020.

The original reference was an analysis of Airbnb. NextBnb adopts its visual language, with Inter as the available font. It does not adopt Airbnb branding, Experiences or Services navigation, Luxe/Plus palettes, maps, legal copy or unsupported badges. The complete original analysis is preserved in [Design reference](../docs/reference/design-reference.md); it is not a list of features to build.

## Colors

These values are implemented in the theme in [globals.css](../src/app/globals.css). Use their utility names rather than repeating hex values in components.

| Token | Value | Use |
| --- | --- | --- |
| `primary` | `#ff385c` | Primary actions, search orb, saved hearts |
| `primary-active` | `#e00b41` | Pressed/active primary action |
| `primary-disabled` | `#ffd1da` | Disabled primary action |
| `ink` | `#222222` | Headings, navigation, ratings |
| `body` | `#3f3f3f` | Running text |
| `muted` | `#6a6a6a` | Supporting text |
| `muted-soft` | `#929292` | Disabled text where suitable |
| `hairline` | `#dddddd` | Default borders and dividers |
| `hairline-soft` | `#ebebeb` | Lighter dividers |
| `border-strong` | `#c1c1c1` | Stronger outlines |
| `canvas` | `#ffffff` | Page background |
| `surface-soft` | `#f7f7f7` | Quiet surface and hover fills |
| `surface-strong` | `#f2f2f2` | Stronger neutral fill |
| `error` | `#c13515` | Validation errors |
| `on-primary` | `#ffffff` | Text on the primary color |

Use a black scrim at 50% opacity where a modal backdrop needs one. Check contrast and disabled states in context; a palette entry alone is not an accessibility guarantee.

## Typography

Inter is loaded in the root layout as `--font-inter` and used by `--font-sans`. Keep display text modest so photos carry the page. The large listing rating is the deliberate exception. These are the reference sizes; use existing component classes and keep any approved deviations explicit.

| Style | Size | Weight | Line height | Letter spacing |
| --- | --- | --- | --- | --- |
| Rating display | 64px | 700 | 1.1 | -1px |
| Display XL | 28px | 700 | 1.43 | 0 |
| Display LG | 22px | 500 | 1.18 | -0.44px |
| Display MD | 21px | 700 | 1.43 | 0 |
| Display SM | 20px | 600 | 1.2 | -0.18px |
| Title MD | 16px | 600 | 1.25 | 0 |
| Title SM | 16px | 500 | 1.25 | 0 |
| Body MD | 16px | 400 | 1.5 | 0 |
| Body SM | 14px | 400 | 1.43 | 0 |
| Caption | 14px | 500 | 1.29 | 0 |
| Caption SM | 13px | 400 | 1.23 | 0 |
| Badge | 11px | 600 | 1.18 | 0 |
| Micro label | 12px | 700 | 1.33 | 0 |
| Uppercase tag | 8px | 700 | 1.25 | 0.32px |
| Button MD | 16px | 500 | 1.25 | 0 |
| Button SM | 14px | 500 | 1.29 | 0 |
| Link | 14px | 400 | 1.43 | 0 |
| Navigation link | 16px | 600 | 1.25 | 0 |

Small tags do not justify adding Airbnb-only products or badges. Match existing NextBnb content and scope.

## Spacing, shape and elevation

Use the existing 4px spacing scale, with 2px micro-spacing where required. Reference steps are 2, 4, 8, 12, 16, 24, 32, 48 and 64px. Major sections use 64px spacing, host/reservation cards use 24px padding, and card columns use 16px gaps. The current listing grid has larger vertical gaps; do not mistake a reference value for a mandate to change working layout.

Buttons and inputs use an 8px radius (`sm`), cards 14px (`md`), with 20px and 32px larger radii available. Search pills and round buttons use fully rounded shapes. Touch controls must remain large enough even when their visible icon is small.

Use the single `shadow-card` definition for elevated cards, search surfaces and dropdowns. Most surfaces remain flat. The exact shadow lives in `globals.css`; do not invent a stack of elevation levels.

## Layout and breakpoints

| Width | Theme prefix | Expected behavior |
| --- | --- | --- |
| Below 744px | Base styles | One listing column; compact navigation; search overlay; booking bottom bar/sheet |
| 744px to below 1128px | `tablet:` | Two listing columns; expanded navigation where space permits |
| 1128px to below 1440px | `desktop:` | Four listing columns; full search and desktop booking rail |
| 1440px and above | `wide:` | Retain the grid and let outside gutters grow |

Search/home content caps at 1440px, general editorial content at 1280px, and listing detail at 1080px. The listing cap resolves a contradiction in the original analysis; use the implemented `wide`, `content` and `listing` container tokens. See D-021.

Build from the narrowest layout upward. Card grids change column count without reordering items. Semantic data tables may scroll horizontally instead of becoming cards; the admin tables are an intentional example.

## Component rules

Primary buttons use Rausch with white text, an 8px radius and a 48px height. Secondary buttons use a white surface and ink outline; tertiary controls are text links. Search is a white pill divided into destination, date and guest segments, ending in a 48px round primary button.

The top navigation is a single-product bar for NextBnb: logo, search and account/navigation controls. Its reference height is 80px. Hide or compact content at the existing breakpoints rather than forcing all labels into a narrow width.

Listing cards put a square photo first, followed by title, location, nightly price and rating or the unrated state. The saved-heart button is a sibling of the card link so saving does not navigate. The original 32px icon-button reference does not override the 44px touch-target minimum. See D-029.

Listing detail uses a gallery, body content and a desktop reservation rail. On mobile the booking bar opens a full-screen sheet; the bar itself does not reserve. The complete price is visible before the actual Reserve action. The large rating appears only when reviews exist.

Inputs use the reference 56px height, 8px radius and clear labels. Error messages explain the needed correction. Date cells are round controls with ink/white selection states; they remain ordinary buttons until a separately approved keyboard-grid change.

The footer uses the existing NextBnb implementation, with route links, attribution and a simulated-bookings notice. It is a content-information landmark with a navigation label distinct from the main navigation. Keep enough bottom padding for the fixed mobile booking bar. A short page still places the footer at the bottom through the root flex layout.

## Accessibility and interaction

Primary actions and the search orb are at least 48×48px; no tap target is below 44px. Provide visible keyboard focus, useful labels and native semantics. Follow the role/name, live-region, dismissal and focus rules in Code standards.

Verify the actual collapse behavior: search overlay, compact navigation, calendar dismissal, booking sheet and bottom bar. Check scrolling and fixed-element overlap as well as screenshots. Existing automated evidence is Chromium-only; a human screen-reader pass remains open.

## How this file is maintained

Update the design rule and its implementation together when an approved change alters a token, component or breakpoint. Keep decisions and accepted deviations traceable. Preserve the old reference analysis as evidence, but do not promote its unused colors or Airbnb-only features into current requirements. Run the context checker and relevant UI checks after visual changes.
