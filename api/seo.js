import { siteUrl } from '../lib/db.js'

const PATHS = ['', '/menu', '/our-story', '/reviews', '/delivery-faq', '/contact', '/privacy', '/terms', '/refund']

export function GET(request) {
  const site = siteUrl(request)
  if (new URL(request.url).searchParams.get('file') === 'robots') {
    return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /cart\nDisallow: /r/\nDisallow: /api/\nSitemap: ${site}/sitemap.xml\n`,
      { headers: { 'Content-Type': 'text/plain' } })
  }
  const urls = PATHS.map(p => `<url><loc>${site}${p}</loc></url>`).join('')
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } })
}
