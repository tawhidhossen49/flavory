import { dateTime } from '../format.js'
import { confirmBox, db, h, title, toast } from './ui.js'

export async function render(root) {
  const { data, error } = await db.from('reviews').select('*').order('created_at', { ascending: false })
  if (error) throw error
  const reload = () => { root.replaceChildren(); render(root) }

  root.append(title('Reviews'),
    h('p', { class: 'muted mt8' }, 'Customers can review from their receipt link after delivery. Nothing shows on the site until you approve it.'),
    h('div', { class: 'stack mt16' }, data.length ? data.map(r => h('article', { class: 'panel stack tight' },
      h('div', { class: 'row between' }, h('strong', {}, `${r.name} · ${'★'.repeat(r.rating)}`), h('span', { class: 'pill' }, r.approved ? 'Showing' : 'Waiting')),
      h('p', { class: 'muted' }, dateTime(r.created_at)),
      h('p', {}, r.body),
      h('div', { class: 'order-acts' },
        h('button', {
          class: 'status-btn',
          onclick: async () => {
            const { error } = await db.from('reviews').update({ approved: !r.approved }).eq('id', r.id)
            if (error) toast('That did not save.')
            reload()
          },
        }, r.approved ? 'Hide it' : 'Approve'),
        h('button', {
          class: 'status-btn danger',
          onclick: async () => {
            if (!await confirmBox('This deletes the review.', 'Yes, delete')) return
            await db.from('reviews').delete().eq('id', r.id)
            reload()
          },
        }, 'Delete'))))
      : h('p', { class: 'muted' }, 'No reviews yet.')))
}
