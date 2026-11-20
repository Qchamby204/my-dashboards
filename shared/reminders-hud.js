/* Reminders HUD. Decorative layer only: it reads the rendered schedule and never
   touches saved reminders, push delivery or the pairing. Text keeps sentence case (no forced caps). Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'reminders' || !window.AtlasHUDCore || window.RemindersHUD) return;
  window.RemindersHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'Reminders', tagline: 'OS 5.0 // Signal timing', caps: false, bootKey: 'reminders:hud-boot', bootLines: ['Reading your rhythm', 'Setting the quiet hours', 'Checking delivery', 'All systems nominal']});
  const {node, svgNode, still, pad, started, startExtras, startField, startFrame, frameTick, buildReactor, paintArcs, burstAt, boot, readoutAt, clearReadout} = hud;

  /* ── Day dial: a 24-hour face with each reminder at its time ───────────── */
  const DIAL_HUES = ['#ffd08b', '#8cc8ff', '#6ff2c8', '#ffa6d1', '#b6f06a', '#ffb347'];
  function toMinutes(text) {
    const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i.exec(String(text || '').trim());
    if (!m) return null;
    let h = Number(m[1]) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return h * 60 + Number(m[2] || 0);
  }
  function fieldMinutes(field) {
    const f = document.querySelector('[data-time-field="' + field + '"]');
    if (!f) return null;
    const v = p => f.querySelector('[data-time-part="' + p + '"]')?.value || '';
    return toMinutes(v('hour') + ':' + (v('minute') || '00').padStart(2, '0') + ' ' + v('period'));
  }
  const polar = (min, r) => { const a = (min / 1440) * Math.PI * 2 - Math.PI / 2; return [100 + r * Math.cos(a), 100 + r * Math.sin(a)]; };
  function arcPath(from, to, r) {
    const span = ((to - from) + 1440) % 1440;
    const [x1, y1] = polar(from, r), [x2, y2] = polar(from + span, r);
    return 'M' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + (span > 720 ? 1 : 0) + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2);
  }
  let dialHand = null;
  function mountDial() {
    const head = document.querySelector('main>header');
    if (!head) return;
    let svg = head.querySelector(':scope>.hud-dial');
    if (!svg) {
      svg = svgNode('svg', {class: 'hud-dial', viewBox: '0 0 200 200', 'aria-hidden': 'true', focusable: 'false'}, head);
      head.classList.add('hud-dial-host');
    }
    svg.replaceChildren();
    svgNode('circle', {cx: 100, cy: 100, r: 92, class: 'hud-dial-rim'}, svg);
    svgNode('circle', {cx: 100, cy: 100, r: 70, class: 'hud-dial-inner'}, svg);
    const ticks = svgNode('g', {class: 'hud-dial-ticks'}, svg);
    for (let h = 0; h < 24; h++) {
      const [x1, y1] = polar(h * 60, h % 6 ? 84 : 78), [x2, y2] = polar(h * 60, 90);
      svgNode('line', {x1, y1, x2, y2, class: h % 6 ? '' : 'major'}, ticks);
    }
    [['0', 0], ['6', 360], ['12', 720], ['18', 1080]].forEach(([t, m]) => { const [x, y] = polar(m, 62); const n = svgNode('text', {x, y: y + 3.5, 'text-anchor': 'middle', class: 'hud-dial-num'}, svg); n.textContent = t; });
    const qs = fieldMinutes('quiet-start'), qe = fieldMinutes('quiet-end');
    if (qs != null && qe != null && qs !== qe) svgNode('path', {d: arcPath(qs, qe, 76), class: 'hud-dial-quiet'}, svg);
    const paused = document.getElementById('paused')?.checked;
    const pins = [];
    [...document.querySelectorAll('#list .reminder')].forEach((r, i) => {
      const min = toMinutes(r.querySelector('.reminder-time')?.textContent);
      if (min == null) return;
      pins.push({min, color: DIAL_HUES[i % DIAL_HUES.length], label: (r.querySelector('h3')?.textContent || 'Reminder').trim(), value: (r.querySelector('.reminder-time')?.textContent || '').trim()});
      const on = r.querySelector('[data-field="enabled"]')?.checked !== false && !paused;
      const color = DIAL_HUES[i % DIAL_HUES.length];
      const [x1, y1] = polar(min, 70), [x2, y2] = polar(min, 92);
      svgNode('line', {x1, y1, x2, y2, class: 'hud-dial-mark' + (on ? '' : ' off'), stroke: color}, svg);
      const [cx, cy] = polar(min, 92);
      svgNode('circle', {cx, cy, r: on ? 4 : 3, class: 'hud-dial-pin' + (on ? '' : ' off'), fill: on ? color : 'none', stroke: color}, svg);
    });
    svg.hudPins = pins;
    if (!head.hudReadout) {
      head.hudReadout = true;
      let timer = 0;
      const pick = e => {
        const box = svg.getBoundingClientRect();
        if (!box.width) return null;
        const unit = box.width / 200, dx = (e.clientX - box.left) / unit - 100, dy = (e.clientY - box.top) / unit - 100;
        if (Math.hypot(dx, dy) < 60 || Math.hypot(dx, dy) > 104) return null;
        const at = ((Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI * 2) * 1440 + 1440) % 1440;
        let best = null;
        for (const pin of svg.hudPins || []) { const gap = Math.min(Math.abs(pin.min - at), 1440 - Math.abs(pin.min - at)); if (gap < 50 && (!best || gap < best.gap)) best = {...pin, gap}; }
        if (!best) return null;
        const hb = head.getBoundingClientRect(), [px, py] = polar(best.min, 92);
        return {...best, x: box.left - hb.left + px * unit, y: box.top - hb.top + py * unit};
      };
      const show = e => { const hit = pick(e); if (hit) readoutAt(head, hit.x, hit.y, hit.label, hit.value, hit.color); else clearReadout(head); return hit; };
      head.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') show(e); }, {passive: true});
      head.addEventListener('pointerleave', () => clearReadout(head));
      head.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && show(e)) { clearTimeout(timer); timer = setTimeout(() => clearReadout(head), 2600); } }, {passive: true});
    }
    dialHand = svgNode('line', {x1: 100, y1: 100, x2: 100, y2: 30, class: 'hud-dial-hand'}, svg);
    svgNode('circle', {cx: 100, cy: 100, r: 3.5, class: 'hud-dial-hub'}, svg);
    paintHand();
  }
  function paintHand() {
    if (!dialHand?.isConnected) return;
    const now = new Date(), [x, y] = polar(now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60, 66);
    dialHand.setAttribute('x2', x.toFixed(2)); dialHand.setAttribute('y2', y.toFixed(2));
  }

  /* ── Live clock under the title ──────────────────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const head = document.querySelector('main>header');
    if (!head) return;
    let tele = head.querySelector('.hud-telemetry');
    if (!tele) {
      tele = node('p', 'hud-telemetry', head);
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
    if (now.getSeconds() === 0) paintHand();
  }

  /* ── Re-attach after every render ────────────────────────────────────────── */
  let pending = 0, mutating = false;
  function decorate() {
    pending = 0; mutating = true;
    try { mountDial(); mountTelemetry(); } finally { mutating = false; }
  }
  const schedule = () => { if (!pending) pending = requestAnimationFrame(decorate); };
  function watchApp() {
    const app = document.querySelector('main');
    if (!app) return;
    new MutationObserver(records => {
      if (mutating) return;
      for (const r of records) {
        if (r.target.closest?.('.hud-telemetry,.hud-dial,#feedback,#status,#history')) continue;
        if (r.addedNodes.length || r.type === 'characterData') { schedule(); break; }
      }
    }).observe(app, {childList: true, subtree: true, characterData: true});
    app.addEventListener('change', schedule);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  document.addEventListener('click', e => {
    const control = e.target.closest?.('main button');
    if (!control) return;
    const text = control.textContent.trim().toLowerCase();
    if (/^(add reminder|save)/.test(text)) burstAt(control, /^add/.test(text) ? 'Added' : 'Saved');
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
