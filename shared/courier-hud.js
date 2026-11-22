/* The Courier HUD. Decorative layer only: it reads the rendered page and the
   audio element's play state; it never touches playback, editions or history. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'courier' || !window.AtlasHUDCore || window.CourierHUD) return;
  window.CourierHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'The Courier', tagline: 'OS 5.0 // Broadcast channel', bootKey: 'courier:hud-boot', bootLines: ['Tuning the frequency', 'Loading today\'s edition', 'Syncing your listening', 'All systems nominal'], tilt: '#courier-opening'});
  const {node, svgNode, still, pad, started, startExtras, startField, startFrame, frameTick, buildReactor, paintArcs, burstAt, boot} = hud;

  /* ── Reactor around the headphones: edition progress, faster while on air ── */
  function editionArcs() {
    const m = (document.querySelector('#editionProgress .courier-progress-caption')?.textContent || '').match(/(\d+)\s+of\s+(\d+)/);
    return [{color: 'var(--hud-hue)', pct: m && Number(m[2]) ? 100 * Number(m[1]) / Number(m[2]) : 0, letter: '', label: "Today's edition", value: m ? m[1] + ' of ' + m[2] + ' sections heard' : 'Not started', done: 'Edition finished', scene: true}];
  }
  function mountRing(hero) {
    const face = hero.querySelector('.courier-opening-face');
    const art = face?.querySelector('.courier-title-art');
    if (!face || !art) return;
    let svg = face.querySelector(':scope>.hud-reactor');
    if (!svg) { svg = buildReactor(face, ''); face.append(svg); }
    face.classList.add('hud-reactor-host');
    const a = art.getBoundingClientRect(), f = face.getBoundingClientRect();
    if (!a.width) return;
    const size = Math.min(a.height * 1.2, a.width * 1.05, f.width * .92);
    Object.assign(svg.style, {width: size + 'px', height: size + 'px', left: (a.left - f.left + (a.width - size) / 2) + 'px', top: (a.top - f.top + (a.height - size) / 2) + 'px'});
    paintArcs(svg, editionArcs());
  }

  /* ── Rail telemetry: live clock, and an ON AIR meter while audio plays ───── */
  let heroClock = null;
  function mountTelemetry() {
    const rail = document.querySelector('#courier-opening .courier-opening-rail');
    if (!rail) return;
    let tele = rail.querySelector('.hud-telemetry');
    if (!tele) {
      tele = node('span', 'hud-telemetry', rail);
      const eq = node('span', 'hud-eq', tele);
      for (let i = 0; i < 5; i++) node('i', '', eq);
      node('i', 'hud-live', tele);
      node('em', 'hud-air', tele).textContent = 'Live';
      node('b', '', tele);
    }
    heroClock = tele.querySelector('b');
    tick();
  }
  function syncAir() {
    const audio = document.getElementById('audio');
    const on = !!audio && !audio.paused && !audio.ended;
    root.classList.toggle('hud-on-air', on);
    const air = document.querySelector('#courier-opening .hud-air');
    if (air) air.textContent = on ? 'On air' : 'Live';
  }
  function tick() {
    const now = new Date();
    const clock = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    if (heroClock?.isConnected) heroClock.textContent = clock;
    frameTick(now);
  }

  /* ── Re-attach after every render ────────────────────────────────────────── */
  let pending = 0, mutating = false;
  function decorate() {
    pending = 0; mutating = true;
    try {
      const hero = document.getElementById('courier-opening');
      if (hero) mountRing(hero);
      mountTelemetry();
      syncAir();
    } finally { mutating = false; }
  }
  const schedule = () => { if (!pending) pending = requestAnimationFrame(decorate); };
  function watchApp() {
    const targets = [document.getElementById('courier-opening'), document.querySelector('main')].filter(Boolean);
    const mo = new MutationObserver(records => {
      if (mutating) return;
      for (const r of records) {
        if (r.target.closest?.('.hud-telemetry,.hud-reactor')) continue;
        if (r.addedNodes.length || r.type === 'characterData') { schedule(); break; }
      }
    });
    for (const t of targets) mo.observe(t, {childList: true, subtree: true, characterData: true});
    const audio = document.getElementById('audio');
    if (audio) for (const ev of ['play', 'playing', 'pause', 'ended', 'emptied']) audio.addEventListener(ev, syncAir);
    window.addEventListener('resize', schedule);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  document.addEventListener('click', e => {
    const control = e.target.closest?.('#courier-opening #playAll, .block [data-act="play"], #shortListen');
    if (!control) return;
    const audio = document.getElementById('audio');
    if (control.matches('[data-act="play"]') && audio && !audio.paused && control.closest('.block.active')) return;
    burstAt(control, control.id === 'shortListen' ? 'Queue built' : 'On air');
  }, true);

  function init() {
    root.classList.add('hud-on');
    startField();
    startExtras();
    // Pages sweep in, cards build in, figures decode, bars fill (shared/hud-core.js).
    hud.native({scope: 'main', bars: '.courier-progress-track>span'});
    startFrame();
    boot();
    node('div', 'hud-scan', document.body);
    watchApp(); schedule();
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
