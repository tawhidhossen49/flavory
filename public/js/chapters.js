// The home page's film chapters: scroll-scrubbed clips, the craft steps, the collection carousel,
// the sealed-box portal and the live delivery map. Phones get their own framing and shorter pins.
import { cart } from './cart.js'
import { cutoutOf, photoOf, artSvg } from './art.js'
import { clock, esc, tk } from './format.js'
import { flyToCart, motion, reduce } from './motion.js'

const { gsap, ST, Split, live } = motion
const desk = () => matchMedia('(min-width: 900px)').matches
const portrait = () => innerHeight > innerWidth

// ---------------------------------------------------------------------------
// Frame-sequence engine: draws numbered WebP frames to a canvas, coarse frames first.
export async function createSequence(canvas, name, { onProgress } = {}) {
  const base = `/sequences/${name}/`
  const manifest = await (await fetch(base + 'manifest.json')).json()
  const set = portrait() && manifest.mobile ? manifest.mobile : manifest.desktop
  const count = manifest.frameCount
  const url = i => `${base}${set.dir}/${String(i + 1).padStart(4, '0')}.${set.ext}`
  const ctx = canvas.getContext('2d', { alpha: false })
  const images = new Array(count)
  const state = { frame: 0 }
  let loaded = 0, lastDrawn = -1, lastWidth = 0

  const ready = img => img && img.complete && img.naturalWidth > 0
  const nearest = i => {
    for (let d = 0; d < count; d++) {
      if (ready(images[i - d])) return images[i - d]
      if (ready(images[i + d])) return images[i + d]
    }
    return null
  }
  function render(force = false) {
    const i = Math.max(0, Math.min(count - 1, Math.round(state.frame)))
    if (i === lastDrawn && !force) return
    const img = nearest(i)
    if (!img) return
    lastDrawn = ready(images[i]) ? i : -1
    const cw = canvas.width, ch = canvas.height
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight)
    const w = img.naturalWidth * s, h = img.naturalHeight * s
    ctx.fillStyle = manifest.edgeColor || '#0C0811'
    ctx.fillRect(0, 0, cw, ch)
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h)
  }
  function resize() {
    // Phones fire resize when the address bar slides; only a width change needs a redraw.
    if (canvas.clientWidth === lastWidth) return
    lastWidth = canvas.clientWidth
    const dpr = Math.min(devicePixelRatio || 1, desk() ? 2 : 1.5)
    canvas.width = Math.round(canvas.clientWidth * dpr)
    canvas.height = Math.round(canvas.clientHeight * dpr)
    render(true)
  }
  const load = i => new Promise(res => {
    if (images[i]) return res()
    const img = new Image()
    img.decoding = 'async'
    img.onload = img.onerror = () => { loaded++; onProgress?.(loaded / count); res() }
    img.src = url(i)
    images[i] = img
  })
  const firstPass = (async () => {
    await load(0); render(true)
    const b = []; for (let i = 0; i < count; i += 12) b.push(load(i))
    await Promise.all(b); render(true)
  })()
  firstPass.then(async () => {
    for (const stride of [6, 3, 1]) {
      const b = []; for (let i = 0; i < count; i += stride) b.push(load(i))
      await Promise.all(b); render(true)
    }
  })
  addEventListener('resize', resize)
  resize()
  return { state, count, render, firstPass }
}

const frames = (tl, seq, at, duration) => tl.to(seq.state, { frame: seq.count - 1, ease: 'none', duration, onUpdate: () => seq.render() }, at)

function captions(tl, nodes) {
  const soft = desk() ? 'blur(10px)' : 'blur(0px)' // per-frame blur is costly on mid-range phones
  nodes.forEach(el => {
    const a = parseFloat(el.dataset.in), b = parseFloat(el.dataset.out)
    const span = Math.min(0.06, (b - a) / 3)
    if (a > 0) tl.fromTo(el, { autoAlpha: 0, y: 50, filter: soft }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: span, ease: 'power2.out' }, a)
    if (b < 1) tl.to(el, { autoAlpha: 0, y: -40, filter: soft, duration: span, ease: 'power2.in' }, b - span)
  })
}

