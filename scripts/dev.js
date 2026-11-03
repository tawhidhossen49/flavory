// Local stand-in for Vercel: serves public/, applies vercel.json's rewrites and headers, runs api/*.js.
import { readFile, stat } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'

const root = path.resolve('public')
const vercel = JSON.parse(await readFile('vercel.json', 'utf8'))
const csp = vercel.headers[0].headers[0].value.replace('; upgrade-insecure-requests', '')
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }

function rewrite(url) {
  const m = url.pathname.match(/^\/r\/([^/]+)(?:\/(image|preview))?$/)
  if (m) return m[2] ? `/api/receipt-image?token=${m[1]}&kind=${m[2]}` : `/api/receipt?token=${m[1]}`
  if (url.pathname === '/sitemap.xml') return '/api/seo?file=sitemap'
  if (url.pathname === '/robots.txt') return '/api/seo?file=robots'
  return url.pathname + url.search
}

async function serveApi(req, res, target) {
  const url = new URL(target, `http://${req.headers.host}`)
  const mod = await import(`file://${path.resolve('.' + url.pathname + '.js').replaceAll('\\', '/')}`)
  const handler = mod[req.method]
  if (!handler) { res.writeHead(405).end(); return }
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await new Promise(ok => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => ok(Buffer.concat(chunks)))
  })
  const out = await handler(new Request(url, { method: req.method, headers: req.headers, body }))
  res.writeHead(out.status, { ...Object.fromEntries(out.headers), 'Content-Security-Policy': csp })
  res.end(Buffer.from(await out.arrayBuffer()))
}

async function serveFile(res, pathname) {
  const clean = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  for (const c of [clean, `${clean}.html`, path.join(clean, 'index.html')]) {
    const file = path.join(root, c)
    if (!file.startsWith(root)) break
    if ((await stat(file).catch(() => null))?.isFile()) {
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Content-Security-Policy': csp })
      res.end(await readFile(file))
      return
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/html' })
  res.end(await readFile(path.join(root, '404.html')).catch(() => 'Not found'))
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const target = rewrite(url)
    if (target.startsWith('/api/')) await serveApi(req, res, target)
    else await serveFile(res, url.pathname)
  } catch (e) {
    console.error(req.url, e)
    if (!res.headersSent) res.writeHead(500)
    res.end('Server error')
  }
}).listen(process.env.PORT ?? 3000, () => console.log(`http://localhost:${process.env.PORT ?? 3000}`))
