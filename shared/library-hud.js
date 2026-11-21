/* The Library HUD. Decorative layer only: it reads the rendered page and never
   touches books, notes or understandings. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'library' || !window.AtlasHUDCore || window.LibraryHUD) return;
  window.LibraryHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'The Library', tagline: 'OS 5.0 // Archive online', bootKey: 'library:hud-boot', bootLines: ['Indexing the shelves', 'Restoring your notes', 'Mapping your understanding', 'All systems nominal'], tilt: 'main .library-opening'});
  const {node, svgNode, still, pad, started, startExtras, startField, startFrame, frameTick, buildReactor, paintArcs, burstAt, boot} = hud;

  /* ── Reactor behind the opening illustration ─────────────────────────────── */
  function openingArcs() {
    const m = (document.querySelector('main .stats .stat')?.textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
    return [{color: 'var(--hud-hue)', pct: m && Number(m[2]) ? 100 * Number(m[1]) / Number(m[2]) : 100, letter: '', label: 'Books completed', value: m ? m[1] + ' of ' + m[2] : '', done: 'Shelf complete'}];
  }
  function mountRing(hero) {
    const face = hero.querySelector('.library-opening-face');
    const art = face?.querySelector('svg:not(.hud-reactor)');
    if (!face || !art) return;
    let svg = face.querySelector(':scope>.hud-reactor');
    if (!svg) { svg = buildReactor(face, ''); face.append(svg); }
    face.classList.add('hud-reactor-host');
    const a = art.getBoundingClientRect(), f = face.getBoundingClientRect();
    if (!a.width) return;
    const size = Math.min(a.height * 1.15, a.width * .95, f.width * .9);
    Object.assign(svg.style, {width: size + 'px', height: size + 'px', left: (a.left - f.left + (a.width - size) / 2) + 'px', top: (a.top - f.top + (a.height - size) / 2) + 'px'});
    paintArcs(svg, openingArcs());
    mountShelf(face, art);
  }

  /* ── Archive shelf: one glowing spine per finished book along the hologram's
     floor, a few dim slots for what comes next, and a new spine slides in when you
     finish one. Reads the "Books completed" stat only. */
  const SPINES = ['#8cc8ff', '#ffd08b', '#b591ff', '#6ff2c8', '#ff8a7a', '#e8c78b', '#5ff4ff'];
  let shelfDone = null, shelfTouched = 0;
  addEventListener('pointerdown', () => { shelfTouched = Date.now(); }, {capture: true, passive: true});
  function mountShelf(face, art) {
    const m = (document.querySelector('main .stats .stat')?.textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
    const done = m ? Number(m[1]) : 0;
    let shelf = face.querySelector(':scope>.hud-shelf');
    if (!shelf) { shelf = svgNode('svg', {class: 'hud-shelf', viewBox: '0 0 300 40', 'aria-hidden': 'true', focusable: 'false'}); face.append(shelf); }
    const a = art.getBoundingClientRect(), f = face.getBoundingClientRect();
    const w = a.width * .86;
    Object.assign(shelf.style, {width: w + 'px', height: w * 40 / 300 + 'px', left: (a.left - f.left + (a.width - w) / 2) + 'px', top: (a.bottom - f.top - w * 40 / 300 + 2) + 'px'});
    if (shelf.dataset.done === String(done)) return;
    const arrive = shelfDone != null && done > shelfDone && Date.now() - shelfTouched < 6000 && !still();
    shelf.dataset.done = String(done);
    shelf.textContent = '';
    svgNode('path', {d: 'M4 37.5H296', class: 'hud-shelf-floor'}, shelf);
    const slots = 26, shown = Math.min(done, slots);
    for (let i = 0; i < Math.min(slots, shown + 3); i++) {
      const h = 18 + ((i * 37) % 13), x = 10 + i * 10.9, filled = i < shown;
      const r = svgNode('rect', {x: x.toFixed(1), y: (37 - h).toFixed(1), width: 8.2, height: h, rx: 1, class: filled ? 'hud-spine' : 'hud-spine-slot'}, shelf);
      if (filled) r.style.setProperty('--spine', SPINES[i % SPINES.length]);
      if (filled && arrive && i === shown - 1) r.classList.add('hud-spine-new');
    }
    if (done > slots) { const t = svgNode('text', {x: 296, y: 12, 'text-anchor': 'end', class: 'hud-shelf-more'}, shelf); t.textContent = '+' + (done - slots); }
    shelfDone = done;
  }

  /* ── Live clock in the opening rail ──────────────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const rail = document.querySelector('main .library-opening .library-opening-rail');
    if (!rail) return;
    let tele = rail.querySelector('.hud-telemetry');
    if (!tele) {
      tele = node('span', 'hud-telemetry', rail);
      node('i', 'hud-live', tele);
      tele.append('Live ');
      node('b', '', tele);
    }
    heroClock = tele.querySelector('b');
    tick();
  }
  function tick() {
    const now = new Date();
    const clock = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    if (heroClock?.isConnected) heroClock.textContent = clock;
    frameTick(now);
  }

  /* ── Re-attach after every render ────────────────────────────────────────── */
  let pending = 0, mutating = false, lastView = '';
  function decorate() {
    pending = 0; mutating = true;
    try {
      const hero = document.querySelector('main .library-opening');
      if (hero) mountRing(hero);
      mountTelemetry();
      const view = location.hash + '|' + (hero?.querySelector('h1')?.textContent || '');
      const main = document.querySelector('main');
      if (lastView && view !== lastView && main && !still()) {
        main.classList.remove('hud-scan-in'); void main.offsetWidth; main.classList.add('hud-scan-in');
        setTimeout(() => main.classList.remove('hud-scan-in'), 620);
      }
      lastView = view;
    } finally { mutating = false; }
  }
  const schedule = () => { if (!pending) pending = requestAnimationFrame(decorate); };
  function watchApp(app) {
    new MutationObserver(records => {
      if (mutating) return;
      for (const r of records) {
        if (r.target.closest?.('.hud-telemetry,.hud-reactor')) continue;
        if (r.addedNodes.length) { schedule(); break; }
      }
    }).observe(app, {childList: true, subtree: true});
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', schedule);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  document.addEventListener('click', e => {
    const control = e.target.closest?.('main button');
    if (!control || control.getAttribute('aria-pressed') === 'true') return;
    const text = control.textContent.trim().toLowerCase();
    if (/^(save|mark|finish|done)/.test(text)) burstAt(control, /finish/.test(text) ? 'Book finished' : 'Saved');
  }, true);

  function init() {
    root.classList.add('hud-on');
    startField();
    startExtras();
    startFrame();
    boot();
    node('div', 'hud-scan', document.body);
    const app = document.querySelector('main');
    if (app) { watchApp(app); schedule(); }
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
