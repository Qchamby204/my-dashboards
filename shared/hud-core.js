/* Suite HUD engine. One copy of the pieces every HUD app shares: the ambient field,
   the wide-screen frame, the reactor rings with their touch readouts, standby and
   milestone celebrations, lock-on brackets, opening-card tilt, the click flash and the
   boot sequence.
   Each app's own script (shared/<app>-hud.js, atlas/life-map-hud.js) calls
   AtlasHUDCore.engine() with its labels and keeps only its own decorations.
   Everything it adds is aria-hidden and pointer-transparent, pauses when the page
   is hidden, and holds still under reduced motion. It never reads or writes app data. */
(() => {
  'use strict';
  if (window.AtlasHUDCore) return;
  const NS = 'http://www.w3.org/2000/svg';
  // Celebrations only follow something you just did, never a page load or a sync.
  let lastInput = 0;
  for (const type of ['pointerdown', 'keydown']) window.addEventListener?.(type, () => { lastInput = Date.now(); }, {capture: true, passive: true});

  /* cfg:
     title, tagline   frame and boot-screen labels
     caps             true for the older all-caps apps; false keeps sentence case
     bootKey          sessionStorage key checked (and set) so the boot runs once per session
     bootKeys         keys to set instead of just bootKey (the Atlas hub silences every app)
     bootLines        the four boot-screen lines
     accentVars       custom properties read for the field colour, first match wins
     tilt             selector for the opening card that tilts toward the mouse */
  function engine(cfg) {
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const automated = navigator.webdriver === true;
    const still = () => reduce.matches;
    const pad = n => String(n).padStart(2, '0');
    const started = Date.now();
    const caps = !!cfg.caps;
    const say = (upper, sentence) => caps ? upper : sentence;
    const accentVars = cfg.accentVars || ['--hud-hue', '--neo-accent'];

    function node(tag, cls, parent) {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      el.setAttribute('aria-hidden', 'true');
      if (parent) parent.append(el);
      return el;
    }
    function svgNode(tag, attrs, parent) {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
      if (parent) parent.append(el);
      return el;
    }
    function accentRGB() {
      const style = getComputedStyle(root);
      let raw = '';
      for (const name of accentVars) { raw = style.getPropertyValue(name).trim(); if (raw) break; }
      const hex = raw.match(/^#([0-9a-f]{6})$/i);
      if (hex) { const n = parseInt(hex[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(','); }
      return root.dataset.atlasTheme === 'light' ? '0,101,119' : '95,244,255';
    }

    /* ── Ambient field: reactor rings, drifting motes and a scan pass ─────────── */
    function startField() {
      const canvas = node('canvas', 'hud-field');
      document.body.prepend(canvas);
      const ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) return;
      const tau = Math.PI * 2;
      let w = 0, h = 0, dpr = 1, raf = 0, last = 0, rgb = accentRGB();
      let px = 0, py = 0, tx = 0, ty = 0;
      const motes = Array.from({length: 46}, () => ({x: Math.random(), y: Math.random(), s: .3 + Math.random() * .9, r: .6 + Math.random() * 1.4}));
      const rings = [
        {r: 1.00, dash: [1.5, 5], width: 1, speed: .010, a: .30},
        {r: .93, arcs: [[0, .19], [.27, .46], [.58, .9]], width: 2.4, speed: -.035, a: .34},
        {r: .84, ticks: 144, width: 1, speed: .006, a: .28},
        {r: .72, arcs: [[0, .06], [.25, .31], [.5, .56], [.75, .81]], width: 9, speed: .05, a: .12},
        {r: .61, dash: [18, 10], width: 1.2, speed: -.022, a: .22},
        {r: .47, arcs: [[.05, .62]], width: 1.6, speed: .09, a: .30},
        {r: .36, ticks: 48, width: 1, speed: -.04, a: .22},
      ];
      const ink = a => 'rgba(' + rgb + ',' + a + ')';
      function size() {
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        w = window.innerWidth; h = window.innerHeight;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      function draw(time) {
        raf = 0;
        if (document.hidden) return;
        const motion = !still();
        if (motion && time - last < 33) { raf = requestAnimationFrame(draw); return; }
        const dt = last ? Math.min((time - last) / 1000, .1) : 0; last = time;
        const t = motion ? time / 1000 : 0;
        const light = root.dataset.atlasTheme === 'light';
        const fade = light ? .45 : 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        px += (tx - px) * Math.min(1, dt * 3); py += (ty - py) * Math.min(1, dt * 3);
        const wide = w > 900;
        const cx = w * (wide ? .8 : .5) + px * 24, cy = h * (wide ? .3 : .17) + py * 18;
        const R = Math.min(Math.max(w, h) * (wide ? .36 : .62), 720);
        const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.05);
        bloom.addColorStop(0, ink(.10 * fade)); bloom.addColorStop(.55, ink(.035 * fade)); bloom.addColorStop(1, ink(0));
        ctx.fillStyle = bloom; ctx.fillRect(0, 0, w, h);
        for (const ring of rings) {
          const r = R * ring.r, rot = t * ring.speed * tau;
          ctx.lineWidth = ring.width; ctx.strokeStyle = ink(ring.a * fade * .55);
          if (ring.ticks) {
            ctx.beginPath();
            for (let i = 0; i < ring.ticks; i++) {
              const a = rot + tau * i / ring.ticks, len = i % 6 ? 4 : 10;
              ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
              ctx.lineTo(cx + (r + len) * Math.cos(a), cy + (r + len) * Math.sin(a));
            }
            ctx.stroke();
          } else if (ring.arcs) {
            for (const [s, e] of ring.arcs) { ctx.beginPath(); ctx.arc(cx, cy, r, rot + s * tau, rot + e * tau); ctx.stroke(); }
          } else {
            ctx.setLineDash(ring.dash); ctx.lineDashOffset = -rot * r;
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, tau); ctx.stroke(); ctx.setLineDash([]);
          }
        }
        // A travelling blip on the outer ring.
        const blip = t * .35;
        ctx.fillStyle = ink(.7 * fade);
        ctx.beginPath(); ctx.arc(cx + R * Math.cos(blip), cy + R * Math.sin(blip), 2.4, 0, tau); ctx.fill();
        // Motes drift upward and link when they pass close.
        const pts = motes.map(m => {
          if (motion) { m.y -= m.s * dt * .018; if (m.y < -.05) { m.y = 1.05; m.x = Math.random(); } }
          return [m.x * w + px * 10 * m.s, m.y * h + py * 8 * m.s, m.r];
        });
        ctx.lineWidth = .6;
        for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], d = dx * dx + dy * dy;
          if (d < 11000) { ctx.strokeStyle = ink((1 - d / 11000) * .16 * fade); ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke(); }
        }
        for (const [x, y, r] of pts) { ctx.fillStyle = ink(.5 * fade); ctx.beginPath(); ctx.arc(x, y, r, 0, tau); ctx.fill(); }
        // Scan pass every nine seconds.
        if (motion) {
          const sy = ((t / 9) % 1) * (h + 240) - 120;
          const band = ctx.createLinearGradient(0, sy - 90, 0, sy + 2);
          band.addColorStop(0, ink(0)); band.addColorStop(.9, ink(.05 * fade)); band.addColorStop(1, ink(.32 * fade));
          ctx.fillStyle = band; ctx.fillRect(0, sy - 90, w, 92);
          raf = requestAnimationFrame(draw);
        }
      }
      const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
      size(); kick();
      window.addEventListener('resize', () => { size(); last = 0; kick(); });
      document.addEventListener('visibilitychange', () => { last = 0; kick(); });
      reduce.addEventListener?.('change', kick);
      new MutationObserver(() => { rgb = accentRGB(); kick(); }).observe(root, {attributes: true, attributeFilter: ['data-atlas-theme']});
      window.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        tx = e.clientX / w - .5; ty = e.clientY / h - .5;
      }, {passive: true});
    }

    /* ── Screen frame and edge telemetry (wide screens) ──────────────────────── */
    let frameClock = null, frameUptime = null;
    function startFrame() {
      const frame = node('div', 'hud-frame', document.body);
      for (const c of ['tl', 'tr', 'bl', 'br']) node('i', 'hud-frame-corner ' + c, frame);
      node('i', 'hud-frame-rail l', frame); node('i', 'hud-frame-rail r', frame);
      const left = node('div', 'hud-frame-tele l', frame);
      node('b', '', left).textContent = cfg.title;
      node('span', '', left).textContent = cfg.tagline;
      frameClock = node('span', 'hud-frame-clock', left);
      const right = node('div', 'hud-frame-tele r', frame);
      const uplink = node('b', '', right);
      node('i', 'hud-live', uplink);
      uplink.append(say('UPLINK STABLE', 'Uplink stable'));
      node('span', '', right).textContent = say('TELEMETRY // LOCAL', 'Telemetry // local');
      frameUptime = node('span', 'hud-frame-uptime', right);
    }
    // Called from each app's one-second tick.
    function frameTick(now) {
      const clock = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
      if (frameClock) frameClock.textContent = now.getFullYear() + '.' + pad(now.getMonth() + 1) + '.' + pad(now.getDate()) + ' // ' + clock;
      if (frameUptime) { const s = Math.floor((Date.now() - started) / 1000); frameUptime.textContent = say('SESSION ', 'Session ') + pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); }
      return clock;
    }

    /* ── Reactor rings around a hologram or title picture ────────────────────── */
    const ARC = {start: 82, step: 5.2};
    function buildReactor(host, label) {
      const svg = svgNode('svg', {viewBox: '0 0 200 200', class: 'hud-reactor', 'aria-hidden': 'true', focusable: 'false'});
      const outer = svgNode('g', {class: 'hud-rot hud-rot-slow'}, svg);
      svgNode('circle', {cx: 100, cy: 100, r: 97, class: 'hud-ring-dots'}, outer);
      for (const a of [0, 90, 180, 270]) svgNode('path', {d: 'M100 1.5a98.5 98.5 0 0 1 22 2.5', class: 'hud-ring-bracket', transform: 'rotate(' + a + ' 100 100)'}, outer);
      svgNode('circle', {cx: 100, cy: 100, r: 97, class: 'hud-ring-blip-track'}, outer);
      svgNode('circle', {cx: 100, cy: 3, r: 1.8, class: 'hud-ring-blip'}, outer);
      let ticks = '';
      for (let i = 0; i < 90; i++) {
        const a = Math.PI * 2 * i / 90, r1 = 90, r2 = i % 5 ? 92 : 94.5;
        ticks += 'M' + (100 + r1 * Math.sin(a)).toFixed(2) + ' ' + (100 - r1 * Math.cos(a)).toFixed(2) + 'L' + (100 + r2 * Math.sin(a)).toFixed(2) + ' ' + (100 - r2 * Math.cos(a)).toFixed(2);
      }
      const tickRing = svgNode('g', {class: 'hud-rot hud-rot-rev'}, svg);
      svgNode('path', {d: ticks, class: 'hud-ring-ticks'}, tickRing);
      svgNode('g', {class: 'hud-arcs'}, svg);
      const inner = svgNode('g', {class: 'hud-rot hud-rot-fast'}, svg);
      svgNode('circle', {cx: 100, cy: 100, r: 54, class: 'hud-ring-dash'}, inner);
      const sweep = svgNode('g', {class: 'hud-rot hud-rot-sweep'}, svg);
      svgNode('path', {d: 'M100 100 L100 12 A88 88 0 0 1 131 17.6 Z', class: 'hud-sweep'}, sweep);
      if (label) { const tag = svgNode('text', {x: 100, y: 197, class: 'hud-reactor-tag', 'text-anchor': 'middle'}, svg); tag.textContent = label; }
      return svg;
    }
    /* arcs: [{color, pct, letter, label, value, done}]
       label/value feed the touch readout (arcs without a label are not touchable);
       done names the milestone celebrated when that arc reaches 100% after you act. */
    function paintArcs(svg, arcs) {
      const group = svg.querySelector('.hud-arcs');
      const sig = JSON.stringify(arcs);
      if (group.dataset.sig === sig) return;
      const first = !group.dataset.sig;
      const before = svg.hudArcs || [];
      group.dataset.sig = sig;
      group.textContent = '';
      arcs.forEach((arc, i) => {
        const r = ARC.start - i * ARC.step;
        const g = svgNode('g', {style: '--arc:' + arc.color, class: 'hud-arc'}, group);
        svgNode('circle', {cx: 100, cy: 100, r, class: 'hud-arc-track'}, g);
        const fill = svgNode('circle', {cx: 100, cy: 100, r, class: 'hud-arc-fill', pathLength: 100, transform: 'rotate(-90 100 100)', 'stroke-dasharray': (first && !still() ? 0 : arc.pct) + ' 100'}, g);
        if (first && !still()) requestAnimationFrame(() => requestAnimationFrame(() => fill.setAttribute('stroke-dasharray', arc.pct + ' 100')));
        if (arc.letter) { const t = svgNode('text', {x: 96, y: 100 - r + 1.6, class: 'hud-arc-letter', 'text-anchor': 'end'}, g); t.textContent = arc.letter; }
      });
      svg.hudArcs = arcs;
      // Standby: rings with nothing in them yet idle with a slow pulse instead of sitting blank.
      svg.classList.toggle('hud-standby', arcs.length > 0 && arcs.every(a => !(a.pct > 0)));
      if (arcs.some(a => a.label)) attachReadout(svg);
      if (!first && Date.now() - lastInput < 6000) {
        const hit = arcs.find((a, i) => a.done && a.pct >= 99.5 && !((before[i]?.pct || 0) >= 99.5));
        if (hit) celebrate(svg, hit.done, hit.color);
      }
    }

    /* ── Touch readout: tap or hover an arc to lock on and read it ───────────── */
    function readoutAt(host, x, y, label, value, color) {
      let tag = host.querySelector(':scope>.hud-readout');
      if (!tag) { tag = node('div', 'hud-readout', host); node('b', '', tag); node('span', '', tag); }
      tag.firstChild.textContent = label;
      tag.lastChild.textContent = value || '';
      tag.style.setProperty('--arc', color || 'var(--hud-hue)');
      const hw = host.clientWidth, hh = host.clientHeight;
      tag.style.left = Math.max(4, Math.min(hw - 4, x)) + 'px';
      tag.style.top = Math.max(4, Math.min(hh - 4, y)) + 'px';
      tag.classList.toggle('flip', x > hw * .62);
      tag.classList.toggle('below', y < 44);
      tag.classList.add('on');
      return tag;
    }
    function clearReadout(host) {
      host.querySelector(':scope>.hud-readout')?.classList.remove('on');
      host.querySelectorAll('.hud-reactor.hud-locking').forEach(svg => {
        svg.classList.remove('hud-locking');
        svg.querySelectorAll('.hud-arc.is-locked').forEach(g => g.classList.remove('is-locked'));
      });
    }
    function attachReadout(svg) {
      const host = svg.parentElement;
      if (!host || host.hudReadout) return;
      host.hudReadout = true;
      let timer = 0;
      const pick = e => {
        const arcs = svg.hudArcs || [];
        const box = svg.getBoundingClientRect();
        if (!box.width || !arcs.length) return null;
        const unit = box.width / 200;
        const dx = (e.clientX - box.left) / unit - 100, dy = (e.clientY - box.top) / unit - 100;
        const d = Math.hypot(dx, dy);
        const slack = arcs.length === 1 ? 7 : ARC.step / 2 + .4;
        const i = arcs.findIndex((a, n) => a.label && Math.abs(d - (ARC.start - n * ARC.step)) <= slack);
        if (i < 0) return null;
        const hb = host.getBoundingClientRect();
        return {i, arc: arcs[i], x: e.clientX - hb.left, y: e.clientY - hb.top};
      };
      const lock = hit => {
        svg.classList.add('hud-locking');
        svg.querySelectorAll('.hud-arc').forEach((g, n) => g.classList.toggle('is-locked', n === hit.i));
        readoutAt(host, hit.x, hit.y, hit.arc.label, hit.arc.value ?? Math.round(hit.arc.pct) + '%', hit.arc.color);
      };
      host.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const hit = pick(e);
        if (hit) lock(hit); else clearReadout(host);
      }, {passive: true});
      host.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') clearReadout(host); });
      host.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse') return;
        const hit = pick(e);
        if (!hit) return;
        lock(hit);
        clearTimeout(timer); timer = setTimeout(() => clearReadout(host), 2600);
      }, {passive: true});
    }

    /* ── Milestone celebration: flare, shockwave and a tag. No sound, no confetti ── */
    function celebrate(target, label, color) {
      const svg = target.matches?.('.hud-reactor') ? target : target.querySelector?.('.hud-reactor');
      const host = svg?.parentElement || target;
      if (!host?.isConnected) return;
      const hb = host.getBoundingClientRect(), sb = (svg || host).getBoundingClientRect();
      const wave = node('div', 'hud-celebrate', host);
      wave.style.setProperty('--arc', color || 'var(--hud-hue)');
      wave.style.left = sb.left - hb.left + sb.width / 2 + 'px';
      wave.style.top = sb.top - hb.top + sb.height / 2 + 'px';
      wave.style.setProperty('--size', Math.max(sb.width, 80) + 'px');
      if (!still()) { node('i', 'hud-wave', wave); node('i', 'hud-wave b', wave); node('i', 'hud-wave c', wave); }
      const tag = node('span', 'hud-celebrate-tag', wave);
      tag.textContent = label;
      svg?.classList.add('hud-celebrating');
      host.classList.add('hud-celebrate-host');
      setTimeout(() => { wave.remove(); svg?.classList.remove('hud-celebrating'); host.classList.remove('hud-celebrate-host'); }, still() ? 2200 : 1900);
    }

    /* ── Click flash on a saving control; accent tints it to its card ─────────── */
    function burstAt(control, label, accent) {
      if (still()) return;
      const box = control.getBoundingClientRect();
      if (!box.width) return;
      const burst = node('div', 'hud-burst', document.body);
      burst.style.left = box.left + box.width / 2 + 'px';
      burst.style.top = box.top + box.height / 2 + 'px';
      if (accent) burst.style.setProperty('--burst', accent);
      node('i', 'hud-burst-ring', burst); node('i', 'hud-burst-ring b', burst); node('i', 'hud-burst-flash', burst);
      const tag = node('span', 'hud-burst-tag', burst);
      tag.textContent = label;
      setTimeout(() => burst.remove(), 1100);
    }

    /* ── Lock-on: brackets snap to the control you tab to or tap ──────────────── */
    function startLock() {
      if (window.matchMedia('(forced-colors: active)').matches || document.querySelector('.hud-lock')) return;
      const box = node('div', 'hud-lock', document.body);
      for (const c of ['tl', 'tr', 'bl', 'br']) node('i', c, box);
      let target = null, mode = '', timer = 0;
      const FOCUS = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=switch],[tabindex]:not([tabindex="-1"])';
      const TAP = 'button,a[href],summary,[role=button],[role=tab],[role=switch],label';
      const place = () => {
        const r = target?.isConnected ? target.getBoundingClientRect() : null;
        if (!r || !r.width) { hide(); return; }
        // Stay inside the viewport so the brackets can never widen the page.
        const vw = document.documentElement.clientWidth;
        const left = Math.max(0, r.left - 5), right = Math.min(vw, r.right + 5);
        box.style.transform = 'translate(' + left + 'px,' + (r.top - 5) + 'px)';
        box.style.width = Math.max(0, right - left) + 'px'; box.style.height = r.height + 10 + 'px';
      };
      const show = (el, how, ms) => {
        target = el; mode = how;
        box.classList.remove('on'); void box.offsetWidth; place();
        if (target) box.classList.add('on');
        clearTimeout(timer); if (ms) timer = setTimeout(hide, ms);
      };
      const hide = () => { box.classList.remove('on'); target = null; mode = ''; };
      document.addEventListener('focusin', e => {
        const el = e.target.closest?.(FOCUS);
        if (el && !el.closest('.hud-boot') && el.matches(':focus-visible')) show(el, 'focus', 0);
      });
      document.addEventListener('focusout', () => setTimeout(() => {
        if (mode === 'focus' && !document.activeElement?.matches?.(':focus-visible')) hide();
      }, 0));
      document.addEventListener('pointerdown', e => {
        const el = e.target.closest?.(TAP);
        if (el && !el.disabled && !el.closest('.hud-boot')) show(el, 'tap', 560);
      }, {passive: true});
      addEventListener('scroll', () => { if (target) place(); }, {passive: true, capture: true});
      addEventListener('resize', () => { if (target) place(); });
    }

    /* ── Depth: the opening card tilts toward a mouse; layers part slightly ────── */
    function startTilt(selector) {
      if (!selector || automated) return;
      const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
      let card = null, raf = 0, x = 0, y = 0;
      const reset = c => { c.classList.remove('hud-tilting'); for (const v of ['--tilt-x', '--tilt-y', '--depth-x', '--depth-y']) c.style.removeProperty(v); };
      const apply = () => {
        raf = 0;
        if (!card) return;
        card.classList.add('hud-tilt', 'hud-tilting');
        card.style.setProperty('--tilt-x', (-y * 3).toFixed(2) + 'deg');
        card.style.setProperty('--tilt-y', (x * 4).toFixed(2) + 'deg');
        card.style.setProperty('--depth-x', (x * 12).toFixed(1) + 'px');
        card.style.setProperty('--depth-y', (y * 9).toFixed(1) + 'px');
      };
      document.addEventListener('pointermove', e => {
        const next = e.pointerType === 'mouse' && fine.matches && !still() ? e.target.closest?.(selector) : null;
        if (next !== card) { if (card) reset(card); card = next; }
        if (!card) return;
        const r = card.getBoundingClientRect();
        x = (e.clientX - r.left) / r.width - .5; y = (e.clientY - r.top) / r.height - .5;
        if (!raf) raf = requestAnimationFrame(apply);
      }, {passive: true});
      document.documentElement.addEventListener('pointerleave', () => { if (card) { reset(card); card = null; } });
      reduce.addEventListener?.('change', () => { if (card) { reset(card); card = null; } });
    }
    // Lock-on everywhere, plus tilt on the app's opening card.
    function startExtras() { startLock(); startTilt(cfg.tilt); }

    /* ── Boot sequence: once per session, skipped for reduced motion ─────────── */
    function boot(force) {
      if (!force) {
        if (still() || automated) return;
        try {
          if (sessionStorage.getItem(cfg.bootKey)) return;
          for (const k of cfg.bootKeys || [cfg.bootKey]) sessionStorage.setItem(k, '1');
        } catch { return; }
      }
      const shell = node('div', 'hud-boot', document.body);
      shell.innerHTML =
        '<svg viewBox="0 0 200 200" class="hud-boot-core">' +
        '<circle cx="100" cy="100" r="92" class="b1"/><circle cx="100" cy="100" r="78" class="b2"/>' +
        '<circle cx="100" cy="100" r="62" class="b3"/><circle cx="100" cy="100" r="44" class="b4"/>' +
        '<circle cx="100" cy="100" r="18" class="b5"/></svg>' +
        '<div class="hud-boot-copy"><b></b><ol></ol></div>';
      shell.querySelector('.hud-boot-copy b').textContent = cfg.title;
      const list = shell.querySelector('ol');
      const lines = cfg.bootLines || [];
      // Time the sequence from the first frame the screen can actually show.
      requestAnimationFrame(() => lines.forEach((text, i) => setTimeout(() => {
        const li = document.createElement('li');
        li.innerHTML = '<span></span><em></em>';
        li.firstChild.textContent = text;
        li.lastChild.textContent = i === lines.length - 1 ? say('ONLINE', 'Online') : 'OK';
        list.append(li);
      }, 120 + i * 220)));
      const finish = () => { if (shell.classList.contains('out')) return; shell.classList.add('out'); setTimeout(() => shell.remove(), 520); };
      shell.addEventListener('pointerdown', finish);
      requestAnimationFrame(() => setTimeout(finish, 1450));
    }

    return {root, reduce, automated, still, pad, started, node, svgNode, accentRGB, startField, startFrame, frameTick, buildReactor, paintArcs, readoutAt, clearReadout, celebrate, burstAt, startExtras, boot};
  }

  window.AtlasHUDCore = {engine};
})();
