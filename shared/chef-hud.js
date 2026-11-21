/* The Chef HUD. Decorative layer only: it reads the rendered page and never
   touches recipes, picks or plans. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'the-chef' || !window.AtlasHUDCore || window.ChefHUD) return;
  window.ChefHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'The Chef', tagline: 'OS 5.0 // Kitchen online', bootKey: 'chef:hud-boot', bootLines: ['Stocking the pantry', 'Loading recipe library', 'Warming up the planner', 'All systems nominal'], accentVars: ['--neo-accent'], tilt: '#chef-opening'});
  const {node, svgNode, still, pad, started, startExtras, startField, startFrame, frameTick, buildReactor, paintArcs, burstAt, boot} = hud;

  /* ── Reactor behind the opening illustration ─────────────────────────────── */
  function openingArcs(hero) {
    // Ingredients: the ring fills as you pick (eight picks fills it); elsewhere it is a full projector ring.
    if (hero.dataset.view === 'ingredients') {
      const picks = document.querySelectorAll('#ing-cats [data-pick][aria-pressed="true"]').length;
      return [{color: 'var(--neo-accent)', pct: Math.min(100, picks * 12.5), letter: '', label: 'Ingredients', value: picks + ' picked'}];
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
    burstAt(control, control.matches('[data-fav]') ? 'Favourited' : control.matches('[data-cooked]') ? 'Cooked' : 'Rated');
  }, true);

  /* ── Ingredient fly-in and recipe scan. Picking an ingredient sends a glowing copy
     of it into the hologram basket; when the matches change, a scan sweeps the recipe
     cards and stamps the new count. Reads the page only. */
  let touched = 0;
  function flyToBasket(chip) {
    if (still()) return;
    const from = chip.getBoundingClientRect();
    const art = document.querySelector('#chef-opening .chef-title-art')?.getBoundingClientRect();
    const inView = art && art.bottom > 0 && art.top < innerHeight;
    const tx = inView ? art.left + art.width / 2 : innerWidth / 2, ty = inView ? art.top + art.height * .55 : 0;
    const pill = node('div', 'hud-fly', document.body);
    pill.textContent = chip.textContent.trim();
    pill.style.left = from.left + 'px'; pill.style.top = from.top + 'px';
    const dx = tx - (from.left + from.width / 2), dy = ty - (from.top + from.height / 2);
    pill.animate([
      {transform: 'translate(0,0) scale(1)', opacity: 1},
      {transform: 'translate(' + dx * .5 + 'px,' + (dy * .5 - 60) + 'px) scale(.9)', opacity: 1, offset: .55},
      {transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.2)', opacity: 0},
    ], {duration: 820, easing: 'cubic-bezier(.4,0,.2,1)'}).onfinish = () => {
      pill.remove();
      const basket = document.querySelector('#chef-opening .chef-title-art');
      if (basket && inView) { basket.classList.remove('hud-catch'); void basket.getBBox?.(); basket.classList.add('hud-catch'); setTimeout(() => basket.classList.remove('hud-catch'), 700); }
    };
  }
  function watchKitchen() {
    document.addEventListener('pointerdown', () => { touched = Date.now(); }, {capture: true, passive: true});
    document.addEventListener('click', e => {
      const chip = e.target.closest?.('#ing-cats [data-pick]');
      if (!chip || chip.getAttribute('aria-pressed') === 'true') return;
      const label = chip.dataset.pick;
      setTimeout(() => { const now = document.querySelector('#ing-cats [data-pick="' + CSS.escape(label) + '"]'); if (now?.getAttribute('aria-pressed') === 'true') flyToBasket(now); }, 60);
    }, true);
    const count = document.getElementById('count');
    if (!count) return;
    let last = (count.textContent.match(/\d+/) || [])[0];
    new MutationObserver(() => {
      const n = (count.textContent.match(/\d+/) || [])[0];
      if (n === last) return;
      last = n;
      if (Date.now() - touched > 6000 || still()) return;
      const cards = document.getElementById('cards');
      if (cards && cards.getClientRects().length) {
        const host = cards.parentElement;
        host.classList.add('hud-scan-host');
        const bar = node('i', 'hud-recipe-scan', host);
        bar.style.top = cards.offsetTop + 'px'; bar.style.height = Math.min(cards.offsetHeight, innerHeight * 1.2) + 'px';
        setTimeout(() => bar.remove(), 1000);
      }
      count.querySelector(':scope>.hud-match')?.remove();
      const tag = node('span', 'hud-match', count);
      tag.textContent = 'Scan complete · ' + n + (n === '1' ? ' match' : ' matches');
      setTimeout(() => tag.remove(), 1800);
    }).observe(count, {childList: true, characterData: true, subtree: true});
  }

  function init() {
    root.classList.add('hud-on');
    startField();
    startExtras();
    startFrame();
    boot();
    node('div', 'hud-scan', document.body);
    const app = document.querySelector('main');
    if (app) { watchApp(app); schedule(); }
    watchKitchen();
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
