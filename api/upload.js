import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { caller } from '../lib/db.js'

const MAX_BYTES = 4 * 1024 * 1024 // Vercel caps request bodies at 4.5 MB; the browser shrinks photos first
const ALLOWED = new Set(['jpeg', 'png', 'webp', 'heif'])

async function store(bytes, name, token) {
  const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/media/${name}`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/webp',
      'Cache-Control': 'max-age=31536000',
    },
    body: bytes,
  })
  if (!res.ok) throw new Error(`storage ${res.status}`)
}

export async function POST(request) {
  const who = await caller(request)
  if (who?.role !== 'owner') return Response.json({ error: 'Not allowed' }, { status: 403 })

  const input = Buffer.from(await request.arrayBuffer())
  if (!input.length || input.length > MAX_BYTES) return Response.json({ error: 'That photo is too large.' }, { status: 413 })

  try {
    const meta = await sharp(input, { limitInputPixels: 50_000_000 }).metadata()
    if (!ALLOWED.has(meta.format)) return Response.json({ error: 'Please choose a photo.' }, { status: 415 })

    // Re-encoding drops metadata and anything hidden in the original file. The name is ours, never the client's.
    const base = sharp(input, { limitInputPixels: 50_000_000 }).rotate()
    const [large, small] = await Promise.all([
      base.clone().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
      base.clone().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer(),
    ])
    const id = randomUUID()
    await Promise.all([store(large, `${id}.webp`, who.token), store(small, `${id}-480.webp`, who.token)])
    return Response.json({ url: `${process.env.SUPABASE_URL}/storage/v1/object/public/media/${id}.webp` })
  } catch (e) {
    console.error('upload failed', e.message)
    return Response.json({ error: 'That photo could not be used. Please try another.' }, { status: 422 })
  }
}
