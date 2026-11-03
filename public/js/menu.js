// The menu: each category is a stage. Dishes are pill cards anchored to the left and right edges,
// and the one you point at (or tap) appears in its Flavory box in the middle, ready to add.
import { artSvg, boxOf, photoOf } from './art.js'
import { cart } from './cart.js'
import { esc, tk } from './format.js'
import { flyToCart, motion, reduce } from './motion.js'
import { isSoldOut, reveal, start } from './site.js'

const { settings, categories, items } = await start('menu')
document.getElementById('closed').hidden = settings.business.kitchen_open

const { gsap, ST, live } = motion
const desk = () => matchMedia('(min-width: 1024px)').matches
const filled = categories.filter(c => items.some(i => i.category_id === c.id))
const menu = document.getElementById('menu')
const rail = document.getElementById('tabs')
const byId = new Map(items.map(i => [i.id, i]))

rail.innerHTML = '<span class="tab-ink" aria-hidden="true"></span>' + filled.map((c, i) =>
  `<a class="tab" href="#cat-${esc(c.id)}" aria-current="${i === 0}">${esc(c.name)}</a>`).join('')

const ingredientsLine = it => it.ingredients || it.description || ''
const priceText = it => {
  const p = it.item_options.map(o => o.price)
  return p.length > 1 ? `from ${tk(Math.min(...p))}` : tk(p[0] ?? 0)
}

const pill = (it, side, n) => `
  <button class="mc mc-${side}${isSoldOut(it) ? ' out' : ''}" type="button" data-id="${esc(it.id)}" aria-pressed="false" style="--n:${n}">
    <span class="mc-text">
      <span class="mc-name">${esc(it.name)}</span>
      <span class="mc-ing">${esc(ingredientsLine(it))}</span>
    </span>
    <span class="mc-price">${isSoldOut(it) ? 'Sold out' : esc(priceText(it))}</span>
  </button>`

// Fewer on the left: 2 → 1·1, 3 → 1·2, 4 → 2·2, 5 → 2·3 …
menu.innerHTML = filled.map(c => {
  const list = items.filter(i => i.category_id === c.id)
  const nLeft = Math.floor(list.length / 2)
  const left = list.slice(0, nLeft), right = list.slice(nLeft)
  // Phones read top to bottom, so the two sides are woven together: left, right, left, right…
  const woven = []
  for (let k = 0; k < Math.max(left.length, right.length); k++) { if (left[k]) woven.push([left[k], 'l']); if (right[k]) woven.push([right[k], 'r']) }
  return `
  <section class="mcat" id="cat-${esc(c.id)}" aria-labelledby="h-${esc(c.id)}">
    <div class="wrap mcat-head">
      <h2 id="h-${esc(c.id)}" data-t1>${esc(c.name)}</h2>
      <span class="mcat-count">${String(list.length).padStart(2, '0')} ${list.length === 1 ? 'dish' : 'dishes'}</span>
      <hr class="mcat-rule">
    </div>
    <div class="mstage">
      <div class="mcol mcol-l">${left.map((it, k) => pill(it, 'l', k)).join('')}</div>
      <figure class="mbox" aria-live="polite">
        <div class="mbox-art"><img alt="" decoding="async"><span class="mbox-draw" hidden></span></div>
        <span class="mbox-floor" aria-hidden="true"></span>
        <figcaption class="mbox-buy">
          <span class="mbox-name"></span>
          <span class="mbox-opts"></span>
          <span class="mbox-row"><span class="mbox-price"></span><button class="btn pill mbox-add" type="button"><span class="lbl">Add to order</span><i aria-hidden="true"><b>+</b></i></button></span>
        </figcaption>
      </figure>
      <div class="mcol mcol-r">${right.map((it, k) => pill(it, 'r', k)).join('')}</div>
      <div class="mweave">${woven.map(([it, s], k) => pill(it, s, k)).join('')}</div>
    </div>
  </section>`
}).join('')

// Show one dish in a category's box.
function show(stage, id, animate = true) {
  const it = byId.get(id)
  if (!it || stage.dataset.active === id) return
  stage.dataset.active = id
  stage.querySelectorAll('.mc').forEach(b => {
    const on = b.dataset.id === id
    b.classList.toggle('on', on)
    b.setAttribute('aria-pressed', String(on))
  })
  const box = stage.querySelector('.mbox')
  const img = box.querySelector('img')
  const src = boxOf(it)
  const out = isSoldOut(it)
  const paint = () => {
    // No photo yet: the drawn illustration stands in.
    img.hidden = !src
    const draw = box.querySelector('.mbox-draw')
    draw.hidden = Boolean(src)
    draw.innerHTML = src ? '' : artSvg(it.name)
    if (!src) img.removeAttribute('src')
    else img.src = src
    img.srcset = src?.startsWith('/demo/') ? `${src.replace(/\.webp$/, '-480.webp')} 520w, ${src} 1000w` : ''
    img.sizes = '(min-width: 1024px) 34vw, 78vw'
    img.alt = `${it.name} in a Flavory box`
    box.classList.toggle('out', out)
    box.querySelector('.mbox-name').textContent = it.name
    const opts = it.item_options
    box.querySelector('.mbox-opts').innerHTML = !out && opts.length > 1 ? `<fieldset class="opts"><legend class="sr">Choose a size for ${esc(it.name)}</legend>${opts.map((o, k) =>
      `<label class="opt"><input type="radio" name="sz-${esc(stage.id)}" value="${k}"${k ? '' : ' checked'}><span>${esc(o.label)}</span></label>`).join('')}</fieldset>` : ''
    box.querySelector('.mbox-price').textContent = out ? 'Sold out today' : tk(opts[0]?.price ?? 0)
    const add = box.querySelector('.mbox-add')
    add.disabled = out
    add.querySelector('.lbl').textContent = out ? 'Back tomorrow' : 'Add to order'
  }
  if (!live || !animate) { paint(); return }
  // The box drops out, the next one springs up like a sticker being placed.
  gsap.timeline()
    .to(box.querySelector('.mbox-art'), { y: 30, scale: 0.86, rotation: -4, autoAlpha: 0, duration: 0.22, ease: 'power2.in', overwrite: true })
    .call(paint)
    .fromTo(box.querySelector('.mbox-art'), { y: 40, scale: 0.8, rotation: 6, autoAlpha: 0 }, { y: 0, scale: 1, rotation: 0, autoAlpha: 1, duration: 0.8, ease: 'back.out(1.6)' })
    .fromTo(box.querySelectorAll('.mbox-name, .mbox-opts, .mbox-row'), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.05, ease: 'power3.out' }, '<0.1')
}

