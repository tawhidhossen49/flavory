import { clock, esc, tk } from './format.js'
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

const { settings, page, items, reviews } = await start('home')
const { business: b, delivery: d } = settings

const [titleA, ...titleB] = page.hero_title.split('. ')
const title = document.getElementById('hero-title').querySelectorAll('span span')
title[0].textContent = `${titleA}.`
title[1].textContent = titleB.join('. ')
setText('hero-sub', page.hero_sub)
setText('promise', page.promise)
setText('story-title', page.story_title)
setText('story-text', page.story_text)

if (safeUrl(page.hero_image)) {
  const hero = document.getElementById('hero')
  const photo = document.createElement('div')
  photo.className = 'hero-photo'
  const img = new Image()
  img.src = page.hero_image
  img.alt = ''
  photo.append(img)
  hero.prepend(photo)
  document.getElementById('arch').hidden = true
}

document.getElementById('steps').innerHTML = page.steps.map((s, i) =>
  `<div class="step in"><h3>${esc(s.title)}</h3><p class="muted">${esc(s.text)}</p></div>`).join('')

const flagged = items.filter(i => i.badge === 'Best seller')
if (flagged.length) setText('best-kicker', 'Best sellers')
const featured = document.getElementById('featured')
const shown = (flagged.length ? flagged : items).slice(0, 3)
featured.innerHTML = shown.map(cardHtml).join('')
bindCards(featured, shown)

setText('areas', d.areas.map(a => a.name).join(' & '))
setText('hours', `Every day, ${clock(b.open)} – ${clock(b.close)}`)
setText('free-over', `Free on orders over ${tk(d.free_over)}.`)
setText('kitchen', b.area_label)
const phone = document.getElementById('phone')
phone.textContent = b.phone
phone.href = `tel:${b.phone.replace(/\D/g, '')}`

if (safeUrl(b.facebook)) {
  document.getElementById('fb-link').href = safeUrl(b.facebook)
  document.getElementById('fb-section').hidden = false
}

document.getElementById('reviews').innerHTML = reviews.length
  ? `<div class="reviews">${reviews.slice(0, 4).map(reviewHtml).join('')}</div>`
  : '<p class="muted mt16">No reviews yet. When customers share their thoughts, you will read them here.</p>'

reveal()
