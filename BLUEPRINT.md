# Flavory — design blueprint v3 (built)

Built from frame-by-frame study of the 42 reference videos in `all 3d web videos.zip`.
Goal from the owner: about half the site animated or interactive, smooth transitions, more elegant, luxurious and futuristic.

## What the references taught (and what Flavory takes from each)

| Pattern | Seen in | Flavory use |
|---|---|---|
| Scroll-scrubbed food clip as the hero, captions changing with progress | Rosso, Hekayh, Forno Nero, Maison Laminée, Röstwerk, Melt, Chocoburst | Hero: chicken going into the fryer and lifting out golden |
| Process told step by step with an index list beside the object | Kodo matcha (Ice → Milk → Matcha…), Forno Nero | Fryer-to-door steps beside the clips |
| Product breaks open, slow motion | Chocoburst cookie, Maison Laminée croissant, Röstwerk bean | "The break": a strip pulled apart, steam rising |
| Ingredients float apart with thin callout lines, then reassemble | Rosso "ingredient ballet", Hekayh plate notes, Fornello pizza layers | Burger layers float apart with labels |
| Floating 3D product carousel with floor glow, colour shift per item | Ciro Energy arc, Agrumea jars, Fornello collection, Aurora signature row | Signature collection of menu items |
| Portal transition: camera goes through an opening into the next scene | Forno Nero oven arch, Jet window, Bordeaux door | Through the gold sticker into the chef chapter |
| Liquid drip covering a section edge | Chocoburst chocolate, Rosso sauce drip | Molten gold drip into the footer |
| Text condensing out of smoke or steam | Velora perfume, Röstwerk | Headline forms out of the fryer steam |
| Logo reveal preloaders | OST spotlight sweep, ECHO orbit trace, Plaany ball trace | Gold oil drop that ripples into the logo ring |
| Live clock, status dot, dotted map with arcs | Antimatter AI, Jet "Global" | Live "kitchen open" status and a delivery map |
| Tilted cards that settle; overflow product cards | Creamsy, Nick's, portfolio fan deck | Reviews; menu cards with cut-out food breaking the card edge |
| Near-black + luminous gold, warm firelight behind food | Assam Honey, Velora, Fornello, Röstwerk | The new palette |

## Palette — "Obsidian Champagne" (see `design/palette-v3.png`)

| Token | Hex | Use |
|---|---|---|
| Obsidian | `#0C0811` | Page |
| Surface | `#151019` / raised `#1F1826` | Cards, panels |
| Royal plum | `#3B1A4F` | Glows only (ties to the purple logo) |
| Champagne gold | `#D9BC82` → highlight `#F2DFB0`, shadow `#8A6A33` | The one accent: CTAs, prices, key words as a metallic gradient |
| Fryer light | `#C8742E` at ~25% | Warm radial glow behind food, never on UI |
| Ivory | `#F5EEE3` | Text; paper chapters |
| Mist | `#A69BAD` | Quiet text |

All text pairs pass WCAG AA (ivory 17.2:1, champagne 10.8:1, mist 7.5:1 on obsidian; gold ink 5.5:1 on ivory).
Futuristic cues: hairline champagne borders at 12–16%, glass panels with blur, wide-tracked small caps and tabular numerals, light sweeps across gold type, live data. Fonts unchanged.

## Home page, top to bottom (≈ half the page is animated chapters)

| # | Section | Elements | Needs |
|---|---|---|---|
| P | Preloader | Gold oil drop falls, ripple rings draw into the ring round "Flavory"; 000 → 100 counter tied to real hero loading (P1 × P4 remix) | code |
| 01 | **Hero — "Fried to order"** | Frame sequence scrubbed by scroll, pinned 300vh desktop / 170vh phone. Captions rise in at 0 / 35 / 70%: Coated by hand · Fried when you order · Golden, every time. Ghost "CRISPY" behind. | **Clip A** |
| 02 | Ticker | Velocity marquee | code |
| 03 | **"The break"** | Short pin: strip pulled apart in slow motion; the headline condenses out of the steam (T15 + S11) | **Clip B** |
| 04 | **Signature collection** | 3D arc carousel of real menu items, front item lifted on a glowing ring, name swaps with ghost-double, drag or swipe, Add flies to cart | **Photos 1** |
| 05 | **Ingredient ballet** | Burger layers float apart with gold callout lines, then stack back together as you scroll (S6) | **Photos 2** |
| 06 | **"Packed hot"** | Food goes into the kraft box, lid closes, gold sticker pressed; then the camera pushes through the sticker into the next chapter (portal + theme flip to ivory) | **Clip C** |
| 07 | Meet the chef (calm) | Ivory chapter, chef cutout with ghost "Shaheen", inset of her hands coating chicken that expands as you scroll, signature writes itself | **Clip D** |
| 08 | Guarantee | Seal stamps down, circular text turns | code |
| 09 | Delivery | Dotted map: Lalmatia kitchen pulses, gold arcs draw to Dhanmondi and Mohammadpur; live "Open now · closes 10 pm" | code |
| 10 | Reviews | Tilted cards that settle | code |
| F | Footer | Molten gold drip edge, giant wordmark letters rise | code |

**Transitions between sections:** hero end frame fades into obsidian · steam dissolve (03→04) · card slides over card (04→05) · portal through the sticker with theme flip (06→07) · gold drip (10→F) · between pages: a gold split-panel wipe using View Transitions.

**Other pages:** Menu gets cut-out food breaking the top of each card, tilt and light sweep, tap a card to open a detail sheet that grows out of it (Flip). Our Story gets the giant "SHAHEEN" word with the chef in front, an expanding hands clip and a drawing timeline of her training. Cart, checkout and receipt stay calm and fast; the receipt keeps its print animation.

**Performance rules:** frame sequences as WebP, phone versions 9:16 at 80–120 frames, later chapters load 1.5 screens ahead, phones get shorter pins and no smooth-scroll library, reduced motion shows posters only. Energy total ≈ 32 (bold but calm in the middle).

**Until footage exists:** every clip section shows a still poster with slow push-in, so the page works and looks finished; dropping a clip into `raw-video/` upgrades it.

## As built (2026-11-03)

Footage: six licensed stock clips supplied by the owner (raw-video/src, not in git), trimmed and given one warm low-key grade by `scripts/media.sh`.
- Hero: fryer clip (raw rolls into oil) scrubbed by scroll, golden-rack finish fades over it. 320% pin desktop, 210% phone; phones get a 9:16 crop.
- Craft: egg wash, crumb coat, fry, rest as looping films. Desktop: one sticky frame that wipes between steps; phones: a film card per step that plays only while on screen.
- The break: crust-snap clip in an arched frame, CRUNCH tearing apart behind it.
- Signature collection: cut-out photos orbiting on a gold ring (swipe, drag, arrows, keys).
- Packed: kraft box closing, the Flavory seal stamps on, the page flies through it into the ivory chef chapter.
- Delivery: live open/closed pill with Dhaka time, dotted map with arcs drawing from Lalmatia.
- Footer: gold drip edge, golden-rack film behind the call to action.
Not built from the plan: the burger "ingredient ballet" (needs per-layer photos).
Food photos are stand-ins (public/demo) used only when an item has no uploaded photo.
