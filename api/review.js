import { allowed, clientIp, readJson, secretRpc } from '../lib/db.js'

export async function POST(request) {
  const input = await readJson(request)
  if (!input) return Response.json({ error: 'Please try again.' }, { status: 400 })
  if (!(await allowed(`review:${clientIp(request)}`, 5, 3600))) return Response.json({ error: 'Please try again later.' })

  const { data, error } = await secretRpc('submit_review', { p_token: String(input.token), p_rating: Number(input.rating), p_body: String(input.body) })
  return Response.json({ error: error ? 'Sorry, that did not work. Please try again.' : data })
}
