import { allowed, clientIp, readJson, secretRpc } from '../lib/db.js'

export async function POST(request) {
  const input = await readJson(request)
  if (!input) return Response.json({ error: 'Bad request' }, { status: 400 })
  if (!(await allowed(`quote:${clientIp(request)}`, 90, 60))) return Response.json({ error: 'Too many requests' }, { status: 429 })

  const { data, error } = await secretRpc('get_quote', { p: input })
  return error ? Response.json({ error: 'Unavailable' }, { status: 503 }) : Response.json(data)
}
