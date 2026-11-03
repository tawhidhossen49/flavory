import { tk } from '../format.js'
import { confirmBox, db, h, jsonEditor, modal, title, toast } from './ui.js'

const saveSetting = key => async value => {
  const { error } = await db.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key)
  if (error) throw new Error('That did not save. Please try again.')
}

async function priceTable(body) {
  const { data: items, error } = await db.from('menu_items').select('name, sort_order, item_options(id, label, price, sort_order)').order('sort_order')
  if (error) throw error
  body.replaceChildren(h('div', { class: 'panel stack' },
    h('h2', {}, 'Prices'),
    h('p', { class: 'muted' }, 'Change a price and tap away. It saves by itself.'),
    items.flatMap(item => item.item_options.sort((a, b) => a.sort_order - b.sort_order).map(o => {
      const id = `p-${o.id}`
      return h('div', { class: 'row between' },
        h('label', { htmlFor: id }, `${item.name}${o.label ? ` (${o.label})` : ''}`),
        h('input', {
          class: 'input', id, type: 'number', min: 0, inputMode: 'numeric', value: o.price, style: 'max-width:110px',
          onchange: async e => {
            const price = Number(e.target.value)
            if (!(price >= 0)) return toast('Please enter a price.')
            const { error } = await db.from('item_options').update({ price }).eq('id', o.id)
            toast(error ? 'That did not save.' : 'Price saved')
          },
        }))
    })),
  ))
}

function couponForm(reload) {
  const v = h('input', { class: 'input', type: 'number', min: 1, inputMode: 'numeric', value: 50, 'aria-label': 'Amount' })
  const code = h('input', { class: 'input', maxLength: 30, 'aria-label': 'Code', placeholder: 'WELCOME50' })
  const min = h('input', { class: 'input', type: 'number', min: 0, inputMode: 'numeric', value: 0, 'aria-label': 'Smallest order' })
  const kind = h('select', { class: 'input', 'aria-label': 'Type' }, h('option', { value: 'amount' }, 'Taka off'), h('option', { value: 'percent' }, 'Percent off'))
  const m = modal(
    h('h2', {}, 'New coupon'),
    h('div', { class: 'field' }, h('label', {}, 'Code'), code),
    h('div', { class: 'field' }, h('label', {}, 'Discount'), kind, v),
    h('div', { class: 'field' }, h('label', {}, 'Smallest order (Tk)'), min),
    h('button', {
      class: 'btn block',
      onclick: async () => {
        const { error } = await db.from('coupons').insert({ code: code.value.trim().toUpperCase(), kind: kind.value, value: Number(v.value), min_order: Number(min.value) })
        if (error) return toast('Check the code: at least 3 letters, and not used before.')
        m.remove()
        reload()
      },
    }, 'Save coupon'),
    h('button', { class: 'btn ghost block', onclick: () => m.remove() }, 'Cancel'))
}

async function coupons(body) {
  const { data, error } = await db.from('coupons').select('*').eq('source', 'manual').order('created_at', { ascending: false })
  if (error) throw error
  const reload = () => coupons(body)
  body.replaceChildren(h('div', { class: 'panel stack' },
    h('div', { class: 'row between' }, h('h2', {}, 'Coupons'), h('button', { class: 'btn', onclick: () => couponForm(reload) }, 'Add')),
    data.length ? data.map(c => h('div', { class: 'row between' },
      h('span', {}, h('strong', {}, c.code), ` ${c.kind === 'percent' ? `${c.value}%` : tk(c.value)} off · used ${c.used}`),
      h('button', {
        class: 'btn danger',
        onclick: async () => {
          if (!await confirmBox(`This deletes the coupon ${c.code}.`, 'Yes, delete')) return
          await db.from('coupons').delete().eq('code', c.code)
          reload()
        },
      }, 'Delete'))) : h('p', { class: 'muted' }, 'No coupons yet.')))
}

export async function render(root) {
  const { data, error } = await db.from('settings').select('key, value').in('key', ['delivery', 'marketing'])
  if (error) throw error
  const s = Object.fromEntries(data.map(r => [r.key, r.value]))
  const { data: options } = await db.from('item_options').select('id, label, menu_items(name)')

  const prices = h('div'), couponBox = h('div')
  root.append(title('Prices & Offers'), h('div', { class: 'stack mt16' },
    prices,
    h('div', { class: 'panel stack' }, h('h2', {}, 'Delivery fees'), jsonEditor([
      { key: 'areas', label: 'Delivery areas', type: 'list', singular: 'an area', fields: [{ key: 'name', label: 'Area' }, { key: 'fee', label: 'Delivery fee (Tk)', type: 'number' }] },
      { key: 'free_over', label: 'Free delivery over (Tk)', type: 'number' },
      { key: 'pickup_discount', label: 'Pickup discount (Tk)', type: 'number' },
    ], s.delivery, saveSetting('delivery'))),
    h('div', { class: 'panel stack' }, h('h2', {}, 'Offers'), h('p', { class: 'muted' }, 'Every offer stays off until you switch it on.'), jsonEditor([
      { key: 'coupons', label: 'Coupon codes', type: 'switch' },
      { key: 'bounce', label: 'Next-order coupon on the receipt', type: 'group', fields: [
        { key: 'enabled', label: 'On', type: 'switch' },
        { key: 'amount', label: 'Amount off (Tk)', type: 'number' },
        { key: 'days', label: 'Good for how many days', type: 'number' },
      ] },
      { key: 'loyalty', label: 'Loyalty reward', type: 'group', fields: [
        { key: 'enabled', label: 'On', type: 'switch' },
        { key: 'every', label: 'Reward every how many orders', type: 'number' },
        { key: 'option_id', label: 'Free item', options: [['', 'Choose one'], ...options.map(o => [o.id, `${o.menu_items.name}${o.label ? ` (${o.label})` : ''}`])] },
        { key: 'label', label: 'Reward name on the receipt' },
      ] },
      { key: 'referral', label: 'Refer a friend', type: 'group', fields: [
        { key: 'enabled', label: 'On', type: 'switch' },
        { key: 'amount', label: 'Amount off for both (Tk)', type: 'number' },
      ] },
    ], s.marketing, saveSetting('marketing'))),
    couponBox))
  await Promise.all([priceTable(prices), coupons(couponBox)])
}
