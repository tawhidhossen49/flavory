// The three cart steps. Each is a real page, so the back button just works.
import { cart } from './cart.js'
import { esc, normalizePhone, slotLabel, tk } from './format.js'
import { TURNSTILE_SITE_KEY } from './config.js'
import { isSoldOut, start } from './site.js'

const app = document.getElementById('app')
const step = document.body.dataset.step
const data = await start('checkout')
const { delivery, payments, marketing } = data.settings

async function getQuote(extra = {}) {
  const res = await fetch('/api/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: cart.items(), ...extra }),
  })
  if (!res.ok) return null
  const q = await res.json()
  cart.sync(q.lines)
  return q
}

const progress = n => `<div class="progress" role="img" aria-label="Step ${n} of 3">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`
const problems = q => (q?.problems ?? []).map(p => `<p class="notice err">${esc(p)}</p>`).join('')
const totals = (q, area) => `
  <div class="totals">
    <div><span>Subtotal</span><span>${tk(q.subtotal)}</span></div>
    ${q.discount ? `<div><span>Discount</span><span>-${tk(q.discount)}</span></div>` : ''}
    ${area && area !== 'Pickup' ? `<div><span>Delivery</span><span>${q.delivery_fee ? tk(q.delivery_fee) : 'Free'}</span></div>` : ''}
    <div class="grand"><span>Total</span><span>${tk(q.total)}</span></div>
  </div>`

function emptyCart() {
  app.innerHTML = `<div class="stack center">
    <h1>Your cart is empty</h1>
    <p class="muted">Something crispy is one tap away.</p>
    <a href="/menu/" class="btn">See the menu</a>
  </div>`
}

// STEP 1: cart
async function cartStep() {
  let quote = null
  const paint = () => {
    if (!cart.lines().length) return emptyCart()
    app.innerHTML = `<div class="stack">
      ${progress(1)}
      <h1>Your cart</h1>
      ${problems(quote)}
      <div>${cart.lines().map(l => `
        <div class="line" data-id="${esc(l.option_id)}">
          <div class="line-name"><strong>${esc(l.name)}</strong>${l.label ? `<span class="muted"> · ${esc(l.label)}</span>` : ''}</div>
          <span>${tk(l.price * l.qty)}</span>
          <div class="qty">
            <button data-act="less" aria-label="One less ${esc(l.name)}">–</button>
            <output aria-label="Quantity">${l.qty}</output>
            <button data-act="more" aria-label="One more ${esc(l.name)}">+</button>
          </div>
          <button class="remove" data-act="remove">Remove</button>
        </div>`).join('')}</div>
      ${quote ? totals(quote) : ''}
      <a href="/cart/review/" class="btn block">Continue</a>
      <a href="/menu/" class="btn ghost block">Add more</a>
    </div>`
  }
  app.addEventListener('click', async e => {
    const act = e.target.dataset?.act
    if (!act) return
    const id = e.target.closest('.line').dataset.id
    const line = cart.lines().find(l => l.option_id === id)
    cart.setQty(id, act === 'remove' ? 0 : line.qty + (act === 'more' ? 1 : -1))
    paint()
    if (cart.lines().length) { quote = await getQuote(); paint() }
  })
  paint()
  if (cart.lines().length) { quote = await getQuote(); paint() }
}

