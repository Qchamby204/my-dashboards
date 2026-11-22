/* The Forge HUD. Decorative layer only: it reads the rendered page and never
   touches Forge records. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'workout-forge' || !window.AtlasHUDCore || window.ForgeHUD) return;
  window.ForgeHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'The Forge', tagline: 'OS 5.0 // Load systems online', bootKey: 'forge:hud-boot', bootLines: ['Loading training blocks', 'Calibrating loads', 'Arming goal plans', 'All systems nominal'], accentVars: ['--neo-accent'], tilt: '#app .fg-feature'});
  const {node, svgNode, still, pad, started, startExtras, startField, startFrame, frameTick, buildReactor, paintArcs, boot} = hud;

  /* ── Reactor rings around the hologram ───────────────────────────────────── */
  const SPLIT = {Push:'#cc7841',Legs:'#a28bd9',Pull:'#4299b6',Engine:'#43a885'};
  function goalArcs(feature) {
    if(feature.dataset.focus==='home'){
      const logged=[...feature.querySelectorAll('[data-workouts]')].flatMap(day=>day.dataset.workouts.split(' '));
      return Object.entries(SPLIT).map(([label,color])=>{
        const count=logged.filter(type=>type===label.toUpperCase()).length;
        return {label,color,pct:count?100:0,letter:'',value:count+' logged in the past 7 days',done:label+' logged this week'};
      });
    }
    // A session in progress: one ring for sets logged, in the goal's colour.
    const m = (feature.querySelector('.fg-readout strong')?.textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
    const beam = getComputedStyle(feature).getPropertyValue('--beam').trim() || 'var(--neo-accent)';
    const split=feature.classList.contains('fg-starting-point');
    return [{color: beam, pct: m && Number(m[2]) ? 100 * Number(m[1]) / Number(m[2]) : 0, letter: '', label: split?'Exercises':'Sets', value: m ? m[1] + ' of ' + m[2] + (split?' marked':' logged') : '', done: split?'Exercises marked':'Session complete', scene: true}];
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
      if (lastView && view !== lastView && app && !still() && !document.documentElement.classList.contains('hud-native')) {
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
    burstAt(control, /log|save|finish|complete/.test(text) ? 'Set logged' : 'Engaged');
  }, true);

  function init() {
    root.classList.add('hud-on');
    startField();
    startExtras();
    // Pages sweep in, cards build in, figures decode, bars fill (shared/hud-core.js).
    hud.native({scope: '#app', bars: '.fg-progress>span,.bartrack>div'});
    startFrame();
    boot();
    const app = document.getElementById('app');
    if (app) { watchApp(app); schedule(); }
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
