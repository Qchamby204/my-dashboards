/* The Hourglass HUD. Decorative layer only: it reads the rendered page and never
   touches dates, milestones, bonds or settings. Everything it adds is aria-hidden and pointer-transparent,
   pauses when the page is hidden, and holds still under reduced motion.
   Shares its engine with shared/hud-core.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root || root.dataset?.atlasApp !== 'the-hourglass' || !window.AtlasHUDCore || window.HourglassHUD) return;
  window.HourglassHUD = {replayBoot: () => boot(true)};

  const hud = window.AtlasHUDCore.engine({title: 'The Hourglass', tagline: 'OS 5.0 // Chronometer', bootKey: 'hourglass:hud-boot', bootLines: ['Calibrating the chronometer', 'Counting your weeks', 'Marking what matters', 'All systems nominal'], tilt: '#app .hourglass-opening'});
  const {node, svgNode, still, pad, started, startExtras, startField, startFrame, frameTick, buildReactor, paintArcs, burstAt, boot} = hud;

  /* ── Life-clock rings: this year lived, and life against the planning horizon ── */
  function clockArcs() {
    const label = document.querySelector('#app .hg-progress-label')?.textContent || '';
    const note = document.querySelector('#app .hg-note')?.textContent || '';
    const year = Number((label.match(/(\d+)%/) || [])[1]);
    const age = Number((label.match(/Age\s+(\d+)/i) || [])[1]);
    const horizon = Number((note.match(/age\s+(\d+)/i) || [])[1]);
    const arcs = [];
    if (age && horizon) arcs.push({color: 'var(--hud-hue)', pct: Math.min(100, 100 * (age + (year || 0) / 100) / horizon), letter: '', label: 'Lifetime', value: 'Age ' + age + ' of ' + horizon});
    if (!Number.isNaN(year) && label) arcs.push({color: '#8cc8ff', pct: year, letter: '', label: 'This year', value: year + '% lived'});
    return arcs.length ? arcs : [{color: 'var(--hud-hue)', pct: 100, letter: ''}];
  }
  function mountRing(hero) {
    const face = hero.querySelector('.hourglass-opening-face');
    const art = face?.querySelector('.hourglass-title-art');
    if (!face || !art) return;
    let svg = face.querySelector(':scope>.hud-reactor');
    if (!svg) { svg = buildReactor(face, ''); face.append(svg); }
    face.classList.add('hud-reactor-host');
    const a = art.getBoundingClientRect(), f = face.getBoundingClientRect();
    if (!a.width) return;
    const size = Math.min(Math.hypot(a.width, a.height) * 1.18, f.width * 1.02, 340);
    Object.assign(svg.style, {width: size + 'px', height: size + 'px', left: (a.left - f.left + (a.width - size) / 2) + 'px', top: (a.top - f.top + (a.height - size) / 2) + 'px'});
    paintArcs(svg, clockArcs());
  }

  /* ── Live clock in the opening rail ──────────────────────────────────────── */
  let heroClock = null;
  function mountTelemetry() {
    const rail = document.querySelector('#app .hourglass-opening .hourglass-opening-rail');
    if (!rail) return;
    let tele = rail.querySelector('.hud-telemetry');
    if (!tele) {
      tele = node('span', 'hud-telemetry', rail);
      node('i', 'hud-live', tele);
      tele.append('T ');
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

  /* ── Life wall: the weeks grid projected as a tilted 3D hologram ──────────
     Reads each week's state from the rendered grid (which stays in place, unseen,
     underneath) and draws it on a plane that leans back as it scrolls into view.
     Lived weeks glow amber, this week is a beam of light, milestones stand as
     pillars, and on first view your years fill in from birth to now. */
  let wall = null;
  function mountWall() {
    const grid = document.querySelector('#app .grid-wrap');
    if (!grid) { wall = null; return; }
    const cells = grid.querySelectorAll('.cell');
    const sig = cells.length + ':' + (grid.querySelector('.cell.now') ? [...cells].indexOf(grid.querySelector('.cell.now')) : -1);
    if (wall && wall.grid === grid && wall.sig === sig) return;
    const host = grid.parentElement;
    host.classList.add('hud-wall-host');
    grid.classList.add('hud-wall-grid');
    let canvas = host.querySelector(':scope>.hud-wall');
    if (!canvas) { canvas = document.createElement('canvas'); canvas.className = 'hud-wall'; canvas.setAttribute('aria-hidden', 'true'); grid.after(canvas); }
    const types = [...cells].map(c => {
      const custom = c.getAttribute('style') && c.style.background;
      if (c.classList.contains('now')) return {t: 'now'};
      if (c.classList.contains('goal')) return {t: 'goal'};
      if (custom) return {t: 'mark', color: c.style.backgroundColor || '#f5a3c7'};
      if (c.classList.contains('mile')) return {t: 'mile'};
      if (c.classList.contains('lived')) return {t: 'lived'};
      if (c.classList.contains('build')) return {t: 'build'};
      return {t: 'free'};
    });
    const first = !wall;
    if (window.IntersectionObserver) new IntersectionObserver(e => { wallVisible = e[0].isIntersecting; kickWall(); }).observe(grid);
    wall = {grid, sig, canvas, types, rows: Math.ceil(types.length / 52), born: first && !still() ? performance.now() : -1e9};
    drawWall();
  }
  let wallRaf = 0, wallLast = 0;
  function drawWall(stamp) {
    wallRaf = 0;
    // Full speed while the years fill in; a gentle 25 frames a second after that.
    if (stamp && wall && stamp - wall.born > 1800 && stamp - wallLast < 40) { if (!still() && wallVisible) wallRaf = requestAnimationFrame(drawWall); return; }
    wallLast = stamp || 0;
    if (!wall || !wall.canvas.isConnected || document.hidden) return;
    const {grid, canvas, types, rows} = wall;
    const box = grid.getBoundingClientRect();
    const w = box.width, h = box.height;
    if (!w || !h) return;
    canvas.style.left = grid.offsetLeft + 'px'; canvas.style.top = grid.offsetTop + 'px';
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // A road of weeks: birth nearest you at the bottom, the years ahead receding to
    // the horizon. Depth eases with the wall's place on screen as you scroll.
    const centre = (box.top + h / 2) / window.innerHeight;
    const depth = still() ? 1.6 : 1.25 + Math.max(0, Math.min(1, centre)) * .8;
    const now = performance.now(), t = now / 1000;
    const grow = Math.min(1, (now - wall.born) / 1800);
    const ink = getComputedStyle(root).getPropertyValue('--hud-hue').trim() || '#ffb347';
    const gutter = 28, span = w - gutter - 10, cellNear = span / 52;
    const yNear = h - 6, rise = h - 22;
    const fAt = v => 1 / (1 + v / rows * depth), fFar = fAt(rows);
    const proj = (u, v) => {
      const f = fAt(v);
      return [gutter + span / 2 + (u - 26) * cellNear * f, yNear - rise * (1 - f) / (1 - fFar), f];
    };
    const nowIndex = types.findIndex(x => x.t === 'now');
    const reach = grow < 1 ? Math.floor(grow * (nowIndex < 0 ? types.length : nowIndex)) : Infinity;
    const draws = [];
    for (let i = types.length - 1; i >= 0; i--) { // far rows first
      const v = Math.floor(i / 52), u = i % 52;
      const [x, y, f] = proj(u + .5, v + .5);
      const s = cellNear * f * .8, sh = Math.max(1, (proj(u + .5, v)[1] - proj(u + .5, v + 1)[1]) * .74);
      let kind = types[i].t;
      if (kind !== 'now' && i > reach && (kind === 'lived' || kind === 'mile' || kind === 'mark')) kind = 'free';
      draws.push([kind, x, y, s, f, types[i].color, sh]);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const [kind, x, y, s, f, , sh] of draws) {
      if (kind === 'free' || kind === 'build') {
        ctx.fillStyle = kind === 'build' ? 'rgba(69,200,216,' + (.12 + .12 * f) + ')' : 'rgba(200,215,255,' + (.07 + .07 * f) + ')';
        ctx.fillRect(x - s / 2, y - sh / 2, s, sh);
      }
    }
    // Lived weeks and markers, then a glow pass.
    ctx.globalCompositeOperation = 'lighter';
    for (const [kind, x, y, s, f, color, sh] of draws) {
      if (kind === 'lived') { ctx.fillStyle = ink; ctx.globalAlpha = .4 + .4 * f; ctx.fillRect(x - s / 2, y - sh / 2, s, sh); }
      else if (kind === 'mile' || kind === 'mark' || kind === 'goal') {
        const c = kind === 'mile' ? '#b591ff' : kind === 'goal' ? '#f0683e' : color;
        ctx.globalAlpha = 1; ctx.fillStyle = c; ctx.fillRect(x - s / 2, y - sh / 2, s, sh);
        // A short pillar of light.
        const g = ctx.createLinearGradient(x, y, x, y - s * 6);
        g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.globalAlpha = .7; ctx.fillRect(x - s * .18, y - s * 6, s * .36, s * 6);
      }
    }
    ctx.globalAlpha = 1;
    // Glow: a blurred copy of what is drawn so far.
    if (!still()) { ctx.filter = 'blur(' + Math.max(2, cellNear * .45) + 'px)'; ctx.globalAlpha = .28; ctx.drawImage(canvas, 0, 0, w, h); ctx.filter = 'none'; ctx.globalAlpha = 1; }
    // This week: a beam rising off the wall with a pulsing ring.
    const here = draws.find(d => d[0] === 'now');
    if (here) {
      const [, x, y, s, , , sh] = here;
      const pulse = still() ? .5 : .5 + .5 * Math.sin(t * 3);
      const beam = ctx.createLinearGradient(x, y, x, y - h * .26);
      beam.addColorStop(0, 'rgba(255,255,255,.95)'); beam.addColorStop(.3, 'rgba(255,214,150,.35)'); beam.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(x - s * 1.4, y); ctx.lineTo(x - s * .25, y - h * .26); ctx.lineTo(x + s * .25, y - h * .26); ctx.lineTo(x + s * 1.4, y); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,' + (.35 + .5 * pulse) + ')'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x, y, s * (1.6 + pulse * 1.6), s * (.7 + pulse * .7), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(x - s / 2, y - sh / 2, s, sh);
    }
    ctx.globalCompositeOperation = 'source-over';
    { const [xl, y] = proj(0, rows), [xr] = proj(52, rows); const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,200,140,0)'); g.addColorStop(.5, 'rgba(255,200,140,.55)'); g.addColorStop(1, 'rgba(255,200,140,0)'); ctx.fillStyle = g; ctx.fillRect(xl - 40, y - 1, xr - xl + 80, 1.5); }
    // Decade labels down the left edge.
    ctx.font = "500 10px 'JetBrains Mono',ui-monospace,monospace"; ctx.fillStyle = 'rgba(255,220,170,.75)'; ctx.textAlign = 'right';
    for (let v = 0; v < rows; v += 10) { const [x, y, f] = proj(0, v + .5); ctx.globalAlpha = .4 + .6 * f; ctx.fillText(String(v), x - 5, y + 3); }
    ctx.globalAlpha = 1;
    // A scan line rides up the wall while it fills.
    if (grow < 1 && nowIndex >= 0) { const v = Math.floor(nowIndex * grow / 52), [xl, y] = proj(0, v), [xr] = proj(52, v); ctx.fillStyle = 'rgba(255,230,190,.7)'; ctx.fillRect(xl, y - 1, xr - xl, 2); }
    if (!still() && wallVisible) wallRaf = requestAnimationFrame(drawWall);
  }
  let wallVisible = true;
  const kickWall = () => { if (!wallRaf && wall) wallRaf = requestAnimationFrame(drawWall); };
  addEventListener('scroll', kickWall, {passive: true});
  addEventListener('resize', kickWall);
  document.addEventListener('visibilitychange', kickWall);

  /* ── Re-attach after every render ────────────────────────────────────────── */
  let pending = 0, mutating = false, lastView = '';
  function decorate() {
    pending = 0; mutating = true;
    try {
      const hero = document.querySelector('#app .hourglass-opening');
      if (hero) mountRing(hero);
      mountTelemetry();
      mountWall();
      const view = hero?.dataset.opening || '';
      const app = document.getElementById('app');
      if (lastView && view !== lastView && app && !still()) {
        app.classList.remove('hud-scan-in'); void app.offsetWidth; app.classList.add('hud-scan-in');
        setTimeout(() => app.classList.remove('hud-scan-in'), 620);
      }
      lastView = view;
    } finally { mutating = false; }
  }
  const schedule = () => { if (!pending) pending = requestAnimationFrame(decorate); };
  function watchApp() {
    const app = document.getElementById('app');
    if (!app) return;
    new MutationObserver(records => {
      if (mutating) return;
      for (const r of records) {
        if (r.target.closest?.('.hud-telemetry,.hud-reactor')) continue;
        if (r.type === 'attributes' || r.addedNodes.length) { schedule(); break; }
      }
    }).observe(app, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-opening']});
    window.addEventListener('resize', schedule);
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.body);
  }

  /* ── Logging feedback: a shockwave from the control you pressed ──────────── */
  document.addEventListener('click', e => {
    const control = e.target.closest?.('#app :is(.btn,button)');
    if (!control || control.closest('.atlas-page-dock,.atlas-header-actions')) return;
    const text = control.textContent.trim().toLowerCase();
    if (/^(save|add|done)\b/.test(text) && control.closest('form,dialog,.modal,[role=dialog]')) burstAt(control, 'Logged');
    else if (control.id === 'makeWall') burstAt(control, 'Rendering');
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