function whenNear(el, cb, margin = '120% 0px') {
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); cb() } }, { rootMargin: margin })
  io.observe(el)
}

// ---------------------------------------------------------------------------
// Preloader: a gold drop falls, ripples out into the ring, the wordmark sharpens, the counter follows real loading.
export function preloader(heroReady) {
  const el = document.querySelector('.preloader')
  if (!el) return Promise.resolve()
  if (!live || document.documentElement.classList.contains('no-preload')) { el.remove(); return Promise.resolve() }
  motion.lenis?.stop()
  const count = el.querySelector('.pl-count')
  const shown = { v: 0 }
  const paint = () => { count.textContent = String(Math.round(shown.v)).padStart(3, '0') }
  const onP = e => gsap.to(shown, { v: Math.min(99, e.detail * 1200), duration: 0.4, overwrite: true, onUpdate: paint })
  addEventListener('seq:progress', onP)

  const ring = el.querySelector('.pl-ring'), L = ring.getTotalLength()
  const { chars } = Split.create(el.querySelector('.pl-word'), { type: 'chars' })
  const intro = gsap.timeline()
    .fromTo('.pl-drop', { y: -40, scaleY: 1.3, transformOrigin: '50% 100%' }, { y: 124, scaleY: 1, duration: 0.6, ease: 'power2.in' })
    .to('.pl-drop', { scaleX: 2.2, scaleY: 0.2, autoAlpha: 0, duration: 0.18, ease: 'power2.out' })
    .fromTo('.pl-ripple', { scale: 0.2, autoAlpha: 0.9, transformOrigin: '50% 50%' }, { scale: 3.4, autoAlpha: 0, duration: 1.2, stagger: 0.18, ease: 'power2.out' }, '<')
    .fromTo(ring, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, '<0.05')
    .from(chars, { autoAlpha: 0, y: 14, filter: 'blur(8px)', duration: 0.7, stagger: 0.05, ease: 'power3.out' }, '<0.1')

  const cap = new Promise(r => setTimeout(r, 4000))
  return Promise.all([Promise.race([heroReady, cap]), intro.then()]).then(() => new Promise(resolve => {
    removeEventListener('seq:progress', onP)
    gsap.timeline({ onComplete: () => { el.remove(); motion.lenis?.start(); resolve() } })
      .to(shown, { v: 100, duration: 0.3, onUpdate: paint })
      .to(el.querySelector('.pl-inner'), { scale: 0.9, autoAlpha: 0, duration: 0.4, ease: 'power2.in' })
      .to(el, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, '-=0.1')
  }))
}

