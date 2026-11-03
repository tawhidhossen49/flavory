// Everything shared by the public pages: header, footer, cart bar, reveals and page data.
import { cart } from './cart.js'
import { clock, esc, tk } from './format.js'

export { cardHtml, isSoldOut } from './site-card.js'

const LINKS = [
  ['/menu', 'Menu'], ['/our-story', 'Our Story'], ['/reviews', 'Reviews'],
  ['/delivery-faq', 'Delivery & FAQ'], ['/contact', 'Contact'],
]

function renderHeader() {
  const el = document.getElementById('hdr')
  if (!el) return
  const links = LINKS.map(([href, label]) =>
    `<a href="${href}"${location.pathname === href ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('')
  el.innerHTML = `
    <div class="wrap hdr-in">
      <a href="/" class="hdr-logo" aria-label="Flavory home"><img src="/brand/logo.webp" alt="Flavory" width="58" height="58"></a>
      <nav class="hdr-links" aria-label="Main">${links}</nav>
      <div class="hdr-end">
        <a class="btn hdr-order" id="hdr-order" href="/menu">Order</a>
        <details class="hdr-menu">
          <summary class="burger" aria-label="Open menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </summary>
          <nav aria-label="Mobile">${links}</nav>
        </details>
      </div>
    </div>`
}

function renderFooter({ business: b, delivery: d }) {
  const el = document.getElementById('ftr')
  if (!el) return
  el.innerHTML = `
    <footer class="ftr"><div class="wrap">
      <p class="script ftr-word" aria-hidden="true">Flavory</p>
      <div class="ftr-cols">
        <div><h3>Hours</h3><p>Every day, ${clock(b.open)} – ${clock(b.close)}</p></div>
        <div><h3>We deliver to</h3><p>${esc(d.areas.map(a => a.name).join(' & '))}</p><p class="muted">Kitchen in ${esc(b.area_label)}</p></div>
        <div><h3>Flavory</h3><ul>
          <li><a href="tel:${esc(b.phone.replace(/\D/g, ''))}">${esc(b.phone)}</a></li>
          ${safeUrl(b.facebook) ? `<li><a href="${esc(safeUrl(b.facebook))}" rel="noopener noreferrer" target="_blank">Facebook</a></li>` : ''}
          <li><a href="/privacy">Privacy Policy</a></li>
          <li><a href="/terms">Terms</a></li>
          <li><a href="/refund">Refund & Replacement</a></li>
        </ul></div>
      </div>
      <p class="ftr-small">© ${new Date().getFullYear()} Flavory, Dhaka.</p>
    </div></footer>`
}

function renderCartBar() {
  const onCart = location.pathname.startsWith('/cart')
  let bar = document.getElementById('bar')
  const paint = () => {
    const count = cart.count()
    const order = document.getElementById('hdr-order')
    if (order) {
      order.textContent = count ? `Cart (${count})` : 'Order'
      order.href = count ? '/cart' : '/menu'
    }
    const show = count > 0 && !onCart
    document.body.classList.toggle('has-bar', show)
    if (!show) { bar?.remove(); bar = null; return }
    if (!bar) {
      bar = document.createElement('div')
      bar.id = 'bar'
      bar.className = 'bar'
      bar.innerHTML = '<a href="/cart" class="btn block"></a>'
      document.body.append(bar)
    }
    bar.firstChild.textContent = `View cart · ${tk(cart.total())}`
  }
  paint()
  cart.subscribe(paint)
}

export function reveal() {
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
  document.querySelectorAll('[data-reveal]:not(.in), [data-seal]:not(.in)').forEach(el => io.observe(el))
}

// Only http(s) links from settings may reach an href.
export const safeUrl = u => /^https?:\/\//i.test(u ?? '') ? u : ''

export const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text }

// Fetches the page's data (cached at the CDN) and fills the shared chrome.
export async function start(page) {
  renderHeader()
  renderCartBar()
  reveal()
  const res = await fetch(`/api/content?page=${page}`)
  if (!res.ok) throw new Error('content failed')
  const data = await res.json()
  renderFooter(data.settings)
  return data
}

// One delegated listener handles every card, however long the menu gets.
export function bindCards(root, items) {
  const byId = new Map(items.map(i => [i.id, i]))
  const chosen = (card, item) => {
    const id = card.querySelector('input:checked')?.value
    return item.item_options.find(o => o.id === id) ?? item.item_options[0]
  }
  root.addEventListener('change', e => {
    const card = e.target.closest('.card')
    const item = byId.get(card?.dataset.item)
    if (item) card.querySelector('[data-add]').textContent = `Add · ${tk(chosen(card, item).price)}`
  })
  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-add]')
    if (!btn) return
    const card = btn.closest('.card')
    const item = byId.get(card.dataset.item)
    const o = chosen(card, item)
    cart.add({ option_id: o.id, item_id: item.id, name: item.name, label: o.label, price: o.price, photo: item.photos[0] ?? null })
    btn.textContent = 'Added'
    clearTimeout(btn._t)
    btn._t = setTimeout(() => { btn.textContent = `Add · ${tk(chosen(card, item).price)}` }, 1400)
  })
}

export const reviewHtml = r => `
  <blockquote class="review stack tight">
    <p class="stars" role="img" aria-label="${Number(r.rating)} out of 5">${'★'.repeat(r.rating)}</p>
    <p>${esc(r.body)}</p>
    <footer class="muted">${esc(r.name)}</footer>
  </blockquote>`
