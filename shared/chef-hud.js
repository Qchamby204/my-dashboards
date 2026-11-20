/* The Chef HUD. Decorative layer only: it reads the rendered page and never
   touches recipes, picks or plans. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'the-chef' || !window.AtlasHUDCore || window.ChefHUD) return;
  window.ChefHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'THE CHEF', tagline: 'OS 5.0 // KITCHEN ONLINE', caps: true, bootKey: 'chef:hud-boot', bootLines: ['Stocking the pantry', 'Loading recipe library', 'Warming up the planner', 'All systems nominal'], accentVars: ['--neo-accent']});
  const {node, svgNode, still, pad, started, startField, startFrame, frameTick, buildReactor, paintArcs, burstAt, boot} = hud;

  /* ── Reactor behind the opening illustration ─────────────────────────────── */
  function openingArcs(hero) {
    // Ingredients: the ring fills as you pick (eight picks fills it); elsewhere it is a full projector ring.
    if (hero.dataset.view === 'ingredients') {
      const picks = document.querySelectorAll('#ing-cats [data-pick][aria-pressed="true"]').length;
      return [{color: 'var(--neo-accent)', pct: Math.min(100, picks * 12.5), letter: ''}];
    }
    return [{color: 'var(--neo-accent)', pct: 100, letter: ''}];
  }
  function mountRing(hero) {
    const face = hero.querySelector('.chef-opening-face');
    const art = face?.querySelector('.chef-title-art');
    if (!face || !art) return;
    let svg = face.querySelector(':scope>.hud-reactor');
    if (!svg) { svg = buildReactor(face, ''); face.append(svg); }
    face.classList.add('hud-reactor-host');
    const a = art.getBoundingClientRect(), f = face.getBoundingClientRect();
    if (!a.width) return;
    const size = Math.min(a.height * 1.15, a.width * .95, f.width * .9);
    Object.assign(svg.style, {width: size + 'px', height: size + 'px', left: (a.left - f.left + (a.width - size) / 2) + 'px', top: (a.top - f.top + (a.height - size) / 2) + 'px'});
    paintArcs(svg, openingArcs(hero));
  }

  /* ── Live clock in the opening rail ──────────────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const rail = document.querySelector('#chef-opening .chef-opening-rail');
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
      const hero = document.getElementById('chef-opening');
      if (hero) mountRing(hero);
      mountTelemetry();
      const view = hero?.dataset.view || '';
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
        if (r.type === 'attributes' || r.addedNodes.length) { schedule(); break; }
      }
    }).observe(app, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-view', 'aria-pressed', 'hidden']});
    window.addEventListener('resize', schedule);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  document.addEventListener('click', e => {
    const control = e.target.closest?.('main :is([data-fav],[data-cooked],[data-rate])');
    if (!control || control.getAttribute('aria-pressed') === 'true') return;
    burstAt(control, control.matches('[data-fav]') ? 'FAVOURITED' : control.matches('[data-cooked]') ? 'COOKED' : 'RATED');
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
