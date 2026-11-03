import { collection, craft, deliveryMap, footerFlourish, hero, packed, preloader, rail, snap } from './chapters.js'
import { clock, esc, tk } from './format.js'
import { reveal, reviewHtml, safeUrl, setText, start } from './site.js'

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
const heroReady = hero()
await preloader(heroReady)
heroReady.then(h => h?.intro?.())
craft()
snap()
packed()

const { settings, page, items, reviews } = await dataReady
const { business: b, delivery: d } = settings

if (page) {
  const [a, ...rest] = page.hero_title.split('. ')
  const h1 = document.getElementById('hero-title')
  // Only swap the text if the owner changed it; the animated split lines stay intact otherwise.
  if (`${a}. ${rest.join('. ')}` !== h1.textContent.trim()) {
    const em = document.createElement('em')
    em.className = 'metal'
    em.textContent = rest.join('. ')
    h1.replaceChildren(`${a}. `, em)
  }
  setText('hero-sub', page.hero_sub)
  setText('promise', page.promise)
  if (page.story_text) setText('story-text', page.story_text)
}

collection(items)
deliveryMap(settings)

const areas = d.areas.map(a => a.name)
const fees = d.areas.map(a => a.fee)
setText('areas', areas.join(' & '))
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

footerFlourish()
reveal()
rail()