// STEP 2: "Is that everything?"
async function reviewStep() {
  if (!cart.lines().length) return location.replace('/cart/')
  let quote = null
  const suggestions = data.items.filter(i => i.suggest && !isSoldOut(i))
  const paint = () => {
    const inCart = new Set(cart.lines().map(l => l.item_id))
    const offers = suggestions.filter(s => !inCart.has(s.id)).slice(0, 2)
    app.innerHTML = `<div class="stack">
      ${progress(2)}
      <h1>Is that everything?</h1>
      ${problems(quote)}
      <div>
        ${cart.lines().map(l => `<div class="t-row"><span>${l.qty} × ${esc(l.name)}${l.label ? ` (${esc(l.label)})` : ''}</span><span>${tk(l.price * l.qty)}</span></div>`).join('')}
        <hr class="dash">
        <div class="t-row"><strong>Subtotal</strong><strong>${tk(quote?.subtotal ?? cart.total())}</strong></div>
      </div>
      ${offers.map(i => {
        const o = i.item_options[0]
        return `<div class="suggest"><span>Add ${esc(i.name)}${o.label ? ` (${esc(o.label)})` : ''}? <span class="muted">${tk(o.price)}</span></span>
          <button class="btn ghost" data-add="${esc(i.id)}">Add</button></div>`
      }).join('')}
      <a href="/cart/details/" class="btn block">Yes, that's all — continue</a>
      <a href="/cart/" class="btn ghost block">Change my order</a>
    </div>`
  }
  app.addEventListener('click', async e => {
    const id = e.target.dataset?.add
    if (!id) return
    const i = suggestions.find(s => s.id === id)
    const o = i.item_options[0]
    cart.add({ option_id: o.id, item_id: i.id, name: i.name, label: o.label, price: o.price, photo: i.photos[0] ?? null })
    paint()
    quote = await getQuote()
    paint()
  })
  paint()
  quote = await getQuote()
  paint()
}

