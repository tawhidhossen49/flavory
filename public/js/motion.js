// All motion for the public pages. GSAP and Lenis load as plain scripts before this module;
// pages without them (cart, checkout) simply get no animation.
const gsap = window.gsap
const ST = window.ScrollTrigger
const Split = window.SplitText
const root = document.documentElement

export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
export const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
const live = Boolean(gsap && ST && Split) && !reduce
const done = el => { if (el.dataset.m) return true; el.dataset.m = '1'; return false }
const fresh = sel => [...document.querySelectorAll(sel)].filter(el => !done(el))

let lenis = null
let booted = false

function boot() {
  if (booted) return
  booted = true
  if (!live) { root.classList.add('motion-ready', 'hero-in'); return }
  gsap.registerPlugin(ST, Split)
  gsap.defaults({ ease: 'expo.out', duration: 1 })

  // Smooth wheel scrolling on desktop only; phones keep their native scroll.
  if (fine && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, anchors: { offset: -90 } })
    lenis.on('scroll', ST.update)
    gsap.ticker.add(t => lenis.raf(t * 1000))
    gsap.ticker.lagSmoothing(0)
  }

  const line = document.createElement('div')
  line.className = 'progress-line'
  document.body.append(line)
  gsap.to(line, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } })

  const hdr = document.getElementById('hdr')
  if (hdr) ST.create({
    start: 0, end: 'max',
    onUpdate: s => {
      hdr.classList.toggle('is-solid', s.scroll() > 30)
      hdr.classList.toggle('is-hidden', s.direction === 1 && s.scroll() > 520 && !hdr.querySelector('details[open]'))
    },
  })

  if (fine) cursor()
  document.fonts.ready.then(() => ST.refresh())
}

function cursor() {
  const c = document.createElement('div')
  c.className = 'cursor'
  c.setAttribute('aria-hidden', 'true')
  document.body.append(c)
  const x = gsap.quickTo(c, 'x', { duration: 0.35, ease: 'power3' })
  const y = gsap.quickTo(c, 'y', { duration: 0.35, ease: 'power3' })
  addEventListener('pointermove', e => { x(e.clientX); y(e.clientY) })
  document.addEventListener('pointerover', e => c.classList.toggle('is-big', Boolean(e.target.closest('a, button, label, .card'))))
}

function magnetic(b) {
  const qx = gsap.quickTo(b, 'x', { duration: 0.4, ease: 'power3' })
  const qy = gsap.quickTo(b, 'y', { duration: 0.4, ease: 'power3' })
  b.addEventListener('pointermove', e => {
    const r = b.getBoundingClientRect()
    qx((e.clientX - r.left - r.width / 2) * 0.3)
    qy((e.clientY - r.top - r.height / 2) * 0.3)
  })
  b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' }))
}

// Pointer tilt with a gold sheen that follows the light.
function tilt(card) {
  const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' })
  const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' })
  card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height
    ry((px - 0.5) * 9)
    rx((0.5 - py) * 7)
    card.style.setProperty('--mx', `${px * 100}%`)
    card.style.setProperty('--my', `${py * 100}%`)
  })
  card.addEventListener('pointerleave', () => { rx(0); ry(0) })
}

const onEnter = (trigger, start = 'top 88%') => ({ trigger, start, once: true })

