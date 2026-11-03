const { token, order, whatsapp: hasWhatsapp, delivered } = document.body.dataset
const box = document.getElementById('actions')
const image = `/r/${token}/image`
const fileName = `flavory-${order}.png`

let waUrl = null
try { waUrl = sessionStorage.getItem(`wa-${token}`) } catch { /* no storage: fall back to the call message */ }

const add = (tag, cls, text, props = {}) => {
  const el = Object.assign(document.createElement(tag), { className: cls, textContent: text }, props)
  box.append(el)
  return el
}

// wa.me is the only link that leaves the site; waUrl was built by our server for this order.
if (waUrl?.startsWith('https://wa.me/')) add('a', 'btn whatsapp block', 'Confirm your order on WhatsApp', { href: waUrl, target: '_blank', rel: 'noopener noreferrer' })
else if (hasWhatsapp === '0') add('p', 'notice center', "Thank you! We'll call you shortly to confirm your order.")

add('a', 'btn ghost block', 'Save receipt image', { href: image, download: fileName })

if (navigator.canShare?.({ files: [new File([''], fileName, { type: 'image/png' })] })) {
  add('button', 'btn ghost block', 'Share receipt').addEventListener('click', async () => {
    const blob = await (await fetch(image)).blob()
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: 'image/png' })], title: `Flavory order ${order}` })
    } catch { /* customer closed the share sheet */ }
  })
}

if (delivered === '1') {
  const form = document.createElement('form')
  form.className = 'stack mt24'
  form.innerHTML = `
    <h2>How was it?</h2>
    <fieldset class="field"><legend>Your rating</legend>
      <div class="opts">${[1, 2, 3, 4, 5].map(n => `<label class="opt"><input type="radio" name="rating" value="${n}"${n === 5 ? ' checked' : ''}><span aria-label="${n} out of 5">${n}</span></label>`).join('')}</div>
    </fieldset>
    <div class="field"><label for="body">Your review</label>
      <textarea class="input" id="body" name="body" rows="3" required minlength="3" maxlength="600"></textarea></div>
    <p class="notice err" hidden></p>
    <button class="btn block">Send review</button>`
  form.addEventListener('submit', async e => {
    e.preventDefault()
    const res = await (await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, rating: form.elements.rating.value, body: form.elements.body.value }),
    })).json()
    if (res.error) {
      const err = form.querySelector('.err')
      err.textContent = res.error
      err.hidden = false
      return
    }
    form.outerHTML = '<p class="notice mt24">Thank you! Your review will appear once we have checked it.</p>'
  })
  box.after(form)
}
