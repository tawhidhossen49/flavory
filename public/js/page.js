// Fills the content pages (Our Story, Reviews, Delivery & FAQ, Contact, Legal) from admin-edited text.
import { clock, esc, tk } from './format.js'
import { reveal, reviewHtml, safeUrl, start } from './site.js'

const slug = document.body.dataset.page
const app = document.getElementById('app')
const { settings, page, reviews } = await start(slug)
const { business: b, delivery: d, payments: pay } = settings
const tel = `tel:${b.phone.replace(/\D/g, '')}`

function ourStory() {
  const paragraphs = page.body.split(/\n{2,}/).map(p => `<p class="prose" data-reveal>${esc(p)}</p>`).join('')
  return `<div class="stack">
    <h1>${esc(page.title)}</h1>
    <p class="second">${esc(page.intro)}</p>
    <hr class="rule">
    ${paragraphs}
    <div class="badges" data-reveal>
      <span class="g-badge">PCA-trained</span>
      <span class="g-badge">Certified Fast Food & Frozen</span>
      <span class="g-badge">Biryani, Chinese & Kabab</span>
    </div>
    ${page.photos?.length ? `<div class="photos">${page.photos.filter(safeUrl).map(u => `<img src="${esc(u)}" alt="Inside the Flavory kitchen" loading="lazy" width="400" height="400">`).join('')}</div>` : ''}
    <img class="poster" src="${esc(page.poster)}" alt="Meet Our Chef poster: Chef Shaheen Islam, PCA trained chef" width="1014" height="1550" loading="lazy" data-reveal>
    <p class="script signature" data-reveal>${esc(page.sign_off)}</p>
  </div>`
}

const reviewsPage = () => `<div class="stack">
  <h1>Reviews</h1>
  <p class="second">Every review here comes from a real, delivered order.</p>
  ${reviews.length ? `<div class="reviews">${reviews.map(reviewHtml).join('')}</div>`
    : '<p class="muted">No reviews yet. When customers share their thoughts, you will read them here.</p>'}
</div>`

function delivery() {
  const payment = pay.bkash_enabled ? 'Cash on delivery or bKash.' : 'Cash on delivery.'
  const faq = page.faq.map(f => f.q === 'How do I pay?' ? { ...f, a: payment } : f)
  return `<div class="stack">
    <h1>${esc(page.title)}</h1>
    <p class="second">${esc(page.intro)}</p>
    <h2 class="mt24">Fees</h2>
    <table class="fee-table"><tbody>
      ${d.areas.map(a => `<tr><td>${esc(a.name)}</td><td>${tk(a.fee)}</td></tr>`).join('')}
      <tr><td>Orders over ${tk(d.free_over)}</td><td>Free delivery</td></tr>
      <tr><td>Pickup from our kitchen</td><td>${tk(d.pickup_discount)} off</td></tr>
    </tbody></table>
    <h2 class="mt24">Hours</h2>
    <p class="muted">Every day, ${clock(b.open)} – ${clock(b.close)}</p>
    <h2 class="mt24">Questions</h2>
    <div class="faq">${faq.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>
  </div>`
}

const contact = () => `<div class="stack">
  <h1>${esc(page.title)}</h1>
  <p class="second">${esc(page.intro)}</p>
  <a class="btn block" href="${esc(tel)}">Call ${esc(b.phone)}</a>
  ${b.whatsapp ? `<a class="btn whatsapp block" href="https://wa.me/${esc(b.whatsapp.replace(/\D/g, '').replace(/^0/, '880'))}" target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a>` : ''}
  ${safeUrl(b.facebook) ? `<a class="btn ghost block" href="${esc(safeUrl(b.facebook))}" target="_blank" rel="noopener noreferrer">Facebook</a>` : ''}
  <h2 class="mt24">Find us</h2>
  <p class="muted">Delivery-only kitchen in ${esc(b.area_label)}. We deliver to ${esc(d.areas.map(a => a.name).join(' and '))}.</p>
  <h2 class="mt24">Hours</h2>
  <p class="muted">Every day, ${clock(b.open)} – ${clock(b.close)}</p>
</div>`

const legal = () => `<div class="legal">
  <h1>${esc(page.title)}</h1>
  ${page.sections.map(s => `<h2>${esc(s.h)}</h2><p class="muted">${esc(s.b)}</p>`).join('')}
</div>`

const render = { 'our-story': ourStory, reviews: reviewsPage, delivery, contact, privacy: legal, terms: legal, refund: legal }
app.innerHTML = render[slug]()
reveal()
