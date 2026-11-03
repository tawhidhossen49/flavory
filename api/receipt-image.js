import { readFile } from 'node:fs/promises'
import satori from 'satori'
import sharp from 'sharp'
import { rpc } from '../lib/db.js'
import { PAYMENT_LABEL, dateTime, orderNo, slotLabel, tk } from '../public/js/format.js'

const asset = p => readFile(new URL(`../assets/${p}`, import.meta.url))
const PLUM = '#1E0C29', GOLD = '#C9A45C', GOLD_INK = '#7A5A1E', IVORY = '#FBF4E8', KRAFT = '#B58A5C'

// satori takes a plain element tree; every multi-child box must be display:flex.
const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.flat().filter(Boolean) } })

const row = (a, b, style = {}) => h('div', { justifyContent: 'space-between', marginBottom: 8, ...style },
  h('span', { maxWidth: '78%' }, a), h('span', {}, b))
const dash = () => h('div', { borderTop: `2px dashed ${KRAFT}`, margin: '18px 0' })
const lineText = l => `${l.qty} × ${l.name}${l.label ? ` (${l.label})` : ''}`
const logo = (src, size) => ({ type: 'img', props: { src, width: size, height: size, style: { borderRadius: size / 2 } } })

function fullReceipt(r, src) {
  const width = 900
  const height = 920 + r.lines.length * 58 + (r.discount ? 42 : 0)
  // satori adds padding and borders on top of width/height, so sizes here are inner sizes
  return [width, height, h('div', { width, height, background: PLUM, padding: 36, fontFamily: 'Montserrat', fontSize: 28, color: PLUM },
    h('div', { flexDirection: 'column', width: width - 72 - 104 - 4, height: height - 72 - 88 - 4, background: IVORY, padding: '44px 52px', border: `2px solid ${GOLD}` },
      h('div', { flexDirection: 'column', alignItems: 'center' },
        logo(src, 120),
        h('div', { fontFamily: 'Great Vibes', fontSize: 76, color: GOLD_INK, marginTop: 4 }, 'Flavory'),
        h('div', { fontWeight: 600, letterSpacing: 2, marginTop: 6 }, orderNo(r.order_no)),
        h('div', { fontSize: 24, marginTop: 4 }, dateTime(r.created_at))),
      dash(),
      r.lines.map(l => row(lineText(l), tk(l.price * l.qty))),
      dash(),
      row('Subtotal', tk(r.subtotal)),
      r.discount ? row('Discount', `-${tk(r.discount)}`) : null,
      row('Delivery', r.delivery_fee ? tk(r.delivery_fee) : r.area === 'Pickup' ? 'Pickup' : 'Free'),
      row('Total', tk(r.total), { fontFamily: 'Playfair', fontSize: 42, marginTop: 8 }),
      dash(),
      row('Payment', PAYMENT_LABEL[r.payment]),
      row('Name', r.first_name),
      row('Area', r.area),
      row('Delivery', r.scheduled_for ? slotLabel(r.scheduled_for) : 'ASAP'),
      h('div', { justifyContent: 'center', marginTop: 'auto', color: GOLD_INK, fontWeight: 600 }, 'Fried fresh. Made properly.')))]
}

// The landscape card WhatsApp and Facebook show as the link preview.
function preview(r, src) {
  const shown = r.lines.slice(0, 4)
  return [1200, 630, h('div', { width: 1200, height: 630, background: PLUM, fontFamily: 'Montserrat', fontSize: 30, padding: 40, gap: 48 },
    h('div', { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 396, height: 546, border: `2px solid ${GOLD}`, color: IVORY },
      logo(src, 180),
      h('div', { fontFamily: 'Great Vibes', fontSize: 84, color: GOLD, marginTop: 8 }, 'Flavory'),
      h('div', { fontFamily: 'Playfair', fontSize: 36, marginTop: 8 }, 'Order receipt')),
    h('div', { flexDirection: 'column', width: 672 - 80, height: 550 - 64, background: IVORY, color: PLUM, padding: '32px 40px' },
      h('div', { fontWeight: 600, fontSize: 34, marginBottom: 4 }, orderNo(r.order_no)),
      h('div', { fontSize: 24, marginBottom: 6 }, dateTime(r.created_at)),
      dash(),
      shown.map(l => row(lineText(l), tk(l.price * l.qty))),
      r.lines.length > shown.length ? h('div', { fontSize: 26 }, `…and ${r.lines.length - shown.length} more`) : null,
      row('Total', tk(r.total), { fontFamily: 'Playfair', fontSize: 46, marginTop: 'auto', marginBottom: 0 })))]
}

export async function GET(request) {
  const params = new URL(request.url).searchParams
  const token = params.get('token') ?? ''
  if (!/^[a-f0-9]{48}$/.test(token)) return new Response('Not found', { status: 404 })
  const { data: r } = await rpc('get_receipt', { p_token: token })
  if (!r) return new Response('Not found', { status: 404 })

  const [display, regular, bold, script, logoPng] = await Promise.all([
    asset('fonts/PlayfairDisplay-700.ttf'), asset('fonts/Montserrat-400.ttf'),
    asset('fonts/Montserrat-600.ttf'), asset('fonts/GreatVibes-400.ttf'), asset('logo.png'),
  ])
  const src = `data:image/png;base64,${logoPng.toString('base64')}`
  const [width, height, tree] = params.get('kind') === 'preview' ? preview(r, src) : fullReceipt(r, src)

  const svg = await satori(tree, {
    width, height,
    fonts: [
      { name: 'Playfair', data: display, weight: 700 },
      { name: 'Montserrat', data: regular, weight: 400 },
      { name: 'Montserrat', data: bold, weight: 600 },
      { name: 'Great Vibes', data: script, weight: 400 },
    ],
  })
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toBuffer()
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300', 'X-Robots-Tag': 'noindex' },
  })
}
