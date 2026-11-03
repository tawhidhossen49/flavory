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
// Preloader: a gold drop falls and ripples into the ring, the wordmark rises letter by letter,
// the counter follows real loading, then the screen parts like a curtain onto the hero.
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
    .fromTo('.pl-drop', { y: -30, scaleY: 1.3, transformOrigin: '50% 100%' }, { y: 124, scaleY: 1, duration: 0.55, ease: 'power2.in' })
    .to('.pl-drop', { scaleX: 2.4, scaleY: 0.15, autoAlpha: 0, duration: 0.16, ease: 'power2.out' })
    .fromTo('.pl-ripple', { scale: 0.2, autoAlpha: 0.9, transformOrigin: '50% 50%' }, { scale: 3.4, autoAlpha: 0, duration: 1.2, stagger: 0.18, ease: 'power2.out', immediateRender: false }, '<')
    .fromTo(ring, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, '<0.05')
    .from(chars, { yPercent: 60, autoAlpha: 0, filter: 'blur(6px)', duration: 0.8, stagger: 0.05, ease: 'power3.out' }, '<0.1')
    .from('.pl-tag', { autoAlpha: 0, letterSpacing: '.8em', duration: 0.9, ease: 'power3.out' }, '<0.35')
    .from('.pl-count', { autoAlpha: 0, duration: 0.5 }, '<')

  const cap = new Promise(r => setTimeout(r, 4000))
  return Promise.all([Promise.race([heroReady, cap]), intro.then()]).then(() => new Promise(resolve => {
    removeEventListener('seq:progress', onP)
    gsap.timeline({ onComplete: () => { el.remove(); motion.lenis?.start(); resolve() } })
      .to(shown, { v: 100, duration: 0.3, onUpdate: paint })
      .to(el.querySelector('.pl-inner'), { scale: 0.94, autoAlpha: 0, duration: 0.4, ease: 'power2.in' })
      .to(el.querySelector('.pl-split.t'), { yPercent: -100, duration: 0.95, ease: 'expo.inOut' }, '-=0.05')
      .to(el.querySelector('.pl-split.b'), { yPercent: 100, duration: 0.95, ease: 'expo.inOut' }, '<')
  }))
}

