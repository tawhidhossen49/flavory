import { dhakaToday } from '../format.js'
import { cardHtml } from '../site-card.js'
import { confirmBox, db, diffSchema, h, icon, modal, saveBar, schemaForm, title, toast } from './ui.js'

const BADGES = [['', 'None'], ['Best seller', 'Best seller'], ['New', 'New'], ['Spicy', 'Spicy']]

export async function render(root) {
  const [{ data: cats }, { data: items, error }] = await Promise.all([
    db.from('categories').select('*').order('sort_order'),
    db.from('menu_items').select('*, item_options(id, price, label)').order('sort_order'),
  ])
  if (error) throw error
  const today = dhakaToday()

  const rows = item => h('div', { class: 'item-row', 'data-id': item.id },
    h('button', { class: 'drag', 'aria-label': `Move ${item.name}` }, icon('drag', 24)),
    item.photos[0] ? h('img', { class: 'item-thumb', src: item.photos[0].replace(/\.webp$/, '-480.webp'), alt: '' }) : h('div', { class: 'item-thumb' }),
    h('a', { href: `#item/${item.id}` }, h('strong', {}, item.name), item.is_sample ? h('div', {}, h('span', { class: 'pill' }, 'Sample')) : null),
    h('label', { class: 'switch' }, h('span', { class: 'sr' }, `${item.name} available today`), h('input', {
      type: 'checkbox', checked: item.sold_out_on !== today,
      onchange: async e => {
        const { error } = await db.from('menu_items').update({ sold_out_on: e.target.checked ? null : today }).eq('id', item.id)
        toast(error ? 'That did not save.' : e.target.checked ? 'Available today' : 'Sold out today')
      },
    })))

  root.append(
    title('Menu', h('a', { class: 'btn', href: '#item/new' }, 'Add item')),
    h('p', { class: 'muted mt8' }, 'The switch means "available today". Drag the dots to change the order.'),
    ...cats.map(c => {
      const list = h('div', { class: 'stack tight mt8', 'data-cat': c.id }, items.filter(i => i.category_id === c.id).map(rows))
      window.Sortable.create(list, {
        handle: '.drag', animation: 150, group: 'menu',
        onEnd: async () => {
          const moves = [...root.querySelectorAll('[data-cat]')].flatMap(box =>
            [...box.children].map(el => ({ id: el.dataset.id, category_id: box.dataset.cat })))
          const results = await Promise.all(moves.map((m, i) =>
            db.from('menu_items').update({ sort_order: i, category_id: m.category_id }).eq('id', m.id)))
          toast(results.some(r => r.error) ? 'The new order did not save.' : 'Order saved')
        },
      })
      return h('section', { class: 'mt24' },
        h('div', { class: 'row between' }, h('h2', {}, c.name), h('button', { class: 'btn ghost', onclick: () => renameCategory(c) }, 'Edit')),
        list)
    }),
    h('button', { class: 'btn ghost block mt24', onclick: () => renameCategory(null, cats.length) }, 'Add a category'))
}

function renameCategory(cat, order = 0) {
  const name = h('input', { class: 'input', value: cat?.name ?? '', maxLength: 60, 'aria-label': 'Category name' })
  const m = modal(
    h('h2', {}, cat ? 'Edit category' : 'New category'), name,
    h('button', {
      class: 'btn block',
      onclick: async () => {
        if (!name.value.trim()) return
        const { error } = cat
          ? await db.from('categories').update({ name: name.value.trim() }).eq('id', cat.id)
          : await db.from('categories').insert({ name: name.value.trim(), sort_order: order })
        m.remove()
        if (error) return toast('That did not save.')
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      },
    }, 'Save'),
    cat ? h('button', {
      class: 'btn danger block',
      onclick: async () => {
        m.remove()
        if (!await confirmBox(`This deletes the category "${cat.name}".`, 'Yes, delete')) return
        const { error } = await db.from('categories').delete().eq('id', cat.id)
        if (error) return toast('Move or delete its items first.')
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      },
    }, 'Delete category') : null,
    h('button', { class: 'btn ghost block', onclick: () => m.remove() }, 'Cancel'))
}

export async function renderItem(root, id) {
  const { data: cats } = await db.from('categories').select('id, name').order('sort_order')
  let saved
  if (id === 'new') {
    saved = { id: '', category_id: cats[0]?.id, name: '', description: '', ingredients: '', allergens: 'Contains wheat, egg, soy.', badge: '', photos: [], available: true, suggest: false, sold_out_on: null, options: [{ label: '', price: 0, cost: 0 }] }
  } else {
    const { data: item, error } = await db.from('menu_items').select('*, item_options(id, label, price, sort_order, option_costs(cost))').eq('id', id).single()
    if (error) throw error
    saved = {
      ...item, badge: item.badge ?? '',
      options: item.item_options.sort((a, b) => a.sort_order - b.sort_order)
        .map(o => ({ id: o.id, label: o.label, price: o.price, cost: o.option_costs?.cost ?? 0 })),
    }
  }

  const SCHEMA = [
    { key: 'photos', label: 'Photos', type: 'photos', hint: 'Use real photos of the real portion. The first photo shows on the card.' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Short description', type: 'textarea', rows: 2 },
    { key: 'ingredients', label: 'Ingredients', type: 'textarea', rows: 2 },
    { key: 'allergens', label: 'Allergen note' },
    { key: 'category_id', label: 'Category', options: cats.map(c => [c.id, c.name]) },
    { key: 'badge', label: 'Badge', options: BADGES },
    {
      key: 'options', label: 'Sizes and prices', type: 'list', singular: 'a size',
      fields: [
        { key: 'label', label: 'Size', hint: 'For example "6 pcs". Leave empty if there is only one size.' },
        { key: 'price', label: 'Price (Tk)', type: 'number' },
        { key: 'cost', label: 'Cost price (Tk)', type: 'number', hint: 'Food plus packaging. Customers never see this.' },
      ],
    },
    { key: 'available', label: 'Show on the menu', type: 'switch' },
    { key: 'suggest', label: 'Suggest before checkout', type: 'switch' },
  ]

  const value = structuredClone(saved)
  const preview = h('div', { class: 'preview-card' })
  const paintPreview = () => {
    preview.innerHTML = cardHtml({ ...value, available: true, sold_out_on: null, badge: value.badge || null, item_options: value.options.map((o, i) => ({ ...o, id: String(i) })) })
  }

  const { bar, refresh } = saveBar(() => diffSchema(SCHEMA, saved, value), async () => {
    if (!value.name.trim()) throw new Error('Please give the item a name.')
    if (!value.options.length) throw new Error('Please add at least one price.')
    const { data, error } = await db.rpc('save_menu_item', { p: value })
    if (error) throw new Error('That did not save. Please try again.')
    if (!value.id) location.hash = `item/${data}`
    saved = structuredClone(value)
  })

  const onChange = () => { refresh(); paintPreview() }
  paintPreview()
  root.append(
    title(id === 'new' ? 'New item' : 'Edit item'),
    h('div', { class: 'stack loose mt16' },
      h('h2', {}, 'Preview'), preview,
      schemaForm(SCHEMA, value, onChange),
      id === 'new' ? null : h('button', {
        class: 'btn danger block',
        onclick: async () => {
          if (!await confirmBox(`This deletes "${saved.name}" from the menu. You can bring it back from Undo a Change.`, 'Yes, delete')) return
          const { error } = await db.from('menu_items').delete().eq('id', saved.id)
          if (error) return toast('That did not delete.')
          location.hash = 'menu'
        },
      }, 'Delete this item')),
    bar)
}
