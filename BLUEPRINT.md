# Flavory — design blueprint

**Vibe:** Energy 3 (appetite, not hype) · Dark 5 (plum studio) · Warm 1 (gold, ivory, kraft) · Organic 1 (food, hand-made) · Playful 2 · Rich 3
**Archetype:** Dark Gold Luxury × warm fast food.

**Tokens:** bg `#1E0C29` / `#2A1238` · ink `#FBF4E8` (16.85:1) · accent `#C9A45C` (7.85:1) · on ivory use gold-ink `#7A5A1E` (5.81:1) · kraft `#B58A5C`.
**Type:** Playfair Display (headings) · Cormorant Garamond Italic (second lines) · Great Vibes (1–2 words per screen) · Montserrat (body, ≥16px).
**Shape:** 2–6px radius, thin gold rules and double frames echoing the logo. Arches only on chef imagery.
**Motion:** `cubic-bezier(.16,1,.3,1)` 0.8s, stagger 0.08s, transform + opacity only, CSS + IntersectionObserver.

**Stack:** plain HTML, CSS and vanilla JavaScript (the owner's choice). Real `.html` files in `public/`, no build step. Small JS Vercel functions in `api/` for what a browser must not do. Supabase for data.
No GSAP, Lenis or WebGL: the brief bans scroll-jacking on touch and puts ordering speed first.

| Slot | Choice | Energy |
|---|---|---|
| Preloader | None — utility ordering site | 0 |
| Hero | Chef portrait from the poster in a gold arch (slow push-in), T1 line reveal; a food photo uploaded in admin takes over full-bleed | 3 |
| Signature 1 (home, ~55% down) | **The Gold Seal** — a wax-style seal stamps down onto the crispy guarantee with a ring ripple (remix: seal × press × scroll trigger × vitrine) | 4 |
| Signature 2 (end of order) | **The Receipt Print** — the receipt feeds out of a gold slot line by line | 4 |
| Supporting | Rule draw (scaleX), staggered card rise, 3-step line reveal, sticky tabs with sliding underline | 2+2+2+1 |
| Calm | Our Story teaser, delivery & hours | 1+1 |
| Persistent | Sticky header, mobile "View cart · Tk ___" bar | 1 |
| Footer | Giant "Flavory" in Great Vibes over thin rule | 2 |

**Energy total:** 23 — inside the calm-to-balanced budget.
**Energy curve:** hero 3 → story 1 → how it works 2 → **seal 4** → areas 1 → footer 2.

**Hero placeholder:** Chef Shaheen's real photo from the poster. A generated crust texture was tried and rejected: it read as rock, and no real food photos exist yet.
