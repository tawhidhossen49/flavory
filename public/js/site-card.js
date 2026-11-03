// The menu card on its own, so the admin preview can use it without loading the public site chrome.
import { artSvg, photoOf } from './art.js'
import { dhakaToday, esc, tk } from './format.js'

export function photo(url, alt, sizes) {
  const small = url.replace(/\.webp$/, '-480.webp')
  return `<img src="${esc(url)}" srcset="${esc(small)} 480w, ${esc(url)} 1200w" sizes="${sizes}" alt="${esc(alt)}" width="480" height="300" loading="lazy" decoding="async">`
}

export function priceLabel(item) {
  const prices = item.item_options.map(o => o.price)
  if (!prices.length) return ''
  return prices.length > 1 ? `from ${tk(Math.min(...prices))}` : tk(prices[0])
}

export const isSoldOut = item => !item.available || item.sold_out_on === dhakaToday()

const PLUS = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'

export function cardHtml(item) {
  const soldOut = isSoldOut(item)
  const opts = item.item_options
  const pic = photoOf(item)
  return `
  <article class="card${soldOut ? ' out' : ''}${pic ? ' has-photo' : ''}" data-item="${esc(item.id)}">
    <div class="card-visual">
      <div class="card-plate">${pic ? photo(pic, item.name, '(min-width: 900px) 360px, (min-width: 640px) 50vw, 100vw') : artSvg(item.name)}</div>
      ${item.badge ? `<span class="badge">${esc(item.badge)}</span>` : ''}
    </div>
    <div class="card-body">
      <div class="card-head">
        <h3 class="card-name">${esc(item.name)}</h3>
        <span class="price">${esc(priceLabel(item))}</span>
      </div>
      ${item.description ? `<p class="card-desc">${esc(item.description)}</p>` : ''}
      ${item.ingredients ? `<p class="card-ing">${esc(item.ingredients)}</p>` : ''}
      <div class="card-foot">
        ${soldOut ? '<button class="btn block" disabled>Sold out today</button>' : `
          ${opts.length > 1 ? `<fieldset class="opts"><legend class="sr">Choose a size for ${esc(item.name)}</legend>
            ${opts.map((o, i) => `<label class="opt"><input type="radio" name="opt-${esc(item.id)}" value="${esc(o.id)}"${i ? '' : ' checked'}><span>${esc(o.label)}</span></label>`).join('')}
          </fieldset>` : ''}
          <button class="btn add block" data-add aria-live="polite"><span class="add-label">Add · ${tk(opts[0]?.price ?? 0)}</span>${PLUS}</button>`}
      </div>
    </div>
    <span class="card-sheen" aria-hidden="true"></span>
  </article>`
}
