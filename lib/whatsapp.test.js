import assert from 'node:assert/strict'
import { test } from 'node:test'
import { orderMessage, whatsappNumber, whatsappUrl } from './whatsapp.js'
import { esc, normalizePhone } from '../public/js/format.js'

const order = {
  order_no: 1024, subtotal: 657, discount: 0, delivery_fee: 0, total: 657,
  name: 'Rahim', phone: '01712345678', area: 'Dhanmondi', address: 'Road 7', scheduled_for: null,
  payment: 'cod', note: 'Extra spicy dip please',
  lines: [
    { name: 'Crispy Chicken Nuggets', label: '6 pcs', qty: 2, price: 219, line: 438 },
    { name: 'Crispy Chicken Burger', label: '', qty: 1, price: 219, line: 219 },
  ],
}

test('message lists every line, the address and the receipt', () => {
  const m = orderMessage(order, 'https://x/r/abc')
  assert.match(m, /Order: FLV-1024/)
  assert.match(m, /• Crispy Chicken Nuggets \(6 pcs\) × 2 = Tk 438/)
  assert.match(m, /• Crispy Chicken Burger × 1 = Tk 219/)
  assert.match(m, /Delivery: Free/)
  assert.match(m, /Area: Dhanmondi, Road 7/)
  assert.match(m, /Receipt: https:\/\/x\/r\/abc$/)
})

test('url survives encoding: line breaks, ampersands and notes come back intact', () => {
  const m = orderMessage({ ...order, note: 'No onion & extra sauce #2' }, 'https://x/r/abc')
  const url = new URL(whatsappUrl('8801712345678', m))
  assert.equal(url.searchParams.get('text'), m)
  assert.equal(url.pathname, '/8801712345678')
})

test('very long orders stay within link limits', () => {
  const lines = Array.from({ length: 40 }, () => order.lines[0])
  const m = orderMessage({ ...order, lines }, 'https://x/r/abc')
  assert.match(m, /and 15 more on the receipt/)
  assert.ok(whatsappUrl('8801712345678', m).length < 6000)
})

test('whatsapp number becomes international digits', () => {
  assert.equal(whatsappNumber('01726-779404'), '8801726779404')
  assert.equal(whatsappNumber('+880 1726 779404'), '8801726779404')
  assert.equal(whatsappNumber(''), null)
})

test('phone validation', () => {
  assert.equal(normalizePhone('+880 1712-345678'), '01712345678')
  assert.equal(normalizePhone('01712345678'), '01712345678')
  assert.equal(normalizePhone('01212345678'), null)
  assert.equal(normalizePhone('12345'), null)
})

test('escaping neutralises markup', () => {
  assert.equal(esc(`<script>"x"&'y'`), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;')
})
