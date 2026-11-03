import { db, h, icon } from './ui.js'

const IDLE_LIMIT_MS = 12 * 60 * 60 * 1000
const top = document.getElementById('top')
const view = document.getElementById('view')

const BUTTONS = [
  ['orders', "Today's Orders", 'orders', 'staff'],
  ['menu', 'Menu', 'food', 'owner'],
  ['offers', 'Prices & Offers', 'tag', 'owner'],
  ['pages', 'Our Story & Pages', 'book', 'owner'],
  ['reviews', 'Reviews', 'star', 'owner'],
  ['settings', 'Settings', 'gear', 'owner'],
  ['dashboard', 'Business Numbers', 'chart', 'owner'],
  ['history', 'Undo a Change', 'history', 'owner'],
]

export let role = null

function loginScreen(message) {
  top.replaceChildren()
  const error = h('p', { class: 'notice err', hidden: !message }, message ?? '')
  const email = h('input', { class: 'input', id: 'email', type: 'email', required: true, autocomplete: 'username' })
  const password = h('input', { class: 'input', id: 'password', type: 'password', required: true, autocomplete: 'current-password' })
  const turnstile = h('div')
  view.replaceChildren(h('form', {
    class: 'login stack',
    onsubmit: async e => {
      e.preventDefault()
      error.hidden = true
      const res = await (await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.value, password: password.value, turnstile: e.target.elements['cf-turnstile-response']?.value }),
      })).json()
      if (res.error) { error.textContent = res.error; error.hidden = false; return }
      await db.auth.setSession(res)
      route()
    },
  },
    h('img', { src: '/brand/logo.webp', alt: 'Flavory', width: 96, height: 96 }),
    h('h1', { class: 'center' }, 'Kitchen login'),
    h('div', { class: 'field' }, h('label', { htmlFor: 'email' }, 'Email'), email),
    h('div', { class: 'field' }, h('label', { htmlFor: 'password' }, 'Password'), password),
    turnstile, error,
    h('button', { class: 'btn block' }, 'Log in')))

  fetch('/api/content?page=contact').then(r => r.json()).then(({ turnstile_key: key }) => {
    if (!key) return
    turnstile.className = 'cf-turnstile'
    turnstile.dataset.sitekey = key
    document.head.append(h('script', { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js', defer: true }))
  })
}

function homeScreen() {
  view.replaceChildren(h('div', { class: 'admin-main' },
    h('h1', {}, 'Hello!'),
    h('div', { class: 'home-btns' }, BUTTONS
      .filter(([, , , need]) => role === 'owner' || need === 'staff')
      .map(([hash, label, ic]) => h('a', { class: 'home-btn', href: `#${hash}` }, icon(ic), label)))))
}

async function signOut() {
  await db.auth.signOut()
  localStorage.removeItem('fl_seen')
  route()
}

const SCREENS = {
  orders: () => import('./orders.js'), menu: () => import('./menu.js'), item: () => import('./menu.js'),
  offers: () => import('./offers.js'), pages: () => import('./pages.js'), reviews: () => import('./reviews.js'),
  settings: () => import('./settings.js'), dashboard: () => import('./dashboard.js'), history: () => import('./history.js'),
}

export async function route() {
  const { data: { session } } = await db.auth.getSession()
  if (!session) return loginScreen()

  const seen = Number(localStorage.getItem('fl_seen') ?? 0)
  if (seen && Date.now() - seen > IDLE_LIMIT_MS) { await db.auth.signOut(); localStorage.removeItem('fl_seen'); return loginScreen('You were logged out after a long break.') }
  localStorage.setItem('fl_seen', String(Date.now()))

  const { data: profile } = await db.from('profiles').select('role').eq('user_id', session.user.id).maybeSingle()
  role = profile?.role ?? null
  if (!role) { await db.auth.signOut(); return loginScreen('This account has no access.') }

  top.replaceChildren(h('header', { class: 'admin-top' },
    h('a', { href: '#' }, h('img', { src: '/brand/logo.webp', alt: '', width: 40, height: 40 }), 'Flavory Admin'),
    h('button', { onclick: signOut }, 'Log out')))

  const [name, arg] = location.hash.slice(1).split('/')
  const allowed = role === 'owner' || name === 'orders'
  if (!name || !SCREENS[name] || !allowed) {
    if (role === 'staff') { location.hash = 'orders'; return }
    return homeScreen()
  }
  const mod = await SCREENS[name]()
  const main = h('div', { class: 'admin-main' })
  view.replaceChildren(main)
  await (name === 'item' ? mod.renderItem(main, arg) : mod.render(main))
}

window.addEventListener('hashchange', route)
route()