// Animates everything on the page that has not been animated yet. Safe to call after each render.
export function reveal() {
  boot()
  if (!live) return

  fresh('[data-t1]').forEach(h => Split.create(h, {
    type: 'lines', mask: 'lines', autoSplit: true,
    onSplit: self => gsap.from(self.lines, { yPercent: 115, duration: 1.15, stagger: 0.09, scrollTrigger: onEnter(h) }),
  }))

  fresh('[data-t2]').forEach(p => {
    const { words } = Split.create(p, { type: 'words' })
    gsap.fromTo(words, { opacity: 0.16 }, { opacity: 1, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: p, start: 'top 80%', end: 'bottom 45%', scrub: true } })
  })

  fresh('[data-reveal]').forEach(el => gsap.from(el, { y: 44, autoAlpha: 0, duration: 1.1, delay: Number(el.dataset.delay ?? 0), scrollTrigger: onEnter(el) }))
  fresh('[data-rule]').forEach(el => gsap.from(el, { scaleX: 0, duration: 1.4, ease: 'expo.inOut', scrollTrigger: onEnter(el) }))

  fresh('[data-chars]').forEach(el => {
    const { chars } = Split.create(el, { type: 'chars' })
    gsap.from(chars, { yPercent: 105, duration: 1.2, stagger: 0.045, scrollTrigger: onEnter(el, 'top 95%') })
  })

  fresh('[data-seal]').forEach(el => {
    gsap.timeline({ scrollTrigger: onEnter(el, 'top 80%') })
      .from(el.querySelector('.seal-disc'), { scale: 1.9, rotation: -40, autoAlpha: 0, duration: 0.8, ease: 'power4.in' })
      .fromTo(el.querySelector('.seal-ring'), { scale: 0.8, autoAlpha: 0.9 }, { scale: 1.7, autoAlpha: 0, duration: 1, ease: 'power2.out' }, '>-0.05')
      .from(el, { y: 8, duration: 0.5, ease: 'elastic.out(1, 0.35)' }, '<')
  })
  fresh('[data-spin]').forEach(el => gsap.to(el, { rotation: 360, duration: 28, ease: 'none', repeat: -1, transformOrigin: '50% 50%' }))

  fresh('[data-marquee]').forEach(el => {
    const track = el.firstElementChild
    const loop = gsap.to(track, { xPercent: -50, ease: 'none', duration: track.scrollWidth / 2 / 55, repeat: -1 })
    loop.totalTime(loop.duration() * 100)
    let boost = 0, dir = 1
    ST.create({ trigger: el, start: 'top bottom', end: 'bottom top', onUpdate: s => { const v = s.getVelocity(); if (v) dir = Math.sign(v); boost = Math.min(Math.abs(v) / 300, 5) } })
    gsap.ticker.add(() => { boost *= 0.92; loop.timeScale(dir * (1 + boost)) })
  })

  fresh('[data-tilted]').forEach(el => [...el.children].forEach((c, i) => gsap.from(c, {
    y: 110, x: i % 2 ? 70 : -70, rotation: i % 2 ? 11 : -11, autoAlpha: 0, duration: 1.2, scrollTrigger: onEnter(c, 'top 92%'),
  })))

  fresh('[data-expand]').forEach(el => gsap.fromTo(el, { clipPath: 'inset(7% 5% 0% 5% round 36px)' }, {
    clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 20%', scrub: 0.6 },
  }))

  // Cards rise in batches with a clip wipe, however many the menu holds.
  const cards = fresh('.card')
  if (cards.length) {
    gsap.set(cards, { autoAlpha: 0, y: 70, clipPath: 'inset(16% 0% 0% 0% round 8px)' })
    ST.batch(cards, {
      start: 'top 94%', once: true,
      onEnter: batch => {
        gsap.to(batch, { autoAlpha: 1, y: 0, clipPath: 'inset(0% 0% 0% 0% round 8px)', duration: 1.2, stagger: 0.1, clearProps: 'clipPath' })
        gsap.from(batch.map(c => c.querySelector('.card-plate')), { scale: 1.25, duration: 1.6, stagger: 0.1 })
      },
    })
    if (fine) cards.forEach(tilt)
  }

  if (fine) fresh('[data-magnetic]').forEach(magnetic)
  root.classList.add('motion-ready')
  ST.refresh()
}

