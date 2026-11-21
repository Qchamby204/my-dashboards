/* Life Ledger HUD. Decorative layer only: it reads the rendered page and never
   touches Ledger records. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.atlasApp !== 'life-ledger' || !window.AtlasHUDCore || window.LedgerHUD) return;
  window.LedgerHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'Life Ledger', tagline: 'OS 5.0 // Value matrix online', bootKey: 'lifeledger:hud-boot', bootLines: ['Calibrating value matrix', 'Restoring check-in state', 'Projecting hologram', 'All systems nominal'], accentVars: ['--neo-accent'], tilt: '.ledger-opening'});
  const {node, svgNode, still, pad, started, startExtras, startField, startFrame, frameTick, buildReactor, paintArcs, boot} = hud;

  /* ── Reactor rings around the hologram ───────────────────────────────────── */
  function mountReactor(host, arcs, label) {
    const canvas = host.querySelector('.ledger-projector');
    if (!canvas) return;
    let svg = host.querySelector(':scope>.hud-reactor');
    if (!svg) { svg = buildReactor(host, label); host.append(svg); }
    host.classList.add('hud-reactor-host');
    const place = () => {
      if (!canvas.isConnected) return;
      Object.assign(svg.style, {left: canvas.offsetLeft + 'px', top: canvas.offsetTop + 'px', width: canvas.offsetWidth + 'px', height: canvas.offsetHeight + 'px'});
    };
    place(); requestAnimationFrame(place);
    paintArcs(svg, arcs);
  }
  function todayArcs() {
    return [...document.querySelectorAll('#ledger-view-today .ledger-value-jump')].map(b => ({
      color: b.style.getPropertyValue('--ledger-value').trim() || 'var(--neo-accent)',
      pct: Math.max(0, Math.min(100, parseFloat(b.style.getPropertyValue('--value-done')) || 0)),
      letter: (b.querySelector('span')?.textContent || '').trim().charAt(0).toUpperCase(),
      label: (b.querySelector('span')?.textContent || '').trim(),
      value: (b.textContent.match(/(\d+)\s*\/\s*(\d+)/) || []).slice(1).join(' of ') + ' done',
      done: (b.querySelector('span')?.textContent || 'Value').trim() + ' complete',
    }));
  }

  /* ── Live readouts inside the check-in card ──────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const title = document.querySelector('#ledger-view-today .ledger-day-title');
    if (!title || title.querySelector('.hud-telemetry')) { heroClock = title?.querySelector('.hud-telemetry b') || heroClock; return; }
    const tele = node('div', 'hud-telemetry', title);
    node('i', 'hud-live', tele);
    tele.append('Live ');
    heroClock = node('b', '', tele);
    node('span', 'hud-sync', tele).textContent = ' // Sync OK';
    tick();
  }
  function tick() {
    const now = new Date();
    const clock = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    if (heroClock?.isConnected) heroClock.textContent = clock;
    frameTick(now);
  }

  /* ── Holographic stage under each activity's art ─────────────────────────── */
  function mountHolo() {
    for (const art of document.querySelectorAll('#ledger-log .ledger-card-art')) {
      if (art.querySelector(':scope>.hud-holo')) continue;
      const holo = node('span', 'hud-holo', art);
      node('i', 'hud-holo-beam', holo); node('i', 'hud-holo-pad', holo); node('i', 'hud-holo-pad b', holo);
    }
  }

  /* ── Re-attach after every Ledger render ─────────────────────────────────── */
  let pending = 0, mutating = false;
  function decorate() {
    pending = 0; mutating = true;
    try {
      const today = document.getElementById('ledger-today-readout');
      if (today && !today.closest('[hidden]')) mountReactor(today, todayArcs());
      const award = document.getElementById('ledger-achievement-readout');
      if (award && !award.closest('[hidden]')) {
        const frac = Math.max(0, Math.min(1, Number(award.dataset.fraction) || 0));
        mountReactor(award, [{color: 'var(--hud-amber)', pct: frac * 100, letter: '', label: 'Next award', value: Math.round(frac * 100) + '% of the way', done: 'Award unlocked', scene: true}], '');
      }
      mountTelemetry();
      mountHolo();
    } finally { mutating = false; }
  }
  const schedule = () => { if (!pending) pending = requestAnimationFrame(decorate); };

  function watchApp(app) {
    new MutationObserver(records => {
      if (mutating) return;
      for (const r of records) {
        if (r.type === 'attributes') {
          const card = r.target;
          if (card.classList?.contains('ledger-habit-card') && card.getAttribute('aria-hidden') === 'false' && !still()) {
            card.classList.remove('hud-materialize'); void card.offsetWidth; card.classList.add('hud-materialize');
            setTimeout(() => card.classList.remove('hud-materialize'), 520);
          }
          continue;
        }
        if ([...r.addedNodes].some(n => n.nodeType === 1 && !n.matches?.('.hud-reactor,.hud-telemetry,.hud-holo'))) { schedule(); break; }
        if (r.target.nodeType === 1 && !r.target.closest?.('.hud-telemetry,.hud-reactor,.hud-holo') && r.addedNodes.length) { schedule(); break; }
      }
    }).observe(app, {childList: true, subtree: true, attributes: true, attributeFilter: ['aria-hidden', 'hidden']});
    // Switching tabs only toggles hidden; reactors need measuring once visible.
    app.addEventListener('click', e => { if (e.target.closest('.ledger-nav button,.ledger-value-jump,[data-view]')) schedule(); });
    window.addEventListener('resize', schedule);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  function burstAt(control) {
    if (still()) return;
    const box = control.getBoundingClientRect();
    if (!box.width) return;
    const card = control.closest('.ledger-habit-card,.row');
    const accent = card ? getComputedStyle(card).getPropertyValue('--ledger-card-accent').trim() || getComputedStyle(card).getPropertyValue('--ledger-list-accent').trim() : '';
    const xp = (card?.querySelector('.ledger-card-xp strong')?.textContent || '').trim();
    const burst = node('div', 'hud-burst', document.body);
    burst.style.left = box.left + box.width / 2 + 'px';
    burst.style.top = box.top + box.height / 2 + 'px';
    if (accent) burst.style.setProperty('--burst', accent);
    node('i', 'hud-burst-ring', burst); node('i', 'hud-burst-ring b', burst); node('i', 'hud-burst-flash', burst);
    const tag = node('span', 'hud-burst-tag', burst);
    tag.textContent = 'Logged' + (xp ? '  ' + xp : '');
    setTimeout(() => burst.remove(), 1100);
  }
  document.addEventListener('click', e => {
    const control = e.target.closest?.('#ledger-log [data-act="toggle"]');
    if (control && control.getAttribute('aria-pressed') !== 'true') burstAt(control);
  }, true);

  /* ── Habit beams: marking a habit done fires light from the card to its value's
     star, which flares, then on into the projector core. Only fires when the value's
     count actually rises; reads the page and changes nothing. */
  const valueTile = name => [...document.querySelectorAll('#ledger-view-today .ledger-value-jump')].find(b => (b.querySelector('span')?.textContent || '').trim() === name);
  const doneCount = tile => Number((tile?.textContent.match(/(\d+)\s*\/\s*\d+/) || [])[1] || 0);
  function fireBeam(from, tile) {
    const color = tile.style.getPropertyValue('--ledger-value').trim() || 'var(--hud-hue)';
    tile.classList.remove('hud-value-hit'); void tile.offsetWidth; tile.classList.add('hud-value-hit');
    setTimeout(() => tile.classList.remove('hud-value-hit'), 1400);
    if (still()) return;
    const to = tile.getBoundingClientRect();
    const core = document.querySelector('#ledger-today-readout .ledger-projector')?.getBoundingClientRect();
    const W = innerWidth, H = innerHeight;
    const clampY = y => Math.max(8, Math.min(H - 8, y));
    const a = [from.left + from.width / 2, clampY(from.top + from.height / 2)];
    const b = [to.left + to.width / 2, clampY(to.top + to.height / 2)];
    const svg = svgNode('svg', {class: 'hud-beam', viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true'});
    svg.style.setProperty('--beam', color);
    const bend = (x1, y1, x2, y2) => 'M' + x1 + ' ' + y1 + ' Q' + ((x1 + x2) / 2 + (x1 < x2 ? -60 : 60)) + ' ' + Math.min(y1, y2) + ' ' + x2 + ' ' + y2;
    const legs = [bend(a[0], a[1], b[0], b[1])];
    if (core && core.width) legs.push(bend(b[0], b[1], core.left + core.width / 2, clampY(core.top + core.height / 2)));
    legs.forEach((d, i) => {
      const glow = svgNode('path', {d, class: 'hud-beam-glow', pathLength: 100}, svg);
      const line = svgNode('path', {d, class: 'hud-beam-line', pathLength: 100}, svg);
      for (const n of [glow, line]) n.style.animationDelay = (i * .55) + 's';
    });
    document.body.append(svg);
    setTimeout(() => svg.remove(), 1700);
  }
  function watchBeams() {
    document.addEventListener('click', e => {
      const btn = e.target.closest?.('#ledger-log .ledger-habit-card .btn.tap');
      if (!btn || btn.getAttribute('aria-pressed') === 'true') return;
      const card = btn.closest('.ledger-habit-card');
      const name = (card.querySelector('.ledger-card-value, .eyebrow')?.textContent || '').trim();
      const tile = valueTile(name);
      if (!tile) return;
      const before = doneCount(tile), from = btn.getBoundingClientRect();
      setTimeout(() => { const now = valueTile(name); if (now && doneCount(now) > before) fireBeam(from, now); }, 120);
    }, true);
  }

  function init() {
    root.classList.add('hud-on');
    startField();
    startExtras();
    startFrame();
    boot();
    const app = document.getElementById('app');
    if (app) { watchApp(app); schedule(); }
    watchBeams();
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