// STEP 3: details
function detailsStep() {
  if (!cart.lines().length) return location.replace('/cart/')
  const showCoupon = marketing.coupons || marketing.bounce.enabled || marketing.referral.enabled
  const areaNames = delivery.areas.map(a => a.name).join(' and ')

  app.innerHTML = `<form class="stack loose" id="form" novalidate>
    ${progress(3)}
    <h1>Your details</h1>
    <div class="field"><label for="name">Name</label>
      <input class="input" id="name" name="name" required minlength="2" maxlength="60" autocomplete="name"></div>
    <div class="field"><label for="phone">Phone</label>
      <input class="input" id="phone" name="phone" type="tel" inputmode="tel" required autocomplete="tel" placeholder="01712-345678" maxlength="18"></div>
    <fieldset class="field"><legend>Area</legend>
      <div class="opts">
        ${delivery.areas.map(a => `<label class="opt"><input type="radio" name="area" value="${esc(a.name)}"><span>${esc(a.name)}</span></label>`).join('')}
        <label class="opt"><input type="radio" name="area" value="Pickup"><span>Pickup</span></label>
      </div>
      <span class="hint" id="area-hint">We deliver to ${esc(areaNames)} only.</span>
    </fieldset>
    <div class="field" id="address-field"><label for="address">Road and house</label>
      <input class="input" id="address" name="address" maxlength="200" autocomplete="street-address" placeholder="Road 7, House 12, Flat 3B"></div>
    <div class="field"><label for="time">Delivery time</label>
      <select class="input" id="time" name="time"></select>
      <span class="hint" id="time-hint" hidden>We are closed right now, so please choose a time.</span></div>
    <fieldset class="field"><legend>Payment</legend>
      <div class="opts">
        <label class="opt"><input type="radio" name="payment" value="cod" checked><span>Cash on delivery</span></label>
        ${payments.bkash_enabled ? '<label class="opt"><input type="radio" name="payment" value="bkash"><span>bKash</span></label>' : ''}
      </div>
      <span class="hint" id="bkash-hint" hidden>Send the total to ${esc(payments.bkash_number)} and we will confirm it when we call.</span>
    </fieldset>
    <div class="field"><label for="note">Note (optional)</label>
      <textarea class="input" id="note" name="note" rows="2" maxlength="300" placeholder="Extra spicy dip please"></textarea></div>
    ${showCoupon ? `<div class="field"><label for="code">Discount code (optional)</label>
      <div class="row"><input class="input" id="code" maxlength="30"><button type="button" class="btn ghost" id="apply">Apply</button></div>
      <span id="code-msg"></span></div>` : ''}
    <div id="summary"></div>
    ${TURNSTILE_SITE_KEY ? `<div class="cf-turnstile" data-sitekey="${esc(TURNSTILE_SITE_KEY)}" data-theme="dark"></div>` : ''}
    <p class="notice err" id="error" role="alert" hidden></p>
    <button class="btn block" id="submit" disabled>Place order</button>
    <p class="muted center">By ordering you agree to our <a class="link" href="/terms/">terms</a>.</p>
  </form>`

  if (TURNSTILE_SITE_KEY) {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    s.defer = true
    document.head.append(s)
  }

  const form = document.getElementById('form')
  const $ = id => document.getElementById(id)
  const area = () => form.elements.area.value
  let coupon = ''
  let quote = null
  let run = 0

  function fillTimes() {
    const keep = $('time').value
    const open = quote.open_now
    $('time').innerHTML = (open ? '<option value="ASAP">As soon as possible</option>' : '') +
      quote.slots.map(s => `<option value="${esc(s)}">${esc(slotLabel(s))}</option>`).join('')
    if ([...$('time').options].some(o => o.value === keep)) $('time').value = keep
    $('time-hint').hidden = open
  }

  async function refresh() {
    const me = ++run
    const q = await getQuote({ area: area(), coupon, phone: normalizePhone($('phone').value) ?? '' })
    if (me !== run) return
    if (!q) {
      $('summary').innerHTML = '<p class="notice err">We could not work out your total. Please refresh the page, or call us to order.</p>'
      return
    }
    quote = q
    if (!q.open_now && !q.slots.length) {
      app.innerHTML = `<div class="stack center"><h1>The kitchen is closed</h1>
        <p class="muted">We can't take orders right now. Your cart is saved for when we reopen.</p></div>`
      return
    }
    fillTimes()
    $('summary').innerHTML = problems(q) + totals(q, area())
    const msg = $('code-msg')
    if (msg) {
      msg.textContent = q.coupon ? 'Code applied.' : q.coupon_message ?? ''
      msg.className = q.coupon ? 'hint' : 'err'
    }
    $('submit').disabled = false
    $('submit').textContent = `Place order · ${tk(q.total)}`
  }

  form.addEventListener('change', e => {
    if (e.target.name === 'area') {
      const pickup = area() === 'Pickup'
      $('address-field').hidden = pickup
      $('area-hint').textContent = pickup ? `Pick up from our kitchen and get ${tk(delivery.pickup_discount)} off.` : `We deliver to ${areaNames} only.`
    }
    if (e.target.name === 'payment') $('bkash-hint').hidden = form.elements.payment.value !== 'bkash'
    if (['area', 'phone'].includes(e.target.name)) refresh()
  })
  $('apply')?.addEventListener('click', () => { coupon = $('code').value.trim(); refresh() })

  form.addEventListener('submit', async e => {
    e.preventDefault()
    const err = $('error')
    const fail = msg => { err.textContent = msg; err.hidden = false; err.scrollIntoView({ block: 'center' }) }
    err.hidden = true
    const phone = normalizePhone($('phone').value)
    if ($('name').value.trim().length < 2) return fail('Please enter your name.')
    if (!phone) return fail('Please enter a valid Bangladeshi mobile number, like 01712-345678.')
    if (!area()) return fail('Please choose your area.')

    const btn = $('submit')
    btn.disabled = true
    btn.textContent = 'Placing your order…'
    let res
    try {
      res = await (await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.items(), area: area(), coupon, phone, payment: form.elements.payment.value,
          delivery_time: $('time').value, name: $('name').value, address: $('address').value, note: $('note').value,
          expected_total: quote.total, turnstile: form.elements['cf-turnstile-response']?.value,
        }),
      })).json()
    } catch { res = { error: 'We could not reach the kitchen. Please check your connection and try again.' } }

    if (res.error) {
      fail(res.error)
      await refresh()
      return
    }
    try { if (res.whatsapp) sessionStorage.setItem(`wa-${res.token}`, res.whatsapp) } catch { /* the button just stays hidden */ }
    cart.clear()
    location.href = `/r/${res.token}`
  })

  refresh()
}

({ cart: cartStep, review: reviewStep, details: detailsStep })[step]()
