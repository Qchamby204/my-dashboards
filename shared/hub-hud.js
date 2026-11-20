/* Atlas hub HUD. Decorative layer only: it reads the rendered launch cards and
   never changes links, recents or settings. One boot here covers every HUD app. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'atlas-hub' || !window.AtlasHUDCore || window.HubHUD) return;
  window.HubHUD = {replayBoot: () => boot(true)};

  // Opening Atlas counts as every app's boot for this session.
  const BOOT_KEYS = ['atlas:hud-boot', 'lifeledger:hud-boot', 'lifemap:hud-boot', 'forge:hud-boot', 'communicator:hud-boot', 'chef:hud-boot', 'library:hud-boot', 'courier:hud-boot', 'hourglass:hud-boot', 'herald:hud-boot', 'aqueduct:hud-boot', 'operations:hud-boot', 'reminders:hud-boot', 'neural:hud-boot'];
  const hud = window.AtlasHUDCore.engine({title: 'ATLAS', tagline: 'OS 5.0 // COMMAND DECK', caps: true, bootKey: 'atlas:hud-boot', bootKeys: BOOT_KEYS, bootLines: ['Waking the command deck', 'Linking the HUD systems', 'Restoring recent activity', 'All systems nominal']});
  const {node, svgNode, still, pad, started, startField, startFrame, frameTick, buildReactor, paintArcs, boot} = hud;

  /* ── Each HUD app's tile glows in that app's own colour ──────────────────── */
  const SYSTEMS = {
    'life-map.html': '#5ff4ff', 'life-ledger.html': '#5ff4ff', 'workout-forge.html': '#ffd08b',
    'communication-trainer.html': '#abb9ff', 'the-chef.html': '#e8c78b', 'the-library.html': '#8cc8ff', 'courier.html': '#ff8a7a', 'the-hourglass.html': '#ffb347', 'the-herald.html': '#6ff2c8', 'the-aqueduct.html': '#45d8e8', 'operations-cadence.html': '#b6f06a', 'reminders.html': '#d7a6ff', 'neural-map.html': '#a78bfa',
  };
  function tagCards() {
    let online = 0;
    for (const card of document.querySelectorAll('a.hub-card, a.hub-recent')) {
      const file = (card.getAttribute('href') || '').split('?')[0].split('/').pop();
      const hue = SYSTEMS[file];
      if (hue) { card.dataset.hud = 'online'; card.style.setProperty('--tile-raw', hue); if (card.matches('.hub-card')) online++; }
    }
    return online;
  }

  /* ── Command panel: reactor and live telemetry in the greeting card ─────── */
  let heroClock = null;
  function mountHeader(online) {
    const header = document.querySelector('.hub-header');
    if (!header) return;
    if (!header.querySelector(':scope>.hud-reactor')) {
      const svg = buildReactor(header, '');
      header.append(svg);
      const n = Object.keys(SYSTEMS).length;
      paintArcs(svg, Object.values(SYSTEMS).map((color, i) => ({color, pct: 100 - i * (40 / n), letter: ''})).slice(0, 13));
    }
    let tele = header.querySelector('.hud-telemetry');
    if (!tele) {
      tele = node('p', 'hud-telemetry', header);
      node('i', 'hud-live', tele);
      tele.append('LIVE ');
      node('b', '', tele);
      node('span', 'hud-online', tele);
    }
    tele.querySelector('.hud-online').textContent = ' // ' + online + ' HUD SYSTEMS ONLINE';
    heroClock = tele.querySelector('b');
    tick();
  }
  function tick() {
    const now = new Date();
    const clock = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    if (heroClock?.isConnected) heroClock.textContent = clock;
    frameTick(now);
  }

  let pending = 0, mutating = false;
  function decorate() {
    pending = 0; mutating = true;
    try { mountHeader(tagCards()); } finally { mutating = false; }
  }
  const schedule = () => { if (!pending) pending = requestAnimationFrame(decorate); };
  function watchApp() {
    const recents = document.getElementById('hub-recents');
    if (recents) new MutationObserver(() => { if (!mutating) schedule(); }).observe(recents, {childList: true, subtree: true});
  }

  function init() {
    root.classList.add('hud-on');
    startField();
    startFrame();
    boot();
    node('div', 'hud-scan', document.body);
    watchApp(); schedule();
    setInterval(() => { if (!document.hidden) tick(); }, 1000);
    tick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
