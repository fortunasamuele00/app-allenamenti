// Cornice comune: tema, icone, campioni di palette/tipografia/spaziature,
// e copia dei componenti nei due riquadri (chiaro e scuro).
(function () {
  const ICONS = {
    check: 'M5 12.5l4.5 4.5L19 7.5',
    chev: 'M9 5l7 7-7 7',
    pause: 'M8 5v14M16 5v14',
    skip: 'M6 5l9 7-9 7zM18 5v14',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    x: 'M6 6l12 12M18 6L6 18',
    gym: 'M3 12h18M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5',
    home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z',
    up: 'M12 19V5M6 11l6-6 6 6',
    rows: 'M4 6h16M4 12h16M4 18h10',
    chart: 'M5 19v-8M12 19V5M19 19v-5',
    sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
    clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  };
  const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sprite.setAttribute('aria-hidden', 'true');
  sprite.style.cssText = 'position:absolute;width:0;height:0';
  sprite.innerHTML = Object.entries(ICONS)
    .map(([id, d]) => `<symbol id="i-${id}" viewBox="0 0 24 24"><path d="${d}"/></symbol>`)
    .join('');
  document.body.prepend(sprite);

  const toggle = document.querySelector('.d-toggle');
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  try { theme = localStorage.getItem('ds-theme') || theme; } catch (e) {}
  function setTheme(t) {
    theme = t;
    document.body.dataset.theme = t;
    toggle.textContent = t === 'dark' ? 'Tema chiaro' : 'Tema scuro';
    try { localStorage.setItem('ds-theme', t); } catch (e) {}
  }
  toggle.addEventListener('click', () => setTheme(theme === 'dark' ? 'light' : 'dark'));
  setTheme(theme);

  const tpl = document.getElementById('components');
  document.querySelectorAll('.frame').forEach((f) => f.appendChild(tpl.content.cloneNode(true)));

  const TOKENS = [
    ['bg', 'Fondo'], ['surface', 'Superficie'], ['surface-2', 'Superficie 2'], ['line', 'Linea'],
    ['text', 'Testo'], ['text-2', 'Testo secondario'], ['accent', 'Accento'],
    ['accent-soft', 'Accento tenue'], ['ok', 'Pronto a salire'],
  ];
  document.querySelectorAll('.d-pal').forEach((p) => {
    const cs = getComputedStyle(p);
    p.innerHTML = `<b>${p.dataset.theme === 'dark' ? 'Scuro' : 'Chiaro'}</b>` + TOKENS.map(([k, label]) => {
      const v = cs.getPropertyValue('--' + k).trim().toUpperCase();
      return `<div class="d-sw"><i style="background:var(--${k})"></i><span>${label}</span><code>${v}</code></div>`;
    }).join('');
  });

  document.querySelectorAll('.d-type [data-cls]').forEach((row) => {
    const s = document.createElement('div');
    s.className = row.dataset.cls;
    s.textContent = row.dataset.sample;
    row.appendChild(s);
    const cs = getComputedStyle(s);
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '');
    const size = row.dataset.size || parseFloat(cs.fontSize);
    const m = document.createElement('small');
    m.textContent = `${row.dataset.name} · ${fam} ${cs.fontWeight} · ${size}px`;
    row.prepend(m);
  });

  const rs = getComputedStyle(document.body);
  const space = document.querySelector('.d-space');
  for (let i = 1; space && i <= 7; i++) {
    const v = rs.getPropertyValue('--s' + i).trim();
    space.insertAdjacentHTML('beforeend', `<div><span>${v}</span><i style="width:${v}"></i></div>`);
  }
  const radius = document.querySelector('.d-radius');
  if (radius) radius.dataset.r.split(',').forEach((pair) => {
    const [k, label] = pair.split(':');
    const v = rs.getPropertyValue('--r-' + k).trim();
    radius.insertAdjacentHTML('beforeend', `<div><i style="border-radius:var(--r-${k})"></i>${label} · ${v}</div>`);
  });

  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-check]');
    if (c) {
      const set = c.closest('.set');
      c.setAttribute('aria-pressed', String(set.classList.toggle('done')));
      set.classList.remove('now');
    }
    const seg = e.target.closest('.seg button');
    if (seg) seg.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === seg)));
  });
})();
