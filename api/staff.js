import { caller, readJson } from '../lib/db.js'

const admin = (path, init = {}) => fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/${path}`, {
  ...init,
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
})

// Creating logins needs the service key. It stays on the server and is used for nothing else.
export async function POST(request) {
  const who = await caller(request)
  if (who?.role !== 'owner') return Response.json({ error: 'Not allowed' }, { status: 403 })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Staff logins are not set up yet: the SUPABASE_SERVICE_ROLE_KEY setting is missing in Vercel.' }, { status: 501 })
  }

  const input = await readJson(request, 2000)
  if (input?.action === 'list') {
    const res = await admin('users?per_page=100')
    if (!res.ok) return Response.json({ error: 'Could not load accounts.' }, { status: 502 })
    const { users } = await res.json()
    return Response.json({ users: users.map(u => ({ id: u.id, email: u.email })) })
  }

  if (input?.action === 'create') {
    const email = String(input.email ?? '').trim().toLowerCase()
    const password = String(input.password ?? '')
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: 'Please enter an email address.' })
    if (password.length < 12) return Response.json({ error: 'Passwords need at least 12 characters.' })
    const role = input.role === 'owner' ? 'owner' : 'staff'
    const res = await admin('users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) })
    if (!res.ok) return Response.json({ error: 'Could not create that account. It may already exist.' })
    const user = await res.json()
    // Written with the owner's own token, so RLS and role rules still apply.
    const add = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, role, name: email.split('@')[0] }),
    })
    if (!add.ok) return Response.json({ error: 'The account was created but has no access yet.' })
    return Response.json({ ok: true })
  }

  if (input?.action === 'remove') {
    if (input.id === who.id) return Response.json({ error: 'You cannot remove your own account.' })
    const res = await admin(`users/${encodeURIComponent(String(input.id))}`, { method: 'DELETE' })
    return Response.json(res.ok ? { ok: true } : { error: 'Could not remove that account.' })
  }

  return Response.json({ error: 'Bad request' }, { status: 400 })
}
