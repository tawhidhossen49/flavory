// Runs before first paint: marks JS as present and decides whether the preloader plays.
(function () {
  var d = document.documentElement
  d.classList.add('js')
  var skip = true
  try {
    skip = Boolean(sessionStorage.getItem('pl')) || matchMedia('(prefers-reduced-motion: reduce)').matches
    sessionStorage.setItem('pl', '1')
  } catch (e) { /* storage blocked: no preloader */ }
  if (skip) d.classList.add('no-preload')
  // Safety net: if the animation scripts fail to load, show everything anyway.
  setTimeout(function () { d.classList.add('motion-ready', 'hero-in', 'no-preload') }, 4000)
})()
