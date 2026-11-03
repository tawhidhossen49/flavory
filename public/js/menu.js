import { esc } from './format.js'
import { bindCards, cardHtml, start } from './site.js'

const { settings, categories, items } = await start('menu')
document.getElementById('closed').hidden = settings.business.kitchen_open

const filled = categories.filter(c => items.some(i => i.category_id === c.id))
const menu = document.getElementById('menu')
const rail = document.getElementById('tabs')

rail.innerHTML = filled.map((c, i) =>
  `<a class="tab" href="#cat-${esc(c.id)}" aria-current="${i === 0}">${esc(c.name)}</a>`).join('')

menu.innerHTML = filled.map(c => `
  <section class="cat" id="cat-${esc(c.id)}" aria-labelledby="h-${esc(c.id)}">
    <h2 id="h-${esc(c.id)}">${esc(c.name)}</h2>
    <div class="grid">${items.filter(i => i.category_id === c.id).map(cardHtml).join('')}</div>
  </section>`).join('')

bindCards(menu, items)

// Keeps the tab for the category on screen highlighted.
const io = new IntersectionObserver(entries => {
  const hit = entries.find(e => e.isIntersecting)
  if (!hit) return
  rail.querySelectorAll('.tab').forEach(t => {
    const on = t.hash === `#${hit.target.id}`
    t.setAttribute('aria-current', on)
    if (on) rail.scrollTo({ left: t.offsetLeft - 16, behavior: 'smooth' })
  })
}, { rootMargin: '-25% 0px -70% 0px' })
menu.querySelectorAll('.cat').forEach(s => io.observe(s))