export function flyToCart(from) {
  const target = document.querySelector('#bar a') ?? document.getElementById('hdr-order')
  if (!live || !target) return
  const a = from.getBoundingClientRect(), b = target.getBoundingClientRect()
  const dot = document.createElement('span')
  dot.className = 'fly-dot'
  document.body.append(dot)
  gsap.set(dot, { x: a.left + a.width / 2, y: a.top + a.height / 2 })
  gsap.timeline({ onComplete: () => dot.remove() })
    .to(dot, { x: b.left + b.width / 2, duration: 0.75, ease: 'power1.inOut' }, 0)
    .to(dot, { y: b.top + b.height / 2, duration: 0.75, ease: 'back.in(1.6)' }, 0)
    .to(dot, { scale: 0.3, duration: 0.2 }, 0.6)
    .fromTo(target, { scale: 1 }, { scale: 1.12, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 0.72)
}

// P1 × P5: a gold ring draws round the script wordmark, then the panel lifts away.
export function preloader() {
  const el = document.querySelector('.preloader')
  if (!el) return Promise.resolve()
  if (!live || root.classList.contains('no-preload')) { el.remove(); return Promise.resolve() }
  lenis?.stop()
  const ring = el.querySelector('.pl-ring')
  const L = ring.getTotalLength()
  const { chars } = Split.create(el.querySelector('.pl-word'), { type: 'chars' })
  return new Promise(resolve => gsap.timeline({ onComplete: () => { el.remove(); lenis?.start(); resolve() } })
    .fromTo(ring, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut' }, 0)
    .from(chars, { autoAlpha: 0, filter: 'blur(8px)', y: 12, duration: 0.7, stagger: 0.06, ease: 'power3.out' }, 0.15)
    .from(el.querySelector('.pl-word'), { letterSpacing: '0.35em', duration: 1.2 }, 0.15)
    .to(el.querySelector('.pl-inner'), { scale: 0.92, autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, '+=0.15')
    .to(el, { yPercent: -100, duration: 0.85, ease: 'expo.inOut' }, '-=0.15'))
}

// H9: giant word behind (and partly in front of) the chef, then scroll parallax.
export function heroIntro() {
  const hero = document.querySelector('.hero')
  if (!hero) return
  if (!live) { root.classList.add('hero-in'); return }
  const words = [...hero.querySelectorAll('.hero-word')].map(w => Split.create(w, { type: 'chars' }).chars)
  const h1 = Split.create(hero.querySelector('h1'), { type: 'lines', mask: 'lines' })
  const tl = gsap.timeline()
  words.forEach(chars => tl.from(chars, { yPercent: 110, duration: 1.4, stagger: 0.06 }, 0))
  tl.from('.hero-chef', { yPercent: 14, autoAlpha: 0, duration: 1.6 }, 0.1)
    .from('.hero-ring', { scale: 0.6, rotation: -60, autoAlpha: 0, duration: 1.8 }, 0)
    .from(h1.lines, { yPercent: 115, duration: 1.2, stagger: 0.1 }, 0.35)
    .from('.hero [data-hero]', { y: 24, autoAlpha: 0, duration: 1, stagger: 0.08 }, 0.6)
  root.classList.add('hero-in')

  gsap.matchMedia().add({ desk: '(min-width: 900px)', phone: '(max-width: 899px)' }, ctx => {
    const k = ctx.conditions.desk ? 1 : 0.5
    gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
      .to('.hero-word', { yPercent: -28 * k, ease: 'none' }, 0)
      .to('.hero-chef', { yPercent: 6 * k, scale: 1 - 0.04 * k, ease: 'none' }, 0)
      .to('.hero-ring', { rotation: 50, ease: 'none' }, 0)
      .to('.hero-copy', { yPercent: -18 * k, autoAlpha: 0.2, ease: 'none' }, 0)
  })
}

// Signature: the kraft box steams open, seals, turns and arrives, scrubbed through four steps.
export function kraftBox() {
  const sec = document.querySelector('.box-sec')
  if (!sec) return
  const steps = [...sec.querySelectorAll('.box-steps li')]
  const texts = [...sec.querySelectorAll('.box-text')]
  const show = i => {
    steps.forEach((s, k) => s.classList.toggle('is-on', k === i))
    texts.forEach((t, k) => t.classList.toggle('is-on', k === i))
  }
  show(0)
  if (!live) { sec.classList.add('is-static'); return }

  gsap.matchMedia().add({ desk: '(min-width: 900px)', phone: '(max-width: 899px)' }, ctx => {
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: sec, start: 'top top', end: ctx.conditions.desk ? '+=260%' : '+=170%',
        scrub: 0.7, pin: sec.querySelector('.box-pin'), anticipatePin: 1,
        onUpdate: s => show(Math.min(3, Math.floor(s.progress * 4))),
      },
    })
    tl.fromTo('.box3d', { rotationY: -38, rotationX: -22 }, { rotationY: 18, rotationX: -16, duration: 1 }, 0)
      .fromTo('.box-lid', { rotationX: 114 }, { rotationX: 114, duration: 1 }, 0)
      .to('.box3d', { rotationY: -8, duration: 1 }, 1)
      .to('.box-lid', { rotationX: 0, duration: 0.8, ease: 'power2.in' }, 2)
      .to('.box-glow, .box-light', { autoAlpha: 0, duration: 0.6 }, 2.2)
      .to('.box-steam', { autoAlpha: 0, duration: 0.5 }, 2.1)
      .to('.box3d', { rotationY: 0, rotationX: -10, scale: 1.12, y: -14, duration: 1 }, 3)
      .fromTo('.box-progress i', { scaleY: 0 }, { scaleY: 1, duration: 4 }, 0)
  })
}
