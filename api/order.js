import { allowed, clientIp, humanCheck, readJson, rest, secretRpc, siteUrl } from '../lib/db.js'
import { orderMessage, whatsappNumber, whatsappUrl } from '../lib/whatsapp.js'

export async function POST(request) {
  const ip = clientIp(request)
  const input = await readJson(request)
  if (!input) return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })

  const { turnstile, ...order } = input
  if (!(await humanCheck(turnstile, ip))) return Response.json({ error: 'Please complete the check below and try again.' })
  if (!(await allowed(`order:${ip}`, 6, 600))) return Response.json({ error: 'Too many orders from this connection. Please call us instead.' })

  // Prices, totals, area, phone and text limits are all checked inside place_order.
  const { data, error } = await secretRpc('place_order', { p: order })
  if (error) return Response.json({ error: 'Something went wrong and your order was not placed. Please try again or call us.' })
  if (data.error) return Response.json(data)

  const [business] = await rest('settings?select=value&key=eq.business')
  const number = whatsappNumber(business.value.whatsapp)
  return Response.json({
    token: data.token,
    whatsapp: number ? whatsappUrl(number, orderMessage(data, `${siteUrl(request)}/r/${data.token}`)) : null,
  })
}
