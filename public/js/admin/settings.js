import { confirmBox, db, h, jsonEditor, title, toast } from './ui.js'

const saveSetting = key => async value => {
  const { error } = await db.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key)
  if (error) throw new Error('That did not save. Please try again.')
}

async function staffApi(body) {
  const { data: { session } } = await db.auth.getSession()
  const res = await fetch('/api/staff', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return res.json()
}

async function accounts(box) {
  const { data: profiles } = await db.from('profiles').select('user_id, role')
  const list = await staffApi({ action: 'list' })
  const roleOf = id => profiles?.find(p => p.user_id === id)?.role
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'off', 'aria-label': 'New account email', placeholder: 'Email' })
  const password = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', minLength: 12, 'aria-label': 'New account password', placeholder: 'Password, at least 12 characters' })
  const role = h('select', { class: 'input', 'aria-label': 'Role' }, h('option', { value: 'staff' }, 'Staff (orders only)'), h('option', { value: 'owner' }, 'Owner (everything)'))
  const reload = () => accounts(box)

  box.replaceChildren(h('h2', {}, 'Owner and staff accounts'),
    list.error ? h('p', { class: 'notice' }, list.error) : [
      ...list.users.map(u => h('div', { class: 'row between' },
        h('span', {}, `${u.email} `, h('span', { class: 'pill' }, roleOf(u.id) ?? 'No access')),
        h('button', {
          class: 'btn danger',
          onclick: async () => {
            if (!await confirmBox(`This removes ${u.email}.`, 'Yes, remove')) return
            const r = await staffApi({ action: 'remove', id: u.id })
            toast(r.error ?? 'Removed')
            reload()
          },
        }, 'Remove'))),
      email, password, role,
      h('button', {
        class: 'btn ghost block',
        onclick: async () => {
          const r = await staffApi({ action: 'create', email: email.value, password: password.value, role: role.value })
          toast(r.error ?? 'Account added')
          if (!r.error) reload()
        },
      }, 'Add account'),
    ])
}

function passwordBox() {
  const input = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', minLength: 12, 'aria-label': 'New password' })
  return h('div', { class: 'panel stack' }, h('h2', {}, 'Change my password'), input,
    h('p', { class: 'muted' }, 'At least 12 characters. A short sentence works well.'),
    h('button', {
      class: 'btn ghost block',
      onclick: async () => {
        if (input.value.length < 12) return toast('Please use at least 12 characters.')
        const { error } = await db.auth.updateUser({ password: input.value })
        toast(error ? 'That did not save.' : 'Password changed')
        input.value = ''
      },
    }, 'Save new password'))
}

function deleteCustomer() {
  const phone = h('input', { class: 'input', type: 'tel', 'aria-label': 'Customer phone number', placeholder: '01712-345678' })
  return h('div', { class: 'panel stack' }, h('h2', {}, "Delete a customer's data"),
    h('p', { class: 'muted' }, 'If a customer asks, this removes their name, phone number and address. Sales totals stay.'),
    phone,
    h('button', {
      class: 'btn danger block',
      onclick: async () => {
        if (!phone.value.trim()) return
        if (!await confirmBox(`This erases the details for ${phone.value}. This cannot be undone.`, 'Yes, erase')) return
        const { data, error } = await db.rpc('delete_customer', { p_phone: phone.value })
        toast(error ? 'That did not work.' : `Erased ${data} order${data === 1 ? '' : 's'}`)
        phone.value = ''
      },
    }, 'Erase this customer'))
}

export async function render(root) {
  const { data, error } = await db.from('settings').select('key, value').in('key', ['business', 'payments'])
  if (error) throw error
  const s = Object.fromEntries(data.map(r => [r.key, r.value]))
  const box = h('div', { class: 'panel stack' }, h('p', { class: 'muted' }, 'Loading accounts…'))

  root.append(title('Settings'), h('div', { class: 'stack mt16' },
    h('div', { class: 'panel stack' }, h('h2', {}, 'Kitchen and contact'), jsonEditor([
      { key: 'kitchen_open', label: 'Kitchen open', type: 'switch' },
      { key: 'whatsapp', label: 'WhatsApp business number', hint: 'Until this is filled in, customers see "We\'ll call you shortly" instead of the WhatsApp button.' },
      { key: 'phone', label: 'Phone number' },
      { key: 'facebook', label: 'Facebook page link', hint: 'Starts with https://' },
      { key: 'area_label', label: 'Kitchen area shown on the site', hint: 'Never put the street address here.' },
      { key: 'open', label: 'Opens at', type: 'time' },
      { key: 'close', label: 'Closes at', type: 'time' },
    ], s.business, saveSetting('business'))),
    h('div', { class: 'panel stack' }, h('h2', {}, 'bKash'), jsonEditor([
      { key: 'bkash_enabled', label: 'Accept bKash', type: 'switch' },
      { key: 'bkash_number', label: 'bKash number' },
    ], s.payments, saveSetting('payments'))),
    box, passwordBox(), deleteCustomer()))
  await accounts(box)
}