// ---------------------------------------------------------------------------
// 01 Hero: raw rolls into the fryer, then the golden rack rises over it.
export function hero() {
  const sec = document.getElementById('hero')
  if (!sec) return Promise.resolve()
  const [fryCanvas, goldCanvas] = sec.querySelectorAll('canvas')
  const fry = createSequence(fryCanvas, 'fryer', { onProgress: p => dispatchEvent(new CustomEvent('seq:progress', { detail: p })) })
  const ready = fry.then(s => s.firstPass)
  if (!live) { fry.then(s => { s.state.frame = 30; s.render(true) }); return ready }

  const capFirst = sec.querySelector('.cap-first')
  const h1 = Split.create(capFirst.querySelector('h1'), { type: 'lines', mask: 'lines' })
  gsap.set(capFirst, { autoAlpha: 0 })
  const intro = () => gsap.timeline()
    .set(capFirst, { autoAlpha: 1 })
    .from(h1.lines, { yPercent: 115, duration: 1.3, stagger: 0.12 })
    .from(capFirst.querySelectorAll('.kicker, .hero-sub, .hero-cta'), { y: 26, autoAlpha: 0, duration: 1, stagger: 0.08 }, 0.25)
    .from('.ghost-crispy', { yPercent: 40, autoAlpha: 0, duration: 1.8 }, 0)
    .from('.scroll-cue, .hero-progress', { autoAlpha: 0, duration: 1 }, 0.8)

  Promise.all([fry, ready]).then(([seq]) => {
    gsap.matchMedia().add({ d: '(min-width: 900px)', m: '(max-width: 899px)' }, c => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: sec, start: 'top top', end: c.conditions.d ? '+=320%' : '+=210%', scrub: c.conditions.d ? 0.7 : 0.4, pin: sec.querySelector('.seq-stage'), anticipatePin: 1 },
      })
      frames(tl, seq, 0, 0.86)
      tl.to(capFirst, { autoAlpha: 0, y: -50, duration: 0.06 }, 0.2)
      captions(tl, sec.querySelectorAll('.cap:not(.cap-first)'))
      tl.to('.ghost-crispy', { yPercent: -60, scale: 1.25, autoAlpha: 0, duration: 0.5 }, 0)
      tl.to('.scroll-cue', { autoAlpha: 0, duration: 0.05 }, 0.02)
      tl.to(goldCanvas, { opacity: 1, duration: 0.08 }, 0.8)
      sec.querySelectorAll('.hero-progress b').forEach((b, i) => tl.to(b, { scaleX: 1, duration: 0.25 }, i * 0.25))
      tl.to({}, { duration: 0.001 }, 1)
      return () => tl.kill()
    })
    // The golden finish loads once the fryer is ready, then joins the same scroll.
    createSequence(goldCanvas, 'golden').then(gold => {
      const st = ST.getAll().find(t => t.pin === sec.querySelector('.seq-stage'))
      if (!st) return
      st.animation.to(gold.state, { frame: gold.count - 1, ease: 'none', duration: 0.2, onUpdate: () => gold.render() }, 0.8)
    })
  })
  return ready.then(() => ({ intro }))
}

// ---------------------------------------------------------------------------
// 02 Craft: on desktop the four films share one sticky frame and wipe in; on phones each step has its own.
export function craft() {
  const sec = document.getElementById('craft')
  if (!sec) return
  const frame = sec.querySelector('.craft-frame')
  const steps = [...sec.querySelectorAll('.craft-step')]
  const figures = steps.map(s => s.querySelector('.craft-media'))
  const mq = matchMedia('(min-width: 900px)')
  let active = -1

  const source = v => {
    const want = mq.matches ? v.dataset.src : v.dataset.srcM
    if (v.getAttribute('src') !== want) { v.src = want; v.poster = mq.matches ? v.dataset.poster : v.getAttribute('poster') }
  }
  const play = v => { if (reduce) return; source(v); v.play().catch(() => {}) }
  const pause = v => v.pause()

  function layout() {
    figures.forEach((f, i) => (mq.matches ? frame : steps[i]).append(f))
    active = -1
    setActive(0)
  }
  function setActive(i) {
    if (i === active) return
    figures.forEach((f, k) => {
      f.classList.toggle('on', k === i)
      f.classList.toggle('was', k < i)
      f.style.zIndex = String(k)
    })
    steps.forEach((s, k) => s.classList.toggle('on', k === i))
    active = i
    if (mq.matches) figures.forEach((f, k) => (k === i ? play : pause)(f.querySelector('video')))
  }

  // Desktop: the step crossing the middle of the screen is the active one.
  const stepIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting && mq.matches) setActive(steps.indexOf(e.target))
  }), { rootMargin: '-45% 0px -45% 0px' })
  steps.forEach(s => stepIO.observe(s))

  // Phones: a film plays only while most of it is on screen.
  const filmIO = new IntersectionObserver(es => es.forEach(e => {
    if (mq.matches) return
    const v = e.target.querySelector('video')
    e.isIntersecting ? play(v) : pause(v)
  }), { threshold: 0.45 })
  figures.forEach(f => filmIO.observe(f))
  whenNear(sec, () => figures.forEach(f => source(f.querySelector('video'))), '60% 0px')

  layout()
  mq.addEventListener('change', layout)
}

