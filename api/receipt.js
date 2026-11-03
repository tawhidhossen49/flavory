// A server-rendered page because WhatsApp's preview bot reads the HTML and never runs JavaScript.
import { rpc, rest, siteUrl } from '../lib/db.js'
import { PAYMENT_LABEL, dateTime, esc, orderNo, slotLabel, tk } from '../public/js/format.js'

const row = (a, b, cls = '') => `<div class="t-row ${cls}"><span>${esc(a)}</span><span>${esc(b)}</span></div>`

function page(r, token, site, business) {
  const no = orderNo(r.order_no)
  const delivery = r.delivery_fee ? tk(r.delivery_fee) : r.area === 'Pickup' ? 'Pickup' : 'Free'
  const extras = [
    r.bounce_code && `${tk(r.bounce_amount)} off your next order within ${r.bounce_days} days. Code: <strong>${esc(r.bounce_code)}</strong>`,
    r.loyalty && (r.loyalty.count % r.loyalty.every === 0
      ? `This order earned your reward: ${esc(r.loyalty.label)}!`
      : `Order ${r.loyalty.count % r.loyalty.every} of ${r.loyalty.every} towards ${esc(r.loyalty.label)}.`),
    r.referral_code && `Share code <strong>${esc(r.referral_code)}</strong>: your friend gets ${tk(r.referral_amount)} off their first order, and you get ${tk(r.referral_amount)} off your next.`,
  ].filter(Boolean).map(x => `<hr class="dash"><p class="center">${x}</p>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flavory order ${no}</title>
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0C0811">
<meta property="og:title" content="Flavory order ${no}">
<meta property="og:description" content="Total ${tk(r.total)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(site)}/r/${esc(token)}">
<meta property="og:image" content="${esc(site)}/r/${esc(token)}/preview">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.png">
<link rel="stylesheet" href="/css/site.css">
<script type="module" src="/js/receipt.js"></script>
</head>
<body data-token="${esc(token)}" data-order="${no}" data-whatsapp="${business.whatsapp ? 1 : 0}" data-delivered="${r.status === 'delivered' && !r.reviewed ? 1 : 0}">
<main class="receipt-wrap">
  <div class="slot" aria-hidden="true"></div>
  <div class="paper-clip">
    <article class="ticket" aria-label="Receipt for order ${no}">
      <div class="ticket-head">
        <img src="/brand/logo.webp" alt="Flavory" width="76" height="76">
        <h1>${no}</h1>
        <p>${esc(dateTime(r.created_at))}</p>
      </div>
      <hr class="dash">
      ${r.lines.map(l => row(`${l.qty} × ${l.name}${l.label ? ` (${l.label})` : ''}`, tk(l.price * l.qty))).join('')}
      <hr class="dash">
      ${row('Subtotal', tk(r.subtotal))}
      ${r.discount ? row('Discount', `-${tk(r.discount)}`) : ''}
      ${row('Delivery', delivery)}
      ${row('Total', tk(r.total), 't-grand')}
      <hr class="dash">
      ${row('Payment', PAYMENT_LABEL[r.payment])}
      ${row('Name', r.first_name)}
      ${row('Area', r.area)}
      ${row('Delivery time', r.scheduled_for ? slotLabel(r.scheduled_for) : 'ASAP')}
      ${r.note ? `<p class="t-note">Note: ${esc(r.note)}</p>` : ''}
      ${extras}
      <hr class="dash">
      <p class="ticket-foot">Not crispy when it arrives? We replace it free.</p>
    </article>
  </div>
  <div id="actions" class="stack mt24"></div>
</main>
</body>
</html>`
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const notFound = () => new Response('Receipt not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } })
  if (!/^[a-f0-9]{48}$/.test(token)) return notFound()

  const { data } = await rpc('get_receipt', { p_token: token })
  if (!data) return notFound()
  const [business] = await rest('settings?select=value&key=eq.business')

  return new Response(page(data, token, siteUrl(request), business.value), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  })
}
