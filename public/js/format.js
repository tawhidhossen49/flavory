// Pure helpers, shared by the browser and the server functions. No DOM in here.

export const tk = n => `Tk ${Number(n).toLocaleString('en-US')}`
export const orderNo = n => `FLV-${n}`
export const PAYMENT_LABEL = { cod: 'Cash on delivery', bkash: 'bKash' }

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const inDhaka = opts => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour12: true, ...opts })

export const dateTime = iso =>
  inDhaka({ day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))

const dayKey = d => inDhaka({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

export function slotLabel(iso, now = new Date()) {
  const d = new Date(iso)
  const time = inDhaka({ hour: 'numeric', minute: '2-digit' }).format(d)
  return `${dayKey(d) === dayKey(now) ? 'Today' : 'Tomorrow'} ${time}`
}

export function clock(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

export const dhakaToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(now)

// Bangladeshi mobile: 01XXXXXXXXX, optionally with +88. Mirrors private.normalize_phone in the database.
export function normalizePhone(p) {
  const c = String(p).replace(/[\s+()-]/g, '')
  return /^(88)?01[3-9]\d{8}$/.test(c) ? c.slice(-11) : null
}