// Chapter rail: a quiet readout of where you are on the page (desktop only).
export function rail() {
  if (!live || !desk()) return
  const r = document.createElement('div')
  r.className = 'rail'
  r.setAttribute('aria-hidden', 'true')
  r.innerHTML = '<b></b><i></i><span></span>'
  document.body.append(r)
  const [num, bar, label] = r.children
  document.querySelectorAll('[data-chapter]').forEach(sec => {
    const [n, ...rest] = sec.dataset.chapter.split(' — ')
    ST.create({
      trigger: sec, start: 'top 55%', end: 'bottom 55%',
      onToggle: s => { if (s.isActive) { num.textContent = n; label.textContent = rest.join(' — ').toUpperCase(); r.style.opacity = sec.classList.contains('chef-sec') ? 0 : 1 } },
      onUpdate: s => bar.style.setProperty('--p', s.progress.toFixed(3)),
    })
  })
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
  // Hidden by a class, not by GSAP: ScrollTrigger resets animated elements to their creation state on every re-measure.
  sec.classList.add('pre-intro')
  const intro = () => gsap.timeline()
    .call(() => sec.classList.remove('pre-intro'))
    .from(h1.lines, { yPercent: 115, duration: 1.3, stagger: 0.12 })
    .from(capFirst.querySelectorAll('.kicker, .hero-sub, .hero-cta'), { y: 26, autoAlpha: 0, duration: 1, stagger: 0.08 }, 0.25)
    .from('.ghost-crispy', { yPercent: 40, autoAlpha: 0, duration: 1.8 }, 0)
    .from('.scroll-cue, .hero-progress', { autoAlpha: 0, duration: 1 }, 0.8)

  // The pinned timeline exists from the start so every section below measures the right scroll length;
  // the video frames join it whenever they arrive (also after a breakpoint change rebuilds it).
  let fryer = null, gold = null, tl = null
  const attach = () => {
    if (!tl) return
    if (fryer && !tl.data?.fry) { frames(tl, fryer, 0, 0.86); tl.data = { ...tl.data, fry: true } }
    if (gold && !tl.data?.gold) { tl.to(gold.state, { frame: gold.count - 1, ease: 'none', duration: 0.2, onUpdate: () => gold.render() }, 0.8); tl.data = { ...tl.data, gold: true } }
  }
  gsap.matchMedia().add({ d: '(min-width: 900px)', m: '(max-width: 899px)' }, c => {
    tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: sec, start: 'top top', end: c.conditions.d ? '+=320%' : '+=210%', scrub: c.conditions.d ? 0.7 : 0.4, pin: sec.querySelector('.seq-stage') },
    })
    // Explicit start values: the timeline is built before the intro reveals the headline.
    tl.fromTo(capFirst, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -50, duration: 0.06, immediateRender: false }, 0.2)
    captions(tl, sec.querySelectorAll('.cap:not(.cap-first)'))
    tl.fromTo('.ghost-crispy', { yPercent: 0, scale: 1, autoAlpha: 1 }, { yPercent: -40, scale: 1.18, autoAlpha: 0, duration: 0.5, immediateRender: false }, 0)
    tl.fromTo('.scroll-cue', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.05, immediateRender: false }, 0.02)
    tl.to(goldCanvas, { opacity: 1, duration: 0.08 }, 0.8)
    sec.querySelectorAll('.hero-progress b').forEach((b, i) => tl.to(b, { scaleX: 1, duration: 0.25 }, i * 0.25))
    tl.to({}, { duration: 0.001 }, 1)
    attach()
    return () => { tl.kill(); tl = null }
  })
  fry.then(seq => { fryer = seq; attach() })
  ready.then(() => createSequence(goldCanvas, 'golden').then(g => { gold = g; attach() }))
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
// 03 The break: an arch opens into a full cinematic frame. A viewfinder, a running timecode and a
// crunch waveform that peaks exactly when the crust gives way.
export function snap() {
  const sec = document.getElementById('snap')
  if (!sec) return
  const wave = document.getElementById('snap-wave')
  const pts = []
  for (let i = 0; i <= 150; i++) {
    const t = i / 150
    const env = 1.5 + 19 * Math.exp(-(((t - 0.55) / 0.05) ** 2)) + 8 * Math.exp(-(((t - 0.66) / 0.07) ** 2)) + (t > 0.55 ? 5 * Math.exp(-(t - 0.55) * 7) : 0)
    pts.push(`${i * 4} ${(23 + Math.sin(i * 1.9) * Math.cos(i * 0.41 + 1) * env).toFixed(1)}`)
  }
  wave.setAttribute('d', 'M' + pts.join(' L'))
  const frame = sec.querySelector('.snap-frame')
  if (!live) { sec.querySelectorAll('.snap-shade, .hud').forEach(el => { el.style.opacity = 1 }); return }

  const L = wave.getTotalLength()
  const tc = document.getElementById('snap-tc'), pct = document.getElementById('snap-pct')
  const [w1, w2] = sec.querySelectorAll('.snap-word span')
  const [l1, l2] = sec.querySelectorAll('.snap-copy h2 > span')
  const st = { tl: null }
  const pad = n => String(n).padStart(2, '0')

  gsap.matchMedia().add({ d: '(min-width: 900px)', m: '(max-width: 899px)' }, c => {
    const d = c.conditions.d
    const soft = d ? 'blur(10px)' : 'blur(0px)'
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: sec, start: 'top top', end: d ? '+=240%' : '+=190%', scrub: 0.6, pin: sec.querySelector('.seq-stage'),
        onUpdate: s => {
          const secs = s.progress * 3.6
          tc.textContent = `00:00:${pad(Math.floor(secs))}:${pad(Math.floor((secs % 1) * 60))}`
          pct.textContent = String(Math.round(s.progress * 100)).padStart(3, '0')
        },
      },
    })
    // The arch opens into the full frame (on desktop it also glides from the centre to its place on the right).
    tl.fromTo(frame, { clipPath: d ? 'inset(14% 16% 12% 16% round 999px 999px 10px 10px)' : 'inset(17% 14% 24% 14% round 999px 999px 12px 12px)', x: () => d ? innerWidth / 2 - (frame.getBoundingClientRect().left - gsap.getProperty(frame, 'x') + frame.offsetWidth / 2) : 0 },
      { clipPath: 'inset(0% 0% 0% 0% round 0px 0px 0px 0px)', x: 0, duration: 0.3, ease: 'power2.inOut' }, 0)
      .fromTo(w1, { xPercent: 0 }, { xPercent: -55, autoAlpha: 0, duration: 0.32, ease: 'power2.in' }, 0)
      .fromTo(w2, { xPercent: 0 }, { xPercent: 55, autoAlpha: 0, duration: 0.32, ease: 'power2.in' }, 0)
      .to(sec.querySelector('.snap-shade'), { opacity: 1, duration: 0.12 }, 0.2)
      .to(sec.querySelector('.hud'), { opacity: 1, duration: 0.08 }, 0.26)
      .fromTo(sec.querySelector('.hud-focus'), { scale: 1.9, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.1, ease: 'power3.out' }, 0.3)
      .to(sec.querySelector('.hud-focus'), { autoAlpha: 0, duration: 0.06 }, 0.5)
      .fromTo(sec.querySelector('.snap-copy .kicker'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.06 }, 0.26)
      .fromTo(l1, { autoAlpha: 0, y: 50, filter: soft }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.08, ease: 'power2.out' }, 0.3)
      .fromTo(l2, { autoAlpha: 0, y: 50, filter: soft }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.08, ease: 'power2.out' }, 0.55)
      .fromTo(sec.querySelectorAll('.snap-note, .wave, .wave-label'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.06, stagger: 0.02 }, 0.6)
      .fromTo(wave, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 0.7 }, 0.25)
      .to({}, { duration: 0.001 }, 1)
    st.tl = tl
    if (st.seq) frames(tl, st.seq, 0.08, 0.86)
    return () => tl.kill()
  })
  whenNear(sec, () => createSequence(sec.querySelector('canvas'), 'snap').then(seq => {
    seq.firstPass.then(() => sec.querySelector('.snap-frame > img')?.remove())
    st.seq = seq
    if (st.tl) frames(st.tl, seq, 0.08, 0.86)
  }))
}

