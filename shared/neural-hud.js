/* Neural Map HUD. Decorative layer only: it reads the catalogue and never
   touches favourites, link reviews or the map itself. Text keeps sentence case (no forced caps). Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'neural-map' || !window.AtlasHUDCore || window.NeuralHUD) return;
  window.NeuralHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'Neural Map', tagline: 'OS 5.0 // Resource atlas', caps: false, bootKey: 'neural:hud-boot', bootLines: ['Indexing your tools', 'Linking the regions', 'Lighting the map', 'All systems nominal'], tilt: '.neural-opening'});
  const {reduce, node, svgNode, still, pad, started, startExtras, startField, startFrame, frameTick, buildReactor, paintArcs, burstAt, boot} = hud;

  /* ── Atlas rings: one arc per region of the map, its share of all resources ── */
  function regionArcs() {
    try {
      // eslint-disable-next-line no-undef
      const cats = typeof CATS !== 'undefined' ? CATS : [];
      const count = c => (c.tools?.length || 0) + (c.groups || []).reduce((t, g) => t + (g.tools?.length || 0), 0);
      const totals = cats.map(count), all = totals.reduce((a, b) => a + b, 0);
      if (!all) throw 0;
      return cats.map((c, i) => ({color: c.color, pct: 100 * totals[i] / all, letter: '', label: c.title || c.key, value: totals[i] + (totals[i] === 1 ? ' tool' : ' tools')}));
    } catch { return [{color: 'var(--hud-hue)', pct: 100, letter: ''}]; }
  }
  function mountRing(hero) {
    const face = hero.querySelector('.neural-opening-face');
    const art = face?.querySelector('.neural-title-art');
    if (!face || !art) return;
    let svg = face.querySelector(':scope>.hud-reactor');
    if (!svg) { svg = buildReactor(face, ''); face.append(svg); paintArcs(svg, regionArcs()); }
    face.classList.add('hud-reactor-host');
    const a = art.getBoundingClientRect(), f = face.getBoundingClientRect();
    if (!a.width) return;
    const size = Math.min(Math.max(a.width, a.height) * 1.0, f.width * 1.02, 360);
    Object.assign(svg.style, {width: size + 'px', height: size + 'px', left: (a.left - f.left + (a.width - size) / 2) + 'px', top: (a.top - f.top + (a.height - size) / 2) + 'px'});
  }

  /* ── Live clock in the opening rail ──────────────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const rail = document.querySelector('.neural-opening .neural-opening-rail');
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

  /* ── Attach once the list exists; follow size changes ────────────────────── */
  let pending = 0;
  function decorate() {
    pending = 0;
    const hero = document.querySelector('.neural-opening');
    if (hero) mountRing(hero);
    mountTelemetry();
  }
  const schedule = () => { if (!pending) pending = requestAnimationFrame(decorate); };
  function watchApp() {
    const wait = new MutationObserver(() => { if (document.querySelector('.neural-opening')) { wait.disconnect(); schedule(); } });
    wait.observe(document.body, {childList: true});
    window.addEventListener('resize', schedule);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
    document.addEventListener('click', e => { if (e.target.closest?.('#atlas-page-navigation')) setTimeout(schedule, 60); });
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  document.addEventListener('click', e => {
    const control = e.target.closest?.('.neural-list button');
    if (!control) return;
    const text = control.textContent.trim().toLowerCase();
    if (/add favourite/.test(text)) burstAt(control, 'Favourited');
  }, true);

  function init() {
    root.classList.add('hud-on');
    startField();
    startExtras();
    startFrame();
    boot();
    node('div', 'hud-scan', document.body);
    watchApp(); schedule();
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
