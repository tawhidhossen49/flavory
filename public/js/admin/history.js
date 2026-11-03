import { dateTime } from '../format.js'
import { confirmBox, db, h, title, toast } from './ui.js'

const NOUNS = { categories: 'Category', menu_items: 'Menu item', item_options: 'Price', option_costs: 'Cost price', settings: 'Settings', pages: 'Page text', coupons: 'Coupon', reviews: 'Review' }
const VERBS = { INSERT: 'added', UPDATE: 'changed', DELETE: 'deleted' }

function describe(rows) {
  const main = rows.find(r => r.table_name === 'menu_items') ?? rows[0]
  const row = main.after ?? main.before
  const name = row.name ?? row.code ?? row.slug ?? row.key ?? ''
  return `${NOUNS[main.table_name]}${name ? ` "${name}"` : ''} ${VERBS[main.action]}`
}

export async function render(root) {
  const { data, error } = await db.from('audit_log').select('*').order('id', { ascending: false }).limit(300)
  if (error) throw error
  const groups = [...data.reduce((m, r) => m.set(r.txid, [...(m.get(r.txid) ?? []), r]), new Map()).values()].slice(0, 60)

  root.append(title('Undo a Change'),
    h('p', { class: 'muted mt8' }, 'Every change to the menu, prices and pages is kept here. New orders are not.'),
    h('div', { class: 'stack mt16' }, groups.map(rows => h('div', { class: 'panel row between' },
      h('div', {}, h('strong', {}, describe(rows)), h('p', { class: 'muted' }, dateTime(rows[0].at))),
      rows[0].undone ? h('span', { class: 'pill' }, 'Undone') : h('button', {
        class: 'btn ghost',
        onclick: async () => {
          if (!await confirmBox(`Undo: ${describe(rows)}?`, 'Yes, undo')) return
          const { error } = await db.rpc('undo_change', { p_audit_id: rows[0].id })
          toast(error ? 'That could not be undone.' : 'Undone')
          root.replaceChildren()
          render(root)
        },
      }, 'Undo')))))
}
