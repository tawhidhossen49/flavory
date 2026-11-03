import { rest } from '../lib/db.js'

const WITH_MENU = new Set(['home', 'menu', 'checkout'])
const WITH_REVIEWS = new Set(['home', 'reviews'])
const SLUGS = new Set(['home', 'our-story', 'delivery', 'contact', 'privacy', 'terms', 'refund'])
const ALL = new Set([...WITH_MENU, ...WITH_REVIEWS, ...SLUGS])

// Everything here is public, so the CDN can serve it. Admin edits appear within a minute.
export async function GET(request) {
  const page = new URL(request.url).searchParams.get('page')
  if (!ALL.has(page)) return new Response('Not found', { status: 404 })

  try {
    const [settings, pageRows, categories, items, reviews] = await Promise.all([
      rest('settings?select=key,value'),
      SLUGS.has(page) ? rest(`pages?select=content&slug=eq.${page}`) : null,
      WITH_MENU.has(page) ? rest('categories?select=id,name,sort_order&order=sort_order') : null,
      WITH_MENU.has(page) ? rest('menu_items?select=*,item_options(id,label,price,sort_order)&order=sort_order') : null,
      WITH_REVIEWS.has(page) ? rest('reviews?select=id,name,rating,body,created_at&order=created_at.desc&limit=50') : null,
    ])

    items?.forEach(i => i.item_options.sort((a, b) => a.sort_order - b.sort_order))
    return Response.json({
      settings: Object.fromEntries(settings.map(r => [r.key, r.value])),
      page: pageRows?.[0]?.content ?? null,
      categories, items, reviews,
      turnstile_key: process.env.TURNSTILE_SITE_KEY || null,
    }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  } catch (e) {
    console.error('content failed', e.message)
    return new Response('Unavailable', { status: 503 })
  }
}
