# Flavory — design blueprint (v2, /3d-master redesign)

**Vibe:** Energy 3 · Dark 5 · Warm 1 · Organic 1 · Playful 2 · Rich 4
**Archetype:** Dark Gold Luxury × Warm Craft. A chef's brand with real depth, not a fast-food template.

**Why v1 failed:** flat plum blocks, the same fade on everything, and empty menu cards (no food photos).
v2 adds layered depth (cutout in front of giant type), a signature moment, designed card visuals and section transitions.

**Tokens:** plum `#1E0C29` / `#2A1238` / `#150820` · ivory `#FBF4E8` (paper chapters) · gold `#C9A45C` is the only accent · kraft `#B58A5C` for the box · grain overlay 7%.
**Type:** Playfair Display (hero word 21–25vw); Cormorant Garamond italic for the accent half of headlines (`<em>`); Great Vibes for "Flavory", the preloader and the signature only; Montserrat body 16px.
**Motion:** GSAP 3.15 (ScrollTrigger, SplitText) + Lenis on desktop only (phones keep native scroll). `expo.out`, ~1.1 s, stagger .06–.1. Transform and opacity, plus clip-path for card wipes.
**Stack:** plain HTML, CSS, vanilla JS. GSAP and Lenis are vendored in `public/vendor/`, no build step. Cart, checkout and receipt load no animation library.

| # | Section | Elements | Energy |
|---|---|---|---|
| P | Preloader, once per session | P1 × P5: gold ring draws round the "Flavory" script, letters deblur, panel lifts (≈2 s) | 2 |
| 01 | Hero | H9: giant "CRISPY" with Chef Shaheen's cutout in front; gold orbit ring; T1 line reveal; magnetic pill CTA; scroll parallax | 4 |
| 02 | Ticker | M5 marquee, speed follows scroll | 2 |
| 03 | Promise | T2 word-by-word highlight (calm) | 2 |
| 04 | From the kitchen | Card clip-wipe batch reveal, pointer tilt + gold sheen (desktop), fly-to-cart dot | 3 |
| 05 | **Signature: The Kraft Box** | CSS-3D Flavory box, steaming open → lid closes → turns and lifts, scrubbed through four steps. Pinned 260% desktop / 170% phone | 5 |
| 06 | Meet the chef | Ivory card expands to full bleed; chef breaks out of the arch; credential cards rise | 2 |
| 07 | Guarantee | Seal stamps down with a ring ripple; T11 circular text turning | 2 |
| 08 | Delivery & hours | Calm facts row | 1 |
| 09 | Reviews | C14 tilted cards (empty state for now) | 1 |
| F | Footer | F2 "Fried fresh, right now." CTA + F1 giant "Flavory" letters rise | 2 |

**Energy:** 26. **Persistent:** M3 nav hides on scroll down, M4 gold progress line, M1 cursor dot (desktop), cross-page View Transitions.
**Reduced motion:** no preloader, no pin, no smooth scroll; the box steps show as a plain list.
**Card visuals until real photos exist:** gold line drawings (nuggets, strips, burger, cloche) on a spotlit plate; a real uploaded photo replaces them automatically. No AI food images.
