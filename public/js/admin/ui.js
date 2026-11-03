// Small building blocks for the admin. Text always goes in as text nodes, so nothing typed can become markup.
import { SUPABASE_KEY, SUPABASE_URL } from '../config.js'

export const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v)
    else if (k === 'class') el.className = v
    else if (k in el && k !== 'list') el[k] = v
    else el.setAttribute(k, v)
  }
  el.append(...kids.flat(Infinity).filter(k => k != null && k !== false))
  return el
}

const ICONS = {
  orders: 'M6 3h12a1 1 0 0 1 1 1v17l-3-2-2 2-2-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1zM9 8h6M9 12h6',
  food: 'M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M16 3c-2 2-3 5-3 8s1 3 3 3v7',
  tag: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM8 8h.01',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7M8 11h7',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.2-5.4-2.9-5.4 2.9 1-6.2-4.4-4.3 6.1-.9z',
  gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  chart: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
  history: 'M3 12a9 9 0 1 0 3-6.700L3 8M3 3v5h5M12 7v5l3 2',
  drag: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
}

export function icon(name, size = 32) {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  for (const [k, v] of Object.entries({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': name === 'drag' ? 2.8 : 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v)
  const p = document.createElementNS(ns, 'path')
  p.setAttribute('d', ICONS[name])
  svg.append(p)
  return svg
}

export function toast(text) {
  const t = h('div', { class: 'toast', role: 'status' }, text)
  document.body.append(t)
  setTimeout(() => t.remove(), 2200)
}

export const title = (text, ...rest) => h('div', { class: 'row between' }, h('h1', {}, text), ...rest)

export function modal(...content) {
  const m = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'stack' }, ...content))
  document.body.append(m)
  return m
}

export function confirmBox(message, yes = 'Yes') {
  return new Promise(resolve => {
    const done = v => { m.remove(); resolve(v) }
    const m = modal(
      h('h2', {}, 'Are you sure?'),
      h('p', {}, message),
      h('button', { class: 'btn block', onclick: () => done(true) }, yes),
      h('button', { class: 'btn ghost block', onclick: () => done(false) }, 'Cancel'),
    )
  })
}

const show = v => {
  if (v === true) return 'On'
  if (v === false) return 'Off'
  if (v === '' || v == null) return '(empty)'
  return typeof v === 'object' ? 'changed' : String(v)
}

// Walks a form schema and lists what differs between two values.
export function diffSchema(schema, before, after, prefix = '') {
  const out = []
  for (const f of schema) {
    const label = prefix + f.label
    const a = before?.[f.key], b = after?.[f.key]
    if (JSON.stringify(a) === JSON.stringify(b)) continue
    if (f.type === 'group') out.push(...diffSchema(f.fields, a, b, `${f.label}: `))
    else if (f.type === 'list' || f.type === 'photos') out.push({ label, from: 'old list', to: 'new list' })
    else out.push({ label, from: show(a), to: show(b) })
  }
  return out
}

// Sticky bar: shows nothing until something changed, then previews every change before saving.
export function saveBar(getChanges, save) {
  const count = h('span')
  const bar = h('div', { class: 'savebar', hidden: true }, h('div', {},
    count,
    h('button', { class: 'btn', onclick: review }, 'Review & save')))

  function refresh() {
    const n = getChanges().length
    bar.hidden = n === 0
    count.textContent = `${n} change${n === 1 ? '' : 's'}`
  }

  function review() {
    const list = getChanges()
    const m = modal(
      h('h2', {}, 'Check your changes'),
      h('div', {}, list.map(c => h('p', { class: 'change' }, `${c.label}: `, h('s', {}, c.from), ' → ', h('b', {}, c.to)))),
      h('button', {
        class: 'btn block',
        onclick: async e => {
          e.target.disabled = true
          e.target.textContent = 'Saving…'
          try {
            await save()
            m.remove()
            toast('Saved. It shows on the site within a minute.')
          } catch (err) {
            console.error(err)
            m.remove()
            toast(err.message || 'That did not save. Please try again.')
          }
          refresh()
        },
      }, 'Yes, save'),
      h('button', { class: 'btn ghost block', onclick: () => m.remove() }, 'Keep editing'),
    )
  }
  return { bar, refresh }
}

// Shrinks in the browser first, because Vercel refuses request bodies over 4.5 MB.
async function shrink(file) {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height))
  const canvas = Object.assign(document.createElement('canvas'), { width: bmp.width * scale, height: bmp.height * scale })
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise(ok => canvas.toBlob(ok, 'image/jpeg', 0.86))
}

