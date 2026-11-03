import { db, h, jsonEditor, title } from './ui.js'

const SECTIONS = [{
  key: 'sections', label: 'Sections', type: 'list', singular: 'a section',
  fields: [{ key: 'h', label: 'Heading' }, { key: 'b', label: 'Text', type: 'textarea' }],
}]
const titled = [{ key: 'title', label: 'Page title' }]

const PAGES = [
  ['home', 'Home page', [
    { key: 'hero_title', label: 'Big headline', hint: 'Two short sentences work best. The second turns gold.' },
    { key: 'hero_sub', label: 'Line under the headline', type: 'textarea', rows: 2 },
    { key: 'hero_image', label: 'Big photo at the top', type: 'photo', hint: 'Optional. A real food photo replaces the chef portrait.' },
    { key: 'promise', label: 'One-line promise' },
    { key: 'steps', label: 'How it works', type: 'list', singular: 'a step', fields: [{ key: 'title', label: 'Step name' }, { key: 'text', label: 'Text', type: 'textarea', rows: 2 }] },
    { key: 'story_title', label: 'Our Story heading' },
    { key: 'story_text', label: 'Our Story text', type: 'textarea' },
  ]],
  ['our-story', 'Our Story', [
    ...titled,
    { key: 'intro', label: 'Line under the title' },
    { key: 'body', label: 'The story', type: 'textarea', rows: 10, hint: 'Leave an empty line between paragraphs.' },
    { key: 'sign_off', label: 'Signature' },
    { key: 'poster', label: 'Chef poster', type: 'photo' },
    { key: 'photos', label: 'Kitchen and hygiene photos', type: 'photos' },
  ]],
  ['delivery', 'Delivery & FAQ', [
    ...titled,
    { key: 'intro', label: 'Line under the title', type: 'textarea', rows: 2 },
    { key: 'faq', label: 'Questions', type: 'list', singular: 'a question', fields: [{ key: 'q', label: 'Question' }, { key: 'a', label: 'Answer', type: 'textarea', rows: 3 }] },
  ]],
  ['contact', 'Contact', [...titled, { key: 'intro', label: 'Line under the title', type: 'textarea', rows: 2 }]],
  ['privacy', 'Privacy Policy', [...titled, ...SECTIONS]],
  ['terms', 'Terms', [...titled, ...SECTIONS]],
  ['refund', 'Refund & Replacement', [...titled, ...SECTIONS]],
]

export async function render(root) {
  const { data, error } = await db.from('pages').select('slug, content')
  if (error) throw error
  const content = Object.fromEntries(data.map(p => [p.slug, p.content]))
  const body = h('div', { class: 'mt16' })

  function open(slug) {
    const [, label, schema] = PAGES.find(p => p[0] === slug)
    body.replaceChildren(h('h2', {}, label), h('div', { class: 'mt16' }, jsonEditor(schema, content[slug], async value => {
      const { error } = await db.from('pages').update({ content: value, updated_at: new Date().toISOString() }).eq('slug', slug)
      if (error) throw new Error('That did not save. Please try again.')
      content[slug] = structuredClone(value)
    })))
    picker.value = slug
  }

  const picker = h('select', { class: 'input', 'aria-label': 'Choose a page', onchange: e => open(e.target.value) },
    PAGES.map(([slug, label]) => h('option', { value: slug }, label)))
  root.append(title('Our Story & Pages'), h('p', { class: 'muted mt8' }, 'Hours, delivery areas and contact details are in Settings and Prices & Offers.'), h('div', { class: 'mt16' }, picker), body)
  open('home')
}
