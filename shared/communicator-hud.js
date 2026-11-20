/* Communicator HUD. Decorative layer only: it reads the rendered page and never
   touches practice records. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'communication-trainer' || !window.AtlasHUDCore || window.CommunicatorHUD) return;
  window.CommunicatorHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'COMMUNICATOR', tagline: 'OS 5.0 // VOICE CHANNEL OPEN', caps: true, bootKey: 'communicator:hud-boot', bootLines: ['Calibrating voice channel', 'Loading skill ladder', 'Syncing topic bank', 'All systems nominal'], accentVars: ['--neo-accent']});
  const {node, svgNode, still, pad, started, startField, startFrame, frameTick, buildReactor, paintArcs, burstAt, boot} = hud;

  /* ── Reactor behind each opening card's illustration ────────────────────── */
  function railArcs(feature) {
    const m = (feature.querySelector('.cm-feature-rail')?.textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
    return [{color: 'var(--neo-accent)', pct: m && Number(m[2]) ? 100 * Number(m[1]) / Number(m[2]) : 0, letter: ''}];
  }
  function mountRing(feature) {
    const stage = feature.querySelector('.cm-stage');
    const art = stage?.querySelector('.cm-feature-art');
    if (!stage || !art) return;
    let svg = stage.querySelector(':scope>.hud-reactor');
    if (!svg) { svg = buildReactor(stage, ''); stage.prepend(svg); }
    stage.classList.add('hud-reactor-host');
    const a = art.getBoundingClientRect(), s = stage.getBoundingClientRect();
    if (!a.width) return;
    const size = Math.min(a.height * 1.1, a.width * .8);
    Object.assign(svg.style, {width: size + 'px', height: size + 'px', left: (a.left - s.left + (a.width - size) / 2) + 'px', top: (a.top - s.top + (a.height - size) / 2) + 'px'});
    paintArcs(svg, railArcs(feature));
  }
  /* The opening card keeps a solid surface, so its frame is drawn with elements. */
  function mountFrame(feature) {
    if (feature.querySelector(':scope>.hud-bits')) return;
    const bits = node('span', 'hud-bits', feature);
    for (const c of ['cut tl', 'cut br', 'brk tr', 'brk bl']) node('i', c, bits);
  }

  /* ── Live clock in the opening rail ──────────────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const rail = document.querySelector('#main .cm-feature .cm-feature-rail');
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
      for (const feature of document.querySelectorAll('#main .cm-feature')) {
        if (!feature.getClientRects().length) continue;
        mountFrame(feature);
        mountRing(feature);
      }
      mountTelemetry();
      const main = document.getElementById('main');
      const view = main?.firstElementChild?.className || '';
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
        if (r.target.closest?.('.hud-telemetry,.hud-reactor,.hud-bits')) continue;
        if (r.addedNodes.length) { schedule(); break; }
      }
    }).observe(app, {childList: true, subtree: true});
    window.addEventListener('resize', schedule);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  document.addEventListener('click', e => {
    const control = e.target.closest?.('#main :is(.btn,button.check)');
    if (!control || control.getAttribute('aria-pressed') === 'true') return;
    const text = (control.textContent + ' ' + (control.getAttribute('aria-label') || '')).trim().toLowerCase();
    if (control.matches('button.check')) burstAt(control, 'LESSON COMPLETE');
    else if (/^(save|complete|finish|mark|done)\b/.test(text)) burstAt(control, 'SAVED');
  }, true);

  function init() {
    root.classList.add('hud-on');
    startField();
    startFrame();
    boot();
    const app = document.getElementById('main');
    if (app) { watchApp(app); schedule(); }
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