export async function uploadPhoto(file) {
  const { data: { session } } = await db.auth.getSession()
  const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: await shrink(file) })
  const out = await res.json()
  if (!res.ok) throw new Error(out.error)
  return out.url
}

function photoField(value, onChange, multi) {
  const box = h('div', { class: 'upload' })
  const paint = () => {
    const urls = multi ? value : value ? [value] : []
    box.replaceChildren(
      ...urls.map(u => h('div', { class: 'stack tight' },
        h('img', { src: u, alt: 'Uploaded photo' }),
        h('button', {
          type: 'button', class: 'btn ghost',
          onclick: async () => {
            if (!await confirmBox('This removes the photo.', 'Yes, remove')) return
            value = multi ? value.filter(x => x !== u) : ''
            onChange(value)
            paint()
          },
        }, 'Remove'))),
      h('label', { class: 'btn ghost' }, 'Choose a photo', h('input', {
        type: 'file', accept: 'image/*', class: 'sr',
        onchange: async e => {
          const file = e.target.files[0]
          if (!file) return
          toast('Uploading…')
          try {
            const url = await uploadPhoto(file)
            value = multi ? [...value, url] : url
            onChange(value)
            paint()
          } catch (err) { toast(err.message || 'That photo did not upload.') }
        },
      })))
  }
  paint()
  return box
}

// Renders a form from a list of fields and keeps `value` up to date as people type.
export function schemaForm(schema, value, onChange) {
  return h('div', { class: 'stack loose' }, schema.map(f => {
    const set = v => { value[f.key] = v; onChange() }
    const id = `f-${f.key}-${Math.random().toString(36).slice(2, 7)}`
    const hint = f.hint ? h('span', { class: 'hint' }, f.hint) : null

    if (f.type === 'switch') return h('label', { class: 'switch' }, f.label, h('input', { type: 'checkbox', checked: Boolean(value[f.key]), onchange: e => set(e.target.checked) }))
    if (f.type === 'group') return h('div', { class: 'panel stack' }, h('h2', {}, f.label), schemaForm(f.fields, value[f.key], onChange))
    if (f.type === 'photo') return h('div', { class: 'field' }, h('label', {}, f.label), hint, photoField(value[f.key] ?? '', set, false))
    if (f.type === 'photos') return h('div', { class: 'field' }, h('label', {}, f.label), hint, photoField(value[f.key] ?? [], set, true))
    if (f.type === 'list') return listField(f, value, onChange)

    const common = {
      id, class: 'input', value: value[f.key] ?? '',
      oninput: e => set(f.type === 'number' ? Number(e.target.value) : e.target.value),
    }
    const input = f.type === 'textarea' ? h('textarea', { ...common, rows: f.rows ?? 4 })
      : f.options ? h('select', { ...common, onchange: common.oninput }, f.options.map(([v, label]) => h('option', { value: v, selected: v === value[f.key] }, label)))
        : h('input', { ...common, type: f.type ?? 'text', inputMode: f.type === 'number' ? 'numeric' : null })
    return h('div', { class: 'field' }, h('label', { htmlFor: id }, f.label), input, hint)
  }))
}

function listField(f, value, onChange) {
  const box = h('div', { class: 'stack' })
  const paint = () => box.replaceChildren(
    ...value[f.key].map((row, i) => h('div', { class: 'list-box' },
      schemaForm(f.fields, row, onChange),
      h('button', {
        type: 'button', class: 'btn danger',
        onclick: async () => {
          if (!await confirmBox('This removes it from the list.', 'Yes, remove')) return
          value[f.key].splice(i, 1)
          onChange()
          paint()
        },
      }, 'Remove'))),
    h('button', {
      type: 'button', class: 'btn ghost block',
      onclick: () => { value[f.key].push(Object.fromEntries(f.fields.map(x => [x.key, x.type === 'number' ? 0 : '']))); onChange(); paint() },
    }, `Add ${f.singular ?? 'one'}`))
  paint()
  return h('div', { class: 'field' }, h('label', {}, f.label), box)
}

// A form that saves one row of settings or pages, with the change preview.
export function jsonEditor(schema, initial, write) {
  let saved = structuredClone(initial)
  const value = structuredClone(initial)
  const { bar, refresh } = saveBar(() => diffSchema(schema, saved, value), async () => {
    await write(value)
    saved = structuredClone(value)
  })
  return h('div', {}, schemaForm(schema, value, refresh), bar)
}
