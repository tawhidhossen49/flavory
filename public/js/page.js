// Fills the content pages (Our Story, Reviews, Delivery & FAQ, Contact, Legal) from admin-edited text.
import { clock, esc, tk } from './format.js'
import { reveal, reviewHtml, safeUrl, start } from './site.js'

const slug = document.body.dataset.page
const app = document.getElementById('app')
const { settings, page, reviews } = await start(slug)
const { business: b, delivery: d, payments: pay } = settings
const tel = `tel:${b.phone.replace(/\D/g, '')}`

// Last word of a title in gold italic: "Delivery & <em>FAQ</em>".
const accent = t => esc(t).replace(/(\S+)$/, '<em>$1</em>')

const head = (ghost, kicker, title, sub) => `
  <header class="page-head">
    ${ghost ? `<p class="ghost-word" aria-hidden="true">${esc(ghost)}</p>` : ''}
    <p class="kicker" data-reveal>${esc(kicker)}</p>
    <h1 class="mt16" data-t1>${accent(title)}</h1>
    ${sub ? `<p class="second mt16" data-reveal>${esc(sub)}</p>` : ''}
  </header>`

function ourStory() {
  app.className = 'wrap page-pad'
  const paragraphs = page.body.split(/\n{2,}/).map(p => `<p class="prose" data-reveal>${esc(p)}</p>`).join('')
  return `
  <div class="story-hero">
    ${head('Shaheen', 'Our story', page.title, page.intro)}
    <div class="chef-arch"><div class="arch-clip"><img src="/brand/chef-cut.webp" alt="Chef Shaheen Islam" width="546" height="1304"></div></div>
  </div>
  <div class="narrow stack loose mt40">
    ${paragraphs}
    <ul class="creds">
      <li data-reveal><b>PCA-trained</b><span>Professional Cooking Academy, Dhaka</span></li>
      <li data-reveal data-delay=".1"><b>Certified</b><span>Fast Food &amp; Frozen Food</span></li>
      <li data-reveal data-delay=".2"><b>Also certified</b><span>Biryani, Chinese &amp; Special Kabab</span></li>
    </ul>
    ${page.photos?.length ? `<div class="photos">${page.photos.filter(safeUrl).map(u => `<img src="${esc(u)}" alt="Inside the Flavory kitchen" loading="lazy" width="400" height="400" data-reveal>`).join('')}</div>` : ''}
    <div class="poster-frame" data-reveal><img class="poster" src="${esc(page.poster)}" alt="Meet Our Chef poster: Chef Shaheen Islam, PCA trained chef" width="1014" height="1550" loading="lazy"></div>
    <p class="script signature" data-reveal>${esc(page.sign_off)}</p>
    <p data-reveal><a class="btn pill" href="/menu/" data-magnetic>Taste it yourself <i aria-hidden="true">→</i></a></p>
  </div>`
}

const reviewsPage = () => `
  ${head('Reviews', 'Reviews', 'From our customers', 'Every review here comes from a real, delivered order.')}
  ${reviews.length ? `<div class="reviews" data-tilted>${reviews.map(reviewHtml).join('')}</div>`
    : '<p class="lede" data-reveal>No reviews yet. When customers share their thoughts, you will read them here.</p>'}`

function delivery() {
  const payment = pay.bkash_enabled ? 'Cash on delivery or bKash.' : 'Cash on delivery.'
  const faq = page.faq.map(f => f.q === 'How do I pay?' ? { ...f, a: payment } : f)
  return `
    ${head('Delivery', 'Delivery & questions', page.title, page.intro)}
    <h2 class="mt24" data-t1>Fees</h2>
    <table class="fee-table mt16" data-reveal><tbody>
      ${d.areas.map(a => `<tr><td>${esc(a.name)}</td><td>${tk(a.fee)}</td></tr>`).join('')}
      <tr><td>Orders over ${tk(d.free_over)}</td><td>Free delivery</td></tr>
      <tr><td>Pickup from our kitchen</td><td>${tk(d.pickup_discount)} off</td></tr>
    </tbody></table>
    <h2 class="mt40" data-t1>Hours</h2>
    <p class="muted mt16" data-reveal>Every day, ${clock(b.open)} – ${clock(b.close)}</p>
    <h2 class="mt40" data-t1>Questions</h2>
    <div class="faq mt16" data-reveal>${faq.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>`
}

const contact = () => `
  ${head('Contact', 'Contact', page.title, page.intro)}
  <div class="stack" data-reveal>
    <a class="btn block" href="${esc(tel)}">Call ${esc(b.phone)}</a>
    ${b.whatsapp ? `<a class="btn whatsapp block" href="https://wa.me/${esc(b.whatsapp.replace(/\D/g, '').replace(/^0/, '880'))}" target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a>` : ''}
    ${safeUrl(b.facebook) ? `<a class="btn ghost block" href="${esc(safeUrl(b.facebook))}" target="_blank" rel="noopener noreferrer">Facebook</a>` : ''}
  </div>
  <div class="facts">
    <div class="fact" data-reveal><strong>${esc(b.area_label.split(',')[0])}</strong><span>Delivery-only kitchen. We deliver to ${esc(d.areas.map(a => a.name).join(' and '))}.</span></div>
    <div class="fact" data-reveal data-delay=".1"><strong>${clock(b.open).replace(':00', '')} – ${clock(b.close).replace(':00', '')}</strong><span>Open every day</span></div>
  </div>`

const legal = () => `
  <div class="legal">
    ${head('', 'Flavory', page.title)}
    ${page.sections.map(s => `<h2 data-reveal>${esc(s.h)}</h2><p class="muted" data-reveal>${esc(s.b)}</p>`).join('')}
  </div>`

const render = { 'our-story': ourStory, reviews: reviewsPage, delivery, contact, privacy: legal, terms: legal, refund: legal }
app.innerHTML = render[slug]()
reveal()
