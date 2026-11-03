import { allowed, clientIp, humanCheck, readJson } from '../lib/db.js'

const WRONG = 'That email or password is not right.'

export async function POST(request) {
  const ip = clientIp(request)
  const input = await readJson(request, 2000)
  const email = String(input?.email ?? '').trim().toLowerCase()
  const password = String(input?.password ?? '')
  if (!email || !password) return Response.json({ error: WRONG })

  if (!(await humanCheck(input.turnstile, ip))) return Response.json({ error: 'Please complete the check and try again.' })
  const ok = await Promise.all([allowed(`login:${ip}`, 10, 900), allowed(`login:${email}`, 10, 900)])
  if (ok.includes(false)) return Response.json({ error: 'Too many tries. Please wait 15 minutes.' })

  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return Response.json({ error: WRONG })
  const { access_token, refresh_token } = await res.json()
  return Response.json({ access_token, refresh_token }, { headers: { 'Cache-Control': 'no-store' } })
}
