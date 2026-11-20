/* The Library HUD. Decorative layer only: it reads the rendered page and never
   touches books, notes or understandings. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'library' || !window.AtlasHUDCore || window.LibraryHUD) return;
  window.LibraryHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'THE LIBRARY', tagline: 'OS 5.0 // ARCHIVE ONLINE', caps: true, bootKey: 'library:hud-boot', bootLines: ['Indexing the shelves', 'Restoring your notes', 'Mapping your understanding', 'All systems nominal']});
  const {node, svgNode, still, pad, started, startField, startFrame, frameTick, buildReactor, paintArcs, burstAt, boot} = hud;

  /* ── Reactor behind the opening illustration ─────────────────────────────── */
  function openingArcs() {
    const m = (document.querySelector('main .stats .stat')?.textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
    return [{color: 'var(--hud-hue)', pct: m && Number(m[2]) ? 100 * Number(m[1]) / Number(m[2]) : 100, letter: ''}];
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
      tele.append('LIVE ');
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
    if (/^(save|mark|finish|done)/.test(text)) burstAt(control, /finish/.test(text) ? 'BOOK FINISHED' : 'SAVED');
  }, true);

  function init() {
    root.classList.add('hud-on');
    startField();
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
