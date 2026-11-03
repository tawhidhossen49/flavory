const KEY = 'flavory-cart'
const listeners = new Set()
let lines = null

function read() {
  if (lines) return lines
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    lines = Array.isArray(stored) ? stored : []
  } catch { lines = [] }
  return lines
}

function write(next) {
  lines = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode: cart lives until reload */ }
  listeners.forEach(l => l(next))
}

export const cart = {
  lines: read,
  count: () => read().reduce((n, x) => n + x.qty, 0),
  total: () => read().reduce((n, x) => n + x.qty * x.price, 0),
  items: () => read().map(({ option_id, qty }) => ({ option_id, qty })),
  add(line, qty = 1) {
    const cur = read()
    const hit = cur.find(l => l.option_id === line.option_id)
    write(hit ? cur.map(l => l === hit ? { ...l, qty: Math.min(l.qty + qty, 50) } : l) : [...cur, { ...line, qty }])
  },
  setQty(option_id, qty) {
    write(qty < 1 ? read().filter(l => l.option_id !== option_id)
      : read().map(l => l.option_id === option_id ? { ...l, qty: Math.min(qty, 50) } : l))
  },
  clear: () => write([]),
  // Server prices win over whatever was stored when the item was added.
  sync(fresh) {
    const byId = new Map(fresh.map(f => [f.option_id, f]))
    const next = read().map(l => {
      const f = byId.get(l.option_id)
      return f ? { ...l, price: f.price, name: f.name, label: f.label, photo: f.photo } : l
    })
    if (JSON.stringify(next) !== JSON.stringify(read())) write(next)
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
}

window.addEventListener('storage', e => {
  if (e.key === KEY) { lines = null; listeners.forEach(l => l(read())) }
})