// ---------------------------------------------------------------------------
// 04 The collection: tall photo panels. The open one is in full colour; the rest wait in shadow.
export function collection(items) {
  const box = document.getElementById('panels')
  if (!box) return
  const list = items
    .filter(i => i.available && i.item_options.length)
    .sort((a, b) => (b.badge === 'Best seller') - (a.badge === 'Best seller'))
    .slice(0, 6)
  if (!list.length) { box.closest('section').hidden = true; return }
  const pad = n => String(n).padStart(2, '0')
  const count = document.getElementById('col-count')

  box.innerHTML = list.map((it, i) => {
    const pic = photoOf(it)
    const opts = it.item_options
    return `<article class="cp${i ? '' : ' on'}" role="listitem" tabindex="0" data-i="${i}" aria-expanded="${!i}" aria-label="${esc(it.name)}">
      ${pic ? `<img class="cp-img" src="${esc(pic)}" alt="${esc(it.name)}" loading="lazy" decoding="async">` : `<div class="cp-img">${artSvg(it.name)}</div>`}
      <div class="cp-shade"></div>
      <div class="cp-head" aria-hidden="true"><span class="cp-num">${pad(i + 1)}</span><span class="cp-title">${esc(it.name)}</span></div>
      <div class="cp-vert" aria-hidden="true"><span class="cp-num">${pad(i + 1)}</span><span>${esc(it.name)}</span></div>
      <i class="corner a"></i><i class="corner b"></i><i class="corner c"></i><i class="corner d"></i>
      <div class="cp-body">
        <p class="cp-badge">${esc(it.badge ?? 'Fried to order')}</p>
        <h3 class="cp-name">${esc(it.name)}</h3>
        <p class="cp-desc">${esc(it.description)}</p>
        ${opts.length > 1 ? `<fieldset class="opts"><legend class="sr">Choose a size</legend>${opts.map((o, k) =>
          `<label class="opt"><input type="radio" name="cp-${i}" value="${k}"${k ? '' : ' checked'}><span>${esc(o.label)}</span></label>`).join('')}</fieldset>` : ''}
        <div class="cp-buy"><span class="cp-price">${tk(opts[0].price)}</span><button class="btn pill cp-add" type="button"><span class="lbl">Add to order</span><i aria-hidden="true"><b>+</b></i></button></div>
      </div>
    </article>`
  }).join('')
  const panels = [...box.children]
  let at = 0

  function open(i) {
    if (i === at) return
    at = i
    panels.forEach((p, k) => {
      p.classList.toggle('on', k === i)
      p.setAttribute('aria-expanded', String(k === i))
      if (k === i) p.removeAttribute('data-cursor'); else p.dataset.cursor = 'OPEN'
    })
    count.textContent = `${pad(i + 1)} / ${pad(panels.length)} · ${list[i].name.toUpperCase()}`
  }
  panels.forEach((p, i) => { if (i) p.dataset.cursor = 'OPEN' })
  count.textContent = `01 / ${pad(panels.length)} · ${list[0].name.toUpperCase()}`

  // Desktop opens on hover (after a short pause so passing over does not flicker); everyone can click, tap or use the keyboard.
  let intent = 0
  panels.forEach((p, i) => {
    p.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && desk()) { clearTimeout(intent); intent = setTimeout(() => open(i), 140) } })
    p.addEventListener('pointerleave', () => clearTimeout(intent))
    p.addEventListener('click', e => {
      if (e.target.closest('.cp-body')) return
      if (desk()) open(i)
      else box.scrollTo({ left: p.offsetLeft - (box.clientWidth - p.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' })
    })
    p.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === p) { e.preventDefault(); open(i) } })
    p.addEventListener('focus', () => { if (desk()) open(i) })
    p.addEventListener('change', e => { p.querySelector('.cp-price').textContent = tk(list[i].item_options[Number(e.target.value)].price) })
    p.querySelector('.cp-add').addEventListener('click', e => {
      const item = list[i]
      const o = item.item_options[Number(p.querySelector('input:checked')?.value ?? 0)]
      cart.add({ option_id: o.id, item_id: item.id, name: item.name, label: o.label, price: o.price, photo: photoOf(item) })
      flyToCart(e.currentTarget, photoOf(item))
      const lbl = e.currentTarget.querySelector('.lbl')
      lbl.textContent = 'Added'
      setTimeout(() => { lbl.textContent = 'Add to order' }, 1300)
    })
    // A little depth: the photo drifts against the pointer, like a lens.
    if (live && desk()) {
      const img = p.querySelector('.cp-img')
      const qx = gsap.quickTo(img, 'x', { duration: 0.9, ease: 'power3' }), qy = gsap.quickTo(img, 'y', { duration: 0.9, ease: 'power3' })
      p.addEventListener('pointermove', e => { const r = p.getBoundingClientRect(); qx(((e.clientX - r.left) / r.width - 0.5) * -18); qy(((e.clientY - r.top) / r.height - 0.5) * -14) })
      p.addEventListener('pointerleave', () => { qx(0); qy(0) })
    }
  })
  // Phones and tablets: a swipe rail. The card nearest the centre opens; its neighbours dim and step back,
  // and every photo slides a little against the swipe, like looking through a window.
  const track = document.getElementById('col-track')
  let raf = 0
  const onRail = () => {
    raf = 0
    if (desk()) { panels.forEach(p => { p.style.transform = ''; p.style.removeProperty('--px') }); return }
    const rc = box.getBoundingClientRect(), mid = rc.left + rc.width / 2
    let best = 0, bestD = Infinity
    panels.forEach((p, i) => {
      const r = p.getBoundingClientRect()
      const d = (r.left + r.width / 2 - mid) / r.width
      if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = i }
      if (!reduce) {
        p.style.setProperty('--px', `${(-d * 7).toFixed(2)}%`)
        p.style.transform = `scale(${(1 - Math.min(Math.abs(d), 1) * 0.07).toFixed(3)})`
      }
    })
    if (best !== at) open(best)
    const max = box.scrollWidth - box.clientWidth
    track.style.setProperty('--p', max > 0 ? (0.15 + 0.85 * box.scrollLeft / max).toFixed(3) : 1)
  }
  box.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(onRail) }, { passive: true })
  addEventListener('resize', () => { if (!raf) raf = requestAnimationFrame(onRail) })
  onRail()

  if (live) gsap.from(panels, { yPercent: 18, autoAlpha: 0, clipPath: 'inset(100% 0% 0% 0%)', duration: 1.3, stagger: 0.08, ease: 'expo.out', clearProps: 'clipPath,transform', onComplete: onRail, scrollTrigger: { trigger: box, start: 'top 85%', once: true } })
}

