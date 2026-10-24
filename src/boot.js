// Runs before the first paint, inlined in the HTML at build and allowed by its CSP hash.
// index.html carries a pre-rendered configurator with the starting model: what a first visit shows
// (build/prerender.ts). Any other visit (a shared configuration in the address, saved data or
// settings) hides it rather than flash the wrong bookcase until the app starts.
(function () {
  var show = !/^#\/./.test(location.hash);
  try {
    for (var i = 0; i < localStorage.length; i++) if ((localStorage.key(i) || '').indexOf('lisiere:') === 0) show = false;
  } catch { show = false; }
  document.documentElement.setAttribute('data-prerender', show ? 'shown' : 'skip');
})();