// ---------------------------------------------------------------------------
// 03 The break: the clip scrubs in an arched frame while CRUNCH tears in two.
export function snap() {
  const sec = document.getElementById('snap')
  if (!sec || !live) return
  const title = sec.querySelector('[data-smoke]')
  const { chars } = Split.create(title, { type: 'words,chars' })
  gsap.from(chars, { autoAlpha: 0, y: 20, filter: desk() ? 'blur(14px)' : 'blur(0px)', duration: 1.3, stagger: { each: 0.03, from: 'random' }, ease: 'power2.out', scrollTrigger: { trigger: sec, start: 'top 40%', once: true } })

  const st = { tl: null }
  gsap.matchMedia().add({ d: '(min-width: 900px)', m: '(max-width: 899px)' }, c => {
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: c.conditions.d ? '+=150%' : '+=110%', scrub: 0.5, pin: sec.querySelector('.seq-stage'), anticipatePin: 1 } })
    const [a, b] = sec.querySelectorAll('.snap-word span')
    tl.fromTo(a, { xPercent: 12 }, { xPercent: -40, duration: 1 }, 0)
      .fromTo(b, { xPercent: -12 }, { xPercent: 40, duration: 1 }, 0)
      .fromTo('.snap-frame', { scale: 0.9, rotate: -3 }, { scale: 1, rotate: 0, duration: 0.6 }, 0)
      .to({}, { duration: 0.001 }, 1)
    st.tl = tl
    return () => tl.kill()
  })
  whenNear(sec, () => createSequence(sec.querySelector('canvas'), 'snap').then(seq => {
    sec.querySelector('.snap-frame img').remove()
    if (st.tl) frames(st.tl, seq, 0, 1)
  }))
}