// ---------------------------------------------------------------------------
// 05 Packed hot: box closes, the gold seal stamps down, the camera flies through it into the ivory chapter.
export function packed() {
  const sec = document.getElementById('packed')
  if (!sec || !live) return
  const stamp = sec.querySelector('.seal-stamp'), portal = sec.querySelector('.portal')
  const st = { tl: null }
  gsap.matchMedia().add({ d: '(min-width: 900px)', m: '(max-width: 899px)' }, c => {
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: c.conditions.d ? '+=260%' : '+=180%', scrub: 0.5, pin: sec.querySelector('.seq-stage') } })
    captions(tl, sec.querySelectorAll('.cap:not(.cap-first)'))
    tl.to(sec.querySelector('.cap-first'), { autoAlpha: 0, y: -40, duration: 0.05 }, 0.33)
    tl.fromTo(stamp, { scale: 2.8, rotate: -40, autoAlpha: 0 }, { scale: 1, rotate: -8, autoAlpha: 1, duration: 0.06, ease: 'power4.in' }, 0.74)
      .fromTo(sec.querySelector('.seq-stage'), { x: 0 }, { x: 6, duration: 0.01, yoyo: true, repeat: 3 }, 0.8)
      .to(stamp, { scale: 7, rotate: 0, duration: 0.16, ease: 'power2.in' }, 0.86)
      .to(portal, { scale: () => Math.hypot(innerWidth, innerHeight) / 18, duration: 0.12, ease: 'power2.in' }, 0.89)
      .to({}, { duration: 0.001 }, 1)
    st.tl = tl
    if (st.seq) frames(tl, st.seq, 0, 0.8)
    return () => tl.kill()
  })
  whenNear(sec, () => createSequence(sec.querySelector('canvas'), 'packed').then(seq => { st.seq = seq; if (st.tl) frames(st.tl, seq, 0, 0.8) }))
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
