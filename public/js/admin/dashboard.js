import { dhakaToday, orderNo, tk } from '../format.js'
import { db, h, title, toast } from './ui.js'

const DAY = 86400000
const RANGES = [['today', 'Today'], ['week', 'This week'], ['month', 'This month']]

// Start of the range at Dhaka midnight (UTC+6, no daylight saving).
function rangeStart(range) {
  const today = new Date(`${dhakaToday()}T00:00:00+06:00`)
  if (range === 'today') return today
  if (range === 'week') return new Date(today.getTime() - 6 * DAY)
  return new Date(`${dhakaToday().slice(0, 7)}-01T00:00:00+06:00`)
}

const tile = (value, label, sub) => h('div', { class: 'tile' }, h('strong', {}, value), label, sub ? h('p', { class: 'muted' }, sub) : null)

function bars(heading, rows) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return h('section', { class: 'panel stack' }, h('h2', {}, heading),
    rows.length
      ? h('div', { class: 'bars' }, rows.map(r => {
        const bar = h('i', { title: `${r.label}: ${r.value}` })
        bar.style.width = `${(r.value / max) * 100}%`
        return h('div', {}, h('span', {}, r.label), h('span', {}, bar), h('span', {}, String(r.value)))
      }))
      : h('p', { class: 'muted' }, 'Nothing yet.'))
}

// A leading = + - @ would run as a formula in a spreadsheet, and names come from customers.
export const csvCell = v => {
  const s = String(v ?? '')
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

async function exportCsv(from) {
  const { data, error } = await db.from('orders')
    .select('order_no, created_at, status, name, phone, area, address, payment, subtotal, discount, delivery_fee, total, cost_total, coupon_code, order_items(name, option_label, qty)')
    .gte('created_at', from.toISOString()).order('created_at')
  if (error) return toast('The export did not work.')
  const head = ['Order', 'Date', 'Status', 'Name', 'Phone', 'Area', 'Address', 'Payment', 'Subtotal', 'Discount', 'Delivery', 'Total', 'Cost', 'Coupon', 'Items']
  const lines = data.map(o => [
    orderNo(o.order_no), o.created_at, o.status, o.name, o.phone, o.area, o.address, o.payment, o.subtotal, o.discount,
    o.delivery_fee, o.total, o.cost_total, o.coupon_code,
    o.order_items.map(i => `${i.qty} x ${i.name} ${i.option_label}`.trim()).join('; '),
  ].map(csvCell).join(','))
  const url = URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' }))
  h('a', { href: url, download: `flavory-orders-${dhakaToday()}.csv` }).click()
  URL.revokeObjectURL(url)
}

export async function render(root) {
  const body = h('div', { class: 'stack mt16' })
  const seg = h('div', { class: 'seg mt16' })
  let range = 'today'

  async function show() {
    seg.replaceChildren(...RANGES.map(([k, label]) => h('button', { 'aria-current': String(k === range), onclick: () => { range = k; show() } }, label)))
    const from = rangeStart(range)
    const { data: s, error } = await db.rpc('dashboard_stats', { p_from: from.toISOString(), p_to: new Date(Date.now() + DAY).toISOString() })
    if (error) { body.replaceChildren(h('p', { class: 'notice err' }, 'The numbers did not load.')); return }

    const days = Math.max(1, Math.ceil((Date.now() - from) / DAY))
    const pct = v => v == null ? '—' : `${v}%`
    body.replaceChildren(
      h('div', { class: 'tiles' },
        tile(String(s.orders), 'Orders', range === 'today' ? null : `${(s.orders / days).toFixed(1)} per day`),
        tile(tk(s.sales), 'Total sales'),
        tile(tk(s.avg_order), 'Average order'),
        tile(pct(s.cost_pct), 'Food + packaging cost', s.cost_missing ? 'Add cost prices in Menu to fill this in.' : null),
        tile(tk(s.profit_per_order), 'Kept per order'),
        tile(pct(s.repeat_pct), 'Repeat customers'),
        tile(s.avg_delivery_min == null ? '—' : `${s.avg_delivery_min} min`, 'Average delivery time'),
        tile(s.complaints_per_100 == null ? '—' : String(s.complaints_per_100), 'Complaints per 100 orders')),
      bars('Orders per day', s.by_day.map(d => ({ label: d.day.slice(5), value: d.orders }))),
      bars('Top items', s.top_items.map(t => ({ label: t.name, value: t.qty }))),
      bars('Orders by area', s.by_area.map(a => ({ label: a.area, value: a.orders }))),
      h('button', { class: 'btn ghost block', onclick: () => exportCsv(from) }, 'Download orders (CSV)'))
  }

  root.append(title('Business Numbers'), seg, body)
  await show()
}
