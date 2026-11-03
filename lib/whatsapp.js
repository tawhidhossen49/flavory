import { PAYMENT_LABEL, orderNo, slotLabel, tk } from '../public/js/format.js'

// WhatsApp and browsers get unreliable past roughly 2,000 characters of link text.
const MAX_ITEM_LINES = 25

export function whatsappNumber(raw) {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return null
  return d.startsWith('0') ? `88${d}` : d
}

export function orderMessage(o, receiptUrl) {
  const shown = o.lines.slice(0, MAX_ITEM_LINES)
  const items = shown.map(l => `• ${l.name}${l.label ? ` (${l.label})` : ''} × ${l.qty} = ${tk(l.line)}`)
  if (o.lines.length > shown.length) items.push(`• …and ${o.lines.length - shown.length} more on the receipt`)

  return [
    `Hi Flavory! I'd like to confirm my order 🍗`,
    '',
    `Order: ${orderNo(o.order_no)}`,
    ...items,
    '',
    `Subtotal: ${tk(o.subtotal)}`,
    ...(o.discount ? [`Discount: -${tk(o.discount)}`] : []),
    `Delivery: ${o.delivery_fee ? tk(o.delivery_fee) : o.area === 'Pickup' ? 'Pickup' : 'Free'}`,
    `Total: ${tk(o.total)}`,
    `Payment: ${PAYMENT_LABEL[o.payment]}`,
    '',
    `Name: ${o.name}`,
    `Phone: ${o.phone}`,
    `Area: ${[o.area, o.address].filter(Boolean).join(', ')}`,
    `Delivery: ${o.scheduled_for ? slotLabel(o.scheduled_for) : 'ASAP'}`,
    ...(o.note ? [`Note: ${o.note}`] : []),
    '',
    `Receipt: ${receiptUrl}`,
  ].join('\n')
}

export const whatsappUrl = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`
