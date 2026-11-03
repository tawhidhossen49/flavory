// The menu card on its own, so the admin preview can use it without loading the public site chrome.
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

export function cardHtml(item) {
  const soldOut = isSoldOut(item)
  const opts = item.item_options
  return `
  <article class="card${soldOut ? ' out' : ''}" data-item="${esc(item.id)}">
    <div class="card-photo">
      ${item.photos[0] ? photo(item.photos[0], item.name, '(min-width: 900px) 360px, (min-width: 640px) 50vw, 100vw') : '<div class="card-ph"><span class="script" aria-hidden="true">F</span></div>'}
      ${item.badge ? `<span class="badge">${esc(item.badge)}</span>` : ''}
    </div>
    <div class="card-body">
      <h3 class="card-name">${esc(item.name)}</h3>
      ${item.description ? `<p class="card-desc">${esc(item.description)}</p>` : ''}
      ${item.ingredients ? `<p class="card-ing">${esc(item.ingredients)}</p>` : ''}
      <div class="card-foot">
        <span class="price">${esc(priceLabel(item))}</span>
        ${soldOut ? '<button class="btn block" disabled>Sold out today</button>' : `
          ${opts.length > 1 ? `<fieldset class="opts"><legend class="sr">Choose a size for ${esc(item.name)}</legend>
            ${opts.map((o, i) => `<label class="opt"><input type="radio" name="opt-${esc(item.id)}" value="${esc(o.id)}"${i ? '' : ' checked'}><span>${esc(o.label)}</span></label>`).join('')}
          </fieldset>` : ''}
          <button class="btn block" data-add aria-live="polite">Add · ${tk(opts[0]?.price ?? 0)}</button>`}
      </div>
    </div>
  </article>`
}