// ---------------------------------------------------------------------------
// 04 Signature collection: items orbit on a ring; swipe, drag, arrows or keys.
export function collection(items) {
  const stage = document.getElementById('col-stage')
  if (!stage) return
  const list = items
    .filter(i => i.available && i.item_options.length)
    .sort((a, b) => (b.badge === 'Best seller') - (a.badge === 'Best seller'))
    .slice(0, 8)
  if (!list.length) { stage.closest('section').hidden = true; return }

  const els = list.map(item => {
    const el = document.createElement('div')
    el.className = 'col-item'
    const cut = cutoutOf(item), pic = photoOf(item)
    el.innerHTML = cut ? `<img src="${esc(cut)}" alt="" loading="lazy" decoding="async">`
      : `<div class="plate">${pic ? `<img src="${esc(pic)}" alt="" loading="lazy">` : artSvg(item.name)}</div>`
    stage.append(el)
    return el
  })
  const $ = id => document.getElementById(id)
  const dots = $('col-dots')
  dots.innerHTML = list.map((it, i) => `<button aria-label="Show ${esc(it.name)}" data-i="${i}"></button>`).join('')
  let at = 0, option = null

  function place(animate) {
    const n = list.length, w = stage.clientWidth
    const gap = w * (desk() ? 0.26 : 0.44)
    els.forEach((el, i) => {
      let d = (i - at) % n
      if (d > n / 2) d -= n
      if (d < -n / 2) d += n
      const a = Math.abs(d)
      const v = { x: d * gap, z: -a * 260, rotationY: -d * 26, scale: 1 - Math.min(a, 2) * 0.24, autoAlpha: a > 2 ? 0 : 1 - a * 0.42, zIndex: 10 - a, transformPerspective: 1200 }
      if (live && animate) gsap.to(el, { ...v, duration: 0.9, ease: 'expo.out', overwrite: true })
      else if (live) gsap.set(el, v)
      else Object.assign(el.style, { transform: `translateX(${v.x}px) scale(${v.scale})`, opacity: v.autoAlpha, zIndex: v.zIndex })
    })
  }
  function show(i, animate = true) {
    at = (i + list.length) % list.length
    const item = list[at]
    option = item.item_options[0]
    const ghost = $('col-ghost')
    if (live && animate) gsap.fromTo(ghost, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.8 })
    ghost.textContent = item.name.split(' ').pop().toUpperCase()
    $('col-name').textContent = item.name
    $('col-desc').textContent = item.description
    $('col-opts').innerHTML = item.item_options.length > 1 ? `<fieldset class="opts"><legend class="sr">Choose a size</legend>${item.item_options.map((o, k) =>
      `<label class="opt"><input type="radio" name="col-opt" value="${k}"${k ? '' : ' checked'}><span>${esc(o.label)}</span></label>`).join('')}</fieldset>` : ''
    paintAdd()
    dots.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', String(k === at)))
    if (live && animate) gsap.from(['#col-name', '#col-desc'], { y: 18, autoAlpha: 0, duration: 0.7, stagger: 0.06 })
    place(animate)
  }
  const paintAdd = (label = `Add · ${tk(option.price)}`) => { $('col-add').textContent = label }

  $('col-opts').addEventListener('change', e => { option = list[at].item_options[Number(e.target.value)]; paintAdd() })
  $('col-add').addEventListener('click', e => {
    const item = list[at]
    cart.add({ option_id: option.id, item_id: item.id, name: item.name, label: option.label, price: option.price, photo: photoOf(item) })
    flyToCart(e.currentTarget)
    paintAdd('Added')
    setTimeout(() => paintAdd(), 1300)
  })
  $('col-prev').addEventListener('click', () => show(at - 1))
  $('col-next').addEventListener('click', () => show(at + 1))
  dots.addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(Number(b.dataset.i)) })
  stage.tabIndex = 0
  stage.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(at - 1); if (e.key === 'ArrowRight') show(at + 1) })

  // Swipe or drag sideways; vertical swipes still scroll the page.
  let x0 = null
  stage.addEventListener('pointerdown', e => { x0 = e.clientX })
  addEventListener('pointerup', e => {
    if (x0 === null) return
    const dx = e.clientX - x0
    x0 = null
    if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1))
  })
  addEventListener('resize', () => place(false))
  show(0, false)
  if (live) gsap.from(els, { y: 120, autoAlpha: 0, duration: 1.2, stagger: 0.08, scrollTrigger: { trigger: stage, start: 'top 80%', once: true }, onComplete: () => place(false) })
}

// ---------------------------------------------------------------------------
// 05 Packed hot: box closes, the gold seal stamps down, the camera flies through it into the ivory chapter.
export function packed() {
  const sec = document.getElementById('packed')
  if (!sec || !live) return
  const stamp = sec.querySelector('.seal-stamp'), portal = sec.querySelector('.portal')
  const st = { tl: null }
  gsap.matchMedia().add({ d: '(min-width: 900px)', m: '(max-width: 899px)' }, c => {
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: c.conditions.d ? '+=260%' : '+=180%', scrub: 0.5, pin: sec.querySelector('.seq-stage'), anticipatePin: 1 } })
    captions(tl, sec.querySelectorAll('.cap:not(.cap-first)'))
    tl.to(sec.querySelector('.cap-first'), { autoAlpha: 0, y: -40, duration: 0.05 }, 0.33)
    tl.fromTo(stamp, { scale: 2.8, rotate: -40, autoAlpha: 0 }, { scale: 1, rotate: -8, autoAlpha: 1, duration: 0.06, ease: 'power4.in' }, 0.74)
      .fromTo(sec.querySelector('.seq-stage'), { x: 0 }, { x: 6, duration: 0.01, yoyo: true, repeat: 3 }, 0.8)
      .to(stamp, { scale: 7, rotate: 0, duration: 0.16, ease: 'power2.in' }, 0.86)
      .to(portal, { scale: () => Math.hypot(innerWidth, innerHeight) / 18, duration: 0.12, ease: 'power2.in' }, 0.89)
      .to({}, { duration: 0.001 }, 1)
    st.tl = tl
    return () => tl.kill()
  })
  whenNear(sec, () => createSequence(sec.querySelector('canvas'), 'packed').then(seq => { if (st.tl) frames(st.tl, seq, 0, 0.8) }))
}

