import { dateTime, orderNo, PAYMENT_LABEL, slotLabel, tk } from '../format.js'
import { confirmBox, db, h, modal, title, toast } from './ui.js'

const FLOW = [['new', 'New'], ['confirmed', 'Confirmed'], ['cooking', 'Cooking'], ['out_for_delivery', 'Out for delivery'], ['delivered', 'Delivered']]
const COMPLAINTS = [['late', 'Late'], ['soggy', 'Soggy'], ['wrong_item', 'Wrong item'], ['other', 'Other']]
const POLL_MS = 8000

let known = null
let audio = null
let timer = null

function ding() {
  if (!audio) return
  for (const [i, freq] of [880, 1175].entries()) {
    const o = audio.createOscillator(), g = audio.createGain()
    o.frequency.value = freq
    g.gain.setValueAtTime(0.25, audio.currentTime + i * 0.18)
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + i * 0.18 + 0.3)
    o.connect(g).connect(audio.destination)
    o.start(audio.currentTime + i * 0.18)
    o.stop(audio.currentTime + i * 0.18 + 0.32)
  }
}

async function load() {
  const start = new Date(Date.now() - 18 * 3600 * 1000).toISOString()
  const { data, error } = await db.from('orders').select('*, order_items(*), complaints(*)')
    .or(`created_at.gte.${start},status.in.(new,confirmed,cooking,out_for_delivery)`)
    .order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return data
}

function complaintBox(order, refresh) {
  let kind = 'soggy'
  const note = h('textarea', { class: 'input', rows: 2, maxLength: 500, 'aria-label': 'What happened?' })
  const m = modal(
    h('h2', {}, `Complaint on ${orderNo(order.order_no)}`),
    h('div', { class: 'opts' }, COMPLAINTS.map(([v, label]) => h('label', { class: 'opt' },
      h('input', { type: 'radio', name: 'kind', value: v, checked: v === kind, onchange: () => { kind = v } }), h('span', {}, label)))),
    note,
    h('button', {
      class: 'btn block',
      onclick: async () => {
        const { error } = await db.from('complaints').insert({ order_id: order.id, kind, note: note.value })
        m.remove()
        toast(error ? 'That did not save.' : 'Complaint saved.')
        refresh()
      },
    }, 'Save complaint'),
    h('button', { class: 'btn ghost block', onclick: () => m.remove() }, 'Cancel'))
}

function card(o, refresh) {
  const setStatus = async status => {
    if (status === 'cancelled' && !await confirmBox(`Cancel order ${orderNo(o.order_no)}?`, 'Yes, cancel it')) return
    const { error } = await db.rpc('set_order_status', { p_id: o.id, p_status: status })
    if (error) toast('That did not save. Please try again.')
    refresh()
  }
  return h('article', { class: `order${o.status === 'new' ? ' new' : ''}` },
    h('div', { class: 'row between' }, h('h2', {}, orderNo(o.order_no)), h('span', { class: 'pill' }, FLOW.find(f => f[0] === o.status)?.[1] ?? 'Cancelled')),
    h('p', { class: 'muted' }, `${dateTime(o.created_at)} · ${o.scheduled_for ? slotLabel(o.scheduled_for) : 'ASAP'}`),
    h('div', {}, o.order_items.map(i => h('div', { class: 't-row' },
      h('span', {}, `${i.qty} × ${i.name}${i.option_label ? ` (${i.option_label})` : ''}`), h('span', {}, tk(i.unit_price * i.qty))))),
    h('p', {}, h('strong', {}, `${tk(o.total)} · ${PAYMENT_LABEL[o.payment]}`)),
    h('p', {}, `${o.name} · ${o.area}${o.address ? `, ${o.address}` : ''}`),
    o.note ? h('p', { class: 'notice' }, o.note) : null,
    o.complaints.map(c => h('p', { class: 'notice err' }, `Complaint: ${COMPLAINTS.find(x => x[0] === c.kind)?.[1]}${c.note ? ` — ${c.note}` : ''}`)),
    h('div', { class: 'order-acts' }, FLOW.slice(1).map(([s, label]) =>
      h('button', { class: `status-btn${o.status === s ? ' on' : ''}`, onclick: () => setStatus(s) }, label))),
    h('div', { class: 'order-acts' },
      o.phone ? h('a', { class: 'status-btn', href: `tel:${o.phone}` }, `Call ${o.phone}`) : null,
      h('button', { class: 'status-btn', onclick: () => complaintBox(o, refresh) }, 'Complaint'),
      o.status === 'cancelled' ? null : h('button', { class: 'status-btn danger', onclick: () => setStatus('cancelled') }, 'Cancel')))
}

export async function render(root) {
  clearInterval(timer)
  known = null
  const list = h('div', { class: 'stack mt16' })
  const sound = h('button', {
    class: 'btn ghost',
    onclick: e => {
      audio = new AudioContext()
      ding()
      e.target.textContent = 'Sound is on'
      e.target.disabled = true
    },
  }, audio ? 'Sound is on' : 'Turn on sound')
  root.append(title("Today's Orders", sound), list)

  async function refresh() {
    if (!list.isConnected) { clearInterval(timer); return }
    let orders
    try { orders = await load() } catch { return } // kitchen wifi blips: the next poll retries
    const ids = new Set(orders.map(o => o.id))
    if (known && orders.some(o => !known.has(o.id))) ding()
    known = ids
    const scroll = window.scrollY
    if (document.querySelector('.modal')) return
    list.replaceChildren(...(orders.length ? orders.map(o => card(o, refresh)) : [h('p', { class: 'muted' }, 'No orders yet today.')]))
    window.scrollTo(0, scroll)
  }
  await refresh()
  timer = setInterval(refresh, POLL_MS)
}
