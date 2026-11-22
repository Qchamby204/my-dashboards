/* The Herald HUD. Decorative layer only: it reads the rendered page and never
   touches scripts, the calendar or metrics. Text keeps sentence case (no forced caps). Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'the-herald' || !window.AtlasHUDCore || window.HeraldHUD) return;
  window.HeraldHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'The Herald', tagline: 'OS 5.0 // Press room', caps: false, bootKey: 'herald:hud-boot', bootLines: ['Opening the script vault', 'Lining up the calendar', 'Reading the channel', 'All systems nominal'], tilt: '#view .herald-opening'});
  const {reduce, node, svgNode, still, pad, started, startExtras, startField, startFrame, frameTick, buildReactor, paintArcs, burstAt, boot, celebrate, scene} = hud;

  /* ── Pipeline rings: one arc per Assembly stage, its share of all scripts ── */
  const STAGE_HUES = ['#f0bc85', '#ffd65c', '#8cc8ff', '#6ff2c8', '#b591ff'];
  function pipelineArcs() {
    const nodes = [...document.querySelectorAll('#rail .stage .node')].map(n => Number(n.textContent.trim()) || 0);
    const total = nodes.reduce((a, b) => a + b, 0);
    if (!nodes.length) return [{color: 'var(--hud-tab)', pct: 100, letter: ''}];
    const names = [...document.querySelectorAll('#rail .stage')].map(s => s.textContent.replace(/^\s*\d+/, '').trim());
    return nodes.map((n, i) => ({color: STAGE_HUES[i % STAGE_HUES.length], pct: total ? 100 * n / total : 0, letter: '', label: names[i] || 'Stage', value: n + (n === 1 ? ' script' : ' scripts')}));
  }
  function mountRing(hero) {
    const stage = hero.querySelector('.herald-projection');
    const art = stage?.querySelector('svg,img');
    if (!stage || !art) return;
    let svg = stage.querySelector(':scope>.hud-reactor');
    if (!svg) { svg = buildReactor(stage, ''); stage.append(svg); }
    stage.classList.add('hud-reactor-host');
    const a = art.getBoundingClientRect(), f = stage.getBoundingClientRect();
    if (!a.width) return;
    const size = Math.min(f.height * 1.02, f.width * .9, 320);
    Object.assign(svg.style, {width: size + 'px', height: size + 'px', left: (f.width - size) / 2 + 'px', top: (f.height - size) / 2 + 'px'});
    const arcs = pipelineArcs();
    paintArcs(svg, arcs);
    // Something just moved into Published because of you: celebrate it.
    const published = Number(document.querySelector('#rail .stage.pub .node')?.textContent.trim()) || 0;
    if (lastPublished != null && published > lastPublished && Date.now() - lastTouch < 6000) scene({title: 'Published', detail: published + (published === 1 ? ' script live' : ' scripts live'), color: '#b591ff'});
    lastPublished = published;
  }
  let lastPublished = null, lastTouch = 0;
  addEventListener('pointerdown', () => { lastTouch = Date.now(); }, {capture: true, passive: true});
  addEventListener('keydown', () => { lastTouch = Date.now(); }, {capture: true, passive: true});

  /* ── Live clock in the opening rail ──────────────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const rail = document.querySelector('#view .herald-opening .herald-opening-rail');
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
      const hero = document.querySelector('#view .herald-opening');
      if (hero) mountRing(hero);
      mountTelemetry();
      const view = hero?.dataset.opening || '';
      const main = document.getElementById('view');
      if (lastView && view !== lastView && main && !still() && !document.documentElement.classList.contains('hud-native')) {
        main.classList.remove('hud-scan-in'); void main.offsetWidth; main.classList.add('hud-scan-in');
        setTimeout(() => main.classList.remove('hud-scan-in'), 620);
      }
      lastView = view;
    } finally { mutating = false; }
  }
  const schedule = () => { if (!pending) pending = requestAnimationFrame(decorate); };
  function watchApp() {
    const app = document.querySelector('.wrap');
    if (!app) return;
    new MutationObserver(records => {
      if (mutating) return;
      for (const r of records) {
        if (r.target.closest?.('.hud-telemetry,.hud-reactor')) continue;
        if (r.type === 'attributes' || r.addedNodes.length || r.type === 'characterData') { schedule(); break; }
      }
    }).observe(app, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-opening']});
    window.addEventListener('resize', schedule);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  document.addEventListener('click', e => {
    const control = e.target.closest?.('#view .btn, #view button');
    if (!control) return;
    const text = control.textContent.trim().toLowerCase();
    if (/^add to vault|^schedule|^save|^publish|^mark/.test(text)) burstAt(control, /publish/.test(text) ? 'Published' : /schedule/.test(text) ? 'Scheduled' : 'Saved');
  }, true);

  function init() {
    root.classList.add('hud-on');
    startField();
    startExtras();
    // Pages sweep in, cards build in, figures decode, bars fill (shared/hud-core.js).
    hud.native({scope: '#view'});
    startFrame();
    boot();
    node('div', 'hud-scan', document.body);
    watchApp(); schedule();
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