// ---------------------------------------------------------------------------
// 07 Delivery: arcs draw out from the kitchen; the status pill tells the live truth.
export function deliveryMap(settings) {
  const b = settings.business, d = settings.delivery
  const pill = document.getElementById('live'), text = document.getElementById('live-text')
  const fee = name => d.areas.find(a => a.name === name)
  const fa = fee('Mohammadpur'), fb = fee('Dhanmondi')
  if (fa) document.getElementById('fee-a').textContent = `Delivery ${tk(fa.fee)}`
  if (fb) document.getElementById('fee-b').textContent = `Delivery ${tk(fb.fee)}`

  const tick = () => {
    const now = new Date()
    const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(now)
    const open = b.kitchen_open && hm >= b.open && hm < b.close
    pill.classList.toggle('closed', !open)
    text.textContent = open ? `Open now · closes ${clock(b.close)} · ${time} in Dhaka` : `Closed · opens ${clock(b.open)} · order ahead any time`
  }
  tick()
  setInterval(tick, 1000)

  if (!live) return
  document.querySelectorAll('.dmap .arc').forEach(p => {
    const L = p.getTotalLength()
    gsap.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', scrollTrigger: { trigger: '.dmap', start: 'top 75%', once: true } })
  })
  gsap.from('.dmap .zone', { scale: 0.6, autoAlpha: 0, transformOrigin: '50% 50%', duration: 1.4, stagger: 0.2, scrollTrigger: { trigger: '.dmap', start: 'top 75%', once: true } })
}

// ---------------------------------------------------------------------------
// Footer: molten gold drips over the edge; the golden rack glows behind the call to action.
export function footerFlourish() {
  const ftr = document.querySelector('#ftr .ftr')
  if (!ftr) return
  const drip = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  drip.setAttribute('class', 'ftr-drip')
  drip.setAttribute('viewBox', '0 0 1200 90')
  drip.setAttribute('preserveAspectRatio', 'none')
  drip.setAttribute('aria-hidden', 'true')
  drip.innerHTML = `<defs><linearGradient id="drip-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A6A33"/><stop offset=".5" stop-color="#D9BC82"/><stop offset="1" stop-color="#F2DFB0"/></linearGradient></defs>
    <path fill="url(#drip-gold)" d="M0 0H1200V14c-40 0-46 40-70 40s-22-30-60-30-30 58-62 58-34-46-70-46-40 22-66 22-30-36-64-36-42 66-74 66-36-58-70-58-34 30-64 30-40-44-72-44-36 26-62 26-32-40-70-40-38 70-72 70-40-60-74-60-30 34-62 34-34-48-70-48-36 22-66 22-38-32-72-32-30 52-60 52S20 14 0 14Z"/>`
  ftr.before(drip)
  const ctaVideo = document.createElement('div')
  ctaVideo.className = 'ftr-video'
  ctaVideo.setAttribute('aria-hidden', 'true')
  ftr.querySelector('.ftr-cta')?.prepend(ctaVideo)
  if (!reduce) whenNear(ftr, () => {
    const v = document.createElement('video')
    Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: true, poster: '/media/golden-m.webp', src: portrait() ? '/media/golden-m.mp4' : '/media/golden.mp4' })
    ctaVideo.append(v)
  }, '40% 0px')
  if (live) gsap.from(drip.querySelector('path'), { scaleY: 0.15, transformOrigin: '50% 0%', duration: 1.6, ease: 'elastic.out(1, 0.5)', scrollTrigger: { trigger: drip, start: 'top 95%', once: true } })
}
