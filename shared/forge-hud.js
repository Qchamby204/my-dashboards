/* The Forge HUD. Decorative layer only: it reads the rendered page and never
   touches Forge records. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'workout-forge' || !window.AtlasHUDCore || window.ForgeHUD) return;
  window.ForgeHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'THE FORGE', tagline: 'OS 5.0 // LOAD SYSTEMS ONLINE', caps: true, bootKey: 'forge:hud-boot', bootLines: ['Loading training blocks', 'Calibrating loads', 'Arming goal plans', 'All systems nominal'], accentVars: ['--neo-accent']});
  const {node, svgNode, still, pad, started, startField, startFrame, frameTick, buildReactor, paintArcs, boot} = hud;

  /* ── Reactor rings around the hologram ───────────────────────────────────── */
  const GOALS = {gold: '#ffd08b', orange: '#ffab88', blue: '#8ddafa', green: '#9ce5b2'};
  function goalArcs(feature) {
    // Training focus: one ring per goal, filled by sessions completed.
    const cards = [...document.querySelectorAll('#app .fg-card')];
    if (feature.classList.contains('fg-starting-point') && cards.length) {
      return cards.slice(0, 4).map(card => {
        const tone = Object.keys(GOALS).find(k => card.classList.contains('fg-' + k));
        const m = card.textContent.match(/(\d+)\s*\/\s*(\d+)\s*sessions/i);
        return {color: GOALS[tone] || 'var(--neo-accent)', pct: m && Number(m[2]) ? 100 * Number(m[1]) / Number(m[2]) : 0, letter: ''};
      });
    }
    // A session in progress: one ring for sets logged, in the goal's colour.
    const m = (feature.querySelector('.fg-readout strong')?.textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
    const beam = getComputedStyle(feature).getPropertyValue('--beam').trim() || 'var(--neo-accent)';
    return [{color: beam, pct: m && Number(m[2]) ? 100 * Number(m[1]) / Number(m[2]) : 0, letter: ''}];
  }
  function mountRing(feature) {
    const art = feature.querySelector('.fg-feature-art');
    const body = feature.querySelector('.fg-feature-body');
    if (!art || !body) return;
    let svg = body.querySelector(':scope>.hud-reactor');
    if (!svg) { svg = buildReactor(body, ''); body.prepend(svg); }
    body.classList.add('hud-reactor-host');
    const a = art.getBoundingClientRect(), b = body.getBoundingClientRect();
    if (!a.width) return;
    const size = Math.min(a.height * 1.12, a.width * .9);
    Object.assign(svg.style, {width: size + 'px', height: size + 'px', left: (a.left - b.left + (a.width - size) / 2) + 'px', top: (a.top - b.top + (a.height - size) / 2) + 'px'});
    paintArcs(svg, goalArcs(feature));
  }

  /* ── Live clock in the opening rail ──────────────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const rail = document.querySelector('#app .fg-feature .fg-feature-rail');
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

  /* ── Re-attach after every Forge render ──────────────────────────────────── */
  let pending = 0, mutating = false, lastView = '';
  function decorate() {
    pending = 0; mutating = true;
    try {
      const feature = document.querySelector('#app .fg-feature');
      if (feature) mountRing(feature);
      mountTelemetry();
      const view = (document.querySelector('#app .fg-feature')?.className || '') + (document.querySelector('#app .fg-detail-title')?.textContent || '');
      const app = document.getElementById('app');
      if (lastView && view !== lastView && app && !still()) {
        app.classList.remove('hud-scan-in'); void app.offsetWidth; app.classList.add('hud-scan-in');
        setTimeout(() => app.classList.remove('hud-scan-in'), 620);
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
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  function burstAt(control, label) {
    if (still()) return;
    const box = control.getBoundingClientRect();
    if (!box.width) return;
    const card = control.closest('[data-goal],.fg-feature,.fg-detail');
    const accent = card ? getComputedStyle(card).getPropertyValue('--beam').trim() : '';
    const xp = '';
    const burst = node('div', 'hud-burst', document.body);
    burst.style.left = box.left + box.width / 2 + 'px';
    burst.style.top = box.top + box.height / 2 + 'px';
    if (accent) burst.style.setProperty('--burst', accent);
    node('i', 'hud-burst-ring', burst); node('i', 'hud-burst-ring b', burst); node('i', 'hud-burst-flash', burst);
    const tag = node('span', 'hud-burst-tag', burst);
    tag.textContent = label;
    setTimeout(() => burst.remove(), 1100);
  }
  document.addEventListener('click', e => {
    const control = e.target.closest?.('#app .fg-primary');
    if (!control) return;
    const text = control.textContent.trim().toLowerCase();
    burstAt(control, /log|save|finish|complete/.test(text) ? 'SET LOGGED' : 'ENGAGED');
  }, true);

  function init() {
    root.classList.add('hud-on');
    startField();
    startFrame();
    boot();
    const app = document.getElementById('app');
    if (app) { watchApp(app); schedule(); }
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
