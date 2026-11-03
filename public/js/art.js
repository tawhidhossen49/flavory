// Gold line drawings that stand in for food photos until real ones are uploaded.
// Drawings, not photos, so they never pretend to be the actual portion.

const crumbs = pts => pts.map(([x, y, r = 1.3]) => `<circle cx="${x}" cy="${y}" r="${r}" class="crumb"/>`).join('')

const nugget = 'M-20 4 C-24 -10 -12 -20 2 -18 C16 -20 24 -8 20 4 C22 16 8 20 -4 18 C-14 18 -18 12 -20 4Z'
const strip = 'M-48 -6 C-30 -14 22 -16 44 -8 C52 -5 52 7 44 10 C20 18 -28 16 -46 10 C-54 7 -55 -3 -48 -6Z'

const DRAWINGS = {
  nuggets: `
    <g transform="translate(92 96) rotate(-12)"><path d="${nugget}" class="fill"/>${crumbs([[-8, -6], [6, 2], [-2, 9], [10, -9]])}</g>
    <g transform="translate(140 100) rotate(18) scale(1.08)"><path d="${nugget}" class="fill"/>${crumbs([[-6, -4], [8, 5], [0, 10], [12, -6]])}</g>
    <g transform="translate(116 74) rotate(4) scale(1.12)"><path d="${nugget}" class="fill"/>${crumbs([[-10, -2], [4, -8], [6, 8], [-4, 10]])}</g>`,
  strips: `
    <g transform="translate(118 74) rotate(-16)"><path d="${strip}" class="fill"/>${crumbs([[-30, 0], [-10, -6], [12, 2], [30, -2]])}</g>
    <g transform="translate(122 92) rotate(-4)"><path d="${strip}" class="fill"/>${crumbs([[-26, 2], [-4, -4], [18, 4], [34, 0]])}</g>
    <g transform="translate(116 108) rotate(9)"><path d="${strip}" class="fill"/>${crumbs([[-32, -2], [-8, 4], [14, -4], [32, 3]])}</g>`,
  burger: `
    <path d="M70 110 h100 a7 7 0 0 1 -7 12 h-86 a7 7 0 0 1 -7 -12Z" class="fill"/>
    <rect x="66" y="94" width="108" height="15" rx="7.5" class="fill"/>
    <path d="M62 94 q7 -7 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0" class="line"/>
    <path d="M66 88 C66 46 174 46 174 88 Z" class="fill"/>
    ${[[96, 66, -20], [116, 60, 10], [138, 64, -8], [154, 74, 22], [84, 78, 30], [126, 74, -24]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="1.6" transform="rotate(${r} ${x} ${y})" class="seed"/>`).join('')}`,
  cloche: `
    <path d="M66 108 C66 62 174 62 174 108 Z" class="fill"/>
    <circle cx="120" cy="57" r="6" class="fill"/>
    <path d="M56 110 h128" class="line"/>
    <path d="M90 84 C96 74 108 70 118 70" class="line soft"/>`,
}

export function kindOf(name) {
  const n = name.toLowerCase()
  if (n.includes('burger')) return 'burger'
  if (n.includes('strip') || n.includes('tender') || n.includes('wing')) return 'strips'
  if (n.includes('nugget') || n.includes('pop')) return 'nuggets'
  return 'cloche'
}

export function artSvg(name) {
  return `<svg class="art" viewBox="0 0 240 160" role="img" aria-label="Drawing of ${name.replace(/[<>&"]/g, '')}">
    <ellipse cx="120" cy="120" rx="96" ry="22" class="plate"/>
    <ellipse cx="120" cy="120" rx="72" ry="15" class="plate inner"/>
    <g class="food">${DRAWINGS[kindOf(name)]}</g>
    <g class="steam"><path d="M98 46 c-7 -8 7 -14 0 -24"/><path d="M120 40 c-7 -8 7 -14 0 -24"/><path d="M142 46 c-7 -8 7 -14 0 -24"/></g>
  </svg>`
}

// shortcut: stand-in photos chosen by item name until the owner uploads real ones in admin; any uploaded photo wins.
const DEMO = { nuggets: 'nuggets', strips: 'strips', burger: 'burger' }
export function demoPhoto(name) {
  const k = DEMO[kindOf(name)]
  if (!k) return null
  const file = k === 'burger' && /spicy/i.test(name) ? 'spicy-burger' : k
  return { photo: `/demo/${file}.webp`, cut: `/demo/${file}-cut.webp` }
}

// The picture to use for an item: its own photo first, then a stand-in.
export const photoOf = item => item.photos?.[0] ?? demoPhoto(item.name)?.photo ?? null
// A transparent cut-out if one exists (file name contains "-cut"), for the floating carousel.
export const cutoutOf = item => item.photos?.find(u => /-cut\./.test(u)) ?? (item.photos?.[0] ? null : demoPhoto(item.name)?.cut ?? null)
// The item shown in its parcel box, as a transparent sticker. An uploaded photo whose file name contains "-box"
// wins; otherwise a stand-in box, then a cut-out, then the plain photo.
// shortcut: admin has no dedicated "box photo" field yet; add one when the owner starts uploading box shots.
const DEMO_BOX = { nuggets: 'box-nuggets', strips: 'box-strips', burger: 'box-burger' }
export function boxOf(item) {
  const own = item.photos?.find(u => /-box\./.test(u))
  if (own) return own
  const k = DEMO_BOX[kindOf(item.name)]
  if (k && !item.photos?.length) return `/demo/${k === 'box-burger' && /spicy/i.test(item.name) ? 'box-spicy-burger' : k}.webp`
  return cutoutOf(item) ?? photoOf(item)
}
