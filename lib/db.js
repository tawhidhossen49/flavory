// Server-side Supabase access over plain fetch. The anon key plus RLS and the
// secret-guarded functions are all the server needs for customer traffic.
const url = () => process.env.SUPABASE_URL
const anon = () => process.env.SUPABASE_ANON_KEY

const headers = token => ({
  apikey: anon(),
  Authorization: `Bearer ${token ?? anon()}`,
  'Content-Type': 'application/json',
})

export async function rest(path, token) {
  const res = await fetch(`${url()}/rest/v1/${path}`, { headers: headers(token) })
  if (!res.ok) throw new Error(`rest ${res.status}`)
  return res.json()
}

export async function rpc(name, args, token) {
  const res = await fetch(`${url()}/rest/v1/rpc/${name}`, { method: 'POST', headers: headers(token), body: JSON.stringify(args) })
  const body = await res.text()
  if (!res.ok) { console.error('rpc failed', name, res.status); return { error: true } }
  return { data: body ? JSON.parse(body) : null }
}

export const secretRpc = (name, args) => rpc(name, { p_secret: process.env.SERVER_SECRET, ...args })

export const clientIp = request => request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'

export async function allowed(key, max, seconds) {
  const { data, error } = await secretRpc('hit_rate_limit', { p_key: key, p_max: max, p_seconds: seconds })
  return !error && data === true
}

export async function humanCheck(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // bot check switches on once the Turnstile keys are set
  if (!token) return false
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  })
  return (await res.json()).success === true
}

export async function readJson(request, maxBytes = 20000) {
  const text = await request.text()
  if (text.length > maxBytes) return null
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' ? v : null
  } catch { return null }
}

export const siteUrl = request => process.env.SITE_URL || `https://${request.headers.get('host')}`

// Returns the caller's user id and role from their login token.
export async function caller(request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  const res = await fetch(`${url()}/auth/v1/user`, { headers: headers(token) })
  if (!res.ok) return null
  const user = await res.json()
  const [profile] = await rest(`profiles?select=role&user_id=eq.${user.id}`, token)
  return profile ? { id: user.id, role: profile.role, token } : null
}