menu.querySelectorAll('.mstage').forEach(stage => {
  stage.id ||= `st-${Math.random().toString(36).slice(2, 7)}`
  const first = stage.querySelector('.mcol-l .mc, .mcol-r .mc')
  show(stage, first.dataset.id, false)

  let intent = 0
  stage.addEventListener('pointerover', e => {
    const b = e.target.closest('.mc')
    if (!b || e.pointerType !== 'mouse') return
    clearTimeout(intent)
    intent = setTimeout(() => show(stage, b.dataset.id), 90)
  })
  stage.addEventListener('click', e => {
    const b = e.target.closest('.mc')
    if (!b) return
    show(stage, b.dataset.id)
    // On phones, bring the box into view if the tapped card sits far below it.
    if (!desk()) {
      const box = stage.querySelector('.mbox').getBoundingClientRect()
      if (box.bottom < 0 || box.top > innerHeight * 0.5) stage.querySelector('.mbox').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    }
  })
  stage.addEventListener('focusin', e => { const b = e.target.closest('.mc'); if (b) show(stage, b.dataset.id) })
  stage.addEventListener('change', e => {
    const it = byId.get(stage.dataset.active)
    stage.querySelector('.mbox-price').textContent = tk(it.item_options[Number(e.target.value)].price)
  })
  stage.querySelector('.mbox-add').addEventListener('click', e => {
    const it = byId.get(stage.dataset.active)
    const o = it.item_options[Number(stage.querySelector('.mbox-opts input:checked')?.value ?? 0)]
    cart.add({ option_id: o.id, item_id: it.id, name: it.name, label: o.label, price: o.price, photo: photoOf(it) })
    flyToCart(e.currentTarget, boxOf(it))
    const lbl = e.currentTarget.querySelector('.lbl')
    lbl.textContent = 'Added'
    setTimeout(() => { lbl.textContent = 'Add to order' }, 1300)
  })
})

reveal()

if (live) {
  // Headline letters settle into place.
  const lines = document.querySelectorAll('.m-line')
  gsap.from(lines, { yPercent: 110, duration: 1.3, stagger: 0.12, ease: 'expo.out' })
  gsap.from('#m-title', { letterSpacing: '0.18em', duration: 1.8, ease: 'expo.out' })

  // Each category: the rule draws, cards slide in from their own side, the box pops up.
  menu.querySelectorAll('.mcat').forEach(sec => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 78%', once: true } })
    tl.from(sec.querySelector('.mcat-rule'), { scaleX: 0, duration: 1.2, ease: 'expo.inOut' })
      .from(sec.querySelector('.mbox-art'), { y: 60, scale: 0.7, rotation: -8, autoAlpha: 0, duration: 1.1, ease: 'back.out(1.5)' }, 0.25)
      .from(sec.querySelector('.mbox-floor'), { scaleX: 0.3, autoAlpha: 0, duration: 1 }, 0.35)
      .from(sec.querySelectorAll('.mbox-buy > *'), { y: 16, autoAlpha: 0, duration: 0.6, stagger: 0.06 }, 0.6)
    ;['.mcol-l .mc', '.mweave .mc-l'].forEach(sel => tl.from(sec.querySelectorAll(sel), { xPercent: -110, duration: 1.1, stagger: 0.1, ease: 'expo.out' }, 0.15))
    ;['.mcol-r .mc', '.mweave .mc-r'].forEach(sel => tl.from(sec.querySelectorAll(sel), { xPercent: 110, duration: 1.1, stagger: 0.1, ease: 'expo.out' }, 0.25))
  })
  ST.refresh()
}

// The gold pill slides under whichever category is on screen.
const ink = rail.querySelector('.tab-ink')
function moveInk(tab) {
  ink.style.width = `${tab.offsetWidth}px`
  ink.style.transform = `translateX(${tab.offsetLeft}px)`
}
const firstTab = rail.querySelector('.tab')
if (firstTab) moveInk(firstTab)
addEventListener('resize', () => moveInk(rail.querySelector('[aria-current="true"]') ?? firstTab))
const io = new IntersectionObserver(entries => {
  const hit = entries.find(e => e.isIntersecting)
  if (!hit) return
  rail.querySelectorAll('.tab').forEach(t => {
    const on = t.hash === `#${hit.target.id}`
    t.setAttribute('aria-current', on)
    if (on) { moveInk(t); rail.scrollTo({ left: t.offsetLeft - 16, behavior: 'smooth' }) }
  })
}, { rootMargin: '-25% 0px -70% 0px' })
menu.querySelectorAll('.mcat').forEach(s => io.observe(s))
