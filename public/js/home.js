import { clock, esc, tk } from './format.js'
import { heroIntro, kraftBox, preloader } from './motion.js'
import { bindCards, cardHtml, reveal, reviewHtml, safeUrl, setText, start } from './site.js'

// A 24-point scalloped disc, like a pressed wax seal.
function scallop() {
  const points = 24, outer = 98, inner = 91
  let d = ''
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2
    const r = i % 2 ? inner : outer
    d += `${i ? ' L' : 'M'}${(100 + r * Math.cos(a)).toFixed(2)} ${(100 + r * Math.sin(a)).toFixed(2)}`
  }
  return d + 'Z'
}
document.getElementById('seal-edge').setAttribute('d', scallop())

const dataReady = start('home')
await preloader()
// Admin-edited hero text is used if it arrives quickly; otherwise the static copy plays and stays.
const early = await Promise.race([dataReady, new Promise(r => setTimeout(r, 600))])
if (early?.page) {
  const [a, ...b] = early.page.hero_title.split('. ')
  const h1 = document.getElementById('hero-title')
  const em = document.createElement('em')
  em.textContent = b.join('. ')
  h1.replaceChildren(`${a}. `, em)
  setText('hero-sub', early.page.hero_sub)
}
heroIntro()

const { settings, page, items, reviews } = await dataReady
const { business: b, delivery: d } = settings

setText('promise', page.promise)
setText('story-title', page.story_title === "A chef's kitchen, not a fast-food line" ? 'Chef Shaheen Islam' : page.story_title)
setText('story-text', page.story_text)

if (safeUrl(page.hero_image)) {
  // A real food photo, once uploaded, sits behind the chef and the giant word.
  const glow = document.querySelector('.hero-glow')
  glow.style.background = `linear-gradient(180deg, rgb(30 12 41 / .55), rgb(30 12 41 / .95)), url("${encodeURI(page.hero_image)}") center / cover`
  Object.assign(glow.style, { inset: '0', translate: '0 0', width: 'auto', maxWidth: 'none', aspectRatio: 'auto' })
}

const flagged = items.filter(i => i.badge === 'Best seller')
if (flagged.length) setText('best-kicker', '02 — Best sellers')
const featured = document.getElementById('featured')
const shown = (flagged.length ? flagged : items).slice(0, 3)
featured.innerHTML = shown.map(cardHtml).join('')
bindCards(featured, shown)

const areas = d.areas.map(a => a.name)
const fees = d.areas.map(a => a.fee)
setText('areas', areas.join(' & '))
setText('box-areas', `Delivered across ${areas.join(' and ')}.`)
setText('hours', `${clock(b.open).replace(':00', '')} – ${clock(b.close).replace(':00', '')}`)
setText('fees', Math.min(...fees) === Math.max(...fees) ? tk(fees[0]) : `Tk ${Math.min(...fees)} – ${Math.max(...fees)}`)
setText('free-note', `Delivery on orders over ${tk(d.free_over)}`)
setText('kitchen', b.area_label)
const phone = document.getElementById('phone')
phone.textContent = b.phone
phone.href = `tel:${b.phone.replace(/\D/g, '')}`

if (safeUrl(b.facebook)) {
  document.getElementById('fb-link').href = safeUrl(b.facebook)
  document.getElementById('fb-section').hidden = false
}

document.getElementById('reviews').innerHTML = reviews.length
  ? `<div class="reviews" data-tilted>${reviews.slice(0, 4).map(reviewHtml).join('')}</div>`
  : `<p class="lede mt24" data-reveal>No reviews yet. Every review here will come from a real, delivered order${esc('')}.</p>`

reveal()
kraftBox()
