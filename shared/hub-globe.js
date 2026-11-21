/* Atlas command globe. A rotating 3D hologram drawn on a plain 2D canvas (no
   libraries): a wireframe sphere around a pulsing core, with every HUD app as a
   node on its own tilted orbit, linked to the core by light. Hover or tap a node
   to see its name; tap it (or click) to open that app. Drag to spin. It reads the
   Atlas tiles for names, links and colours and changes nothing. The tiles stay
   the accessible way in; the canvas is aria-hidden. Holds still under reduced
   motion and pauses when hidden or off screen. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset?.atlasApp !== 'atlas-hub' || window.AtlasGlobe) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;

  function systems() {
    const seen = new Set(), out = [];
    for (const card of document.querySelectorAll('a.hub-card[data-hud]')) {
      const href = card.getAttribute('href') || '';
      const file = href.split('?')[0].split('/').pop();
      if (seen.has(file)) continue;
      seen.add(file);
      out.push({href, name: (card.querySelector('h3')?.textContent || file).trim(), color: card.style.getPropertyValue('--tile-raw').trim() || '#5ff4ff'});
    }
    return out;
  }
  const rgba = (hex, a) => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return 'rgba(95,244,255,' + a + ')';
    const n = parseInt(m[1], 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  };

  function mount(host) {
    if (host.querySelector(':scope>.hud-globe')) return;
    const list = systems();
    if (!list.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'hud-globe';
    wrap.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    const tag = document.createElement('div');
    tag.className = 'hud-globe-tag';
    wrap.append(canvas, tag);
    host.append(wrap);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Three orbits at different tilts; apps are dealt round them.
    const ORBITS = [{r: 1.38, tilt: .42, roll: .2, speed: .16}, {r: 1.62, tilt: -.58, roll: -.35, speed: -.11}, {r: 1.86, tilt: .18, roll: .9, speed: .08}];
    // Deal apps round the three orbits, evenly spaced on each.
    const counts = [0, 0, 0], totals = [0, 1, 2].map(k => list.filter((_, i) => i % 3 === k).length);
    const nodes = list.map((s, i) => { const k = i % 3, j = counts[k]++; return {...s, orbit: ORBITS[k], phase: j / totals[k] * TAU + k * .9, pulse: Math.random()}; });
    const stars = Array.from({length: 70}, () => ({x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + .2, tw: Math.random() * TAU}));

    let glow = null;
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, t = 0, yaw = 0, spin = 0, visible = true, hover = null, drag = null, placed = [];
    // The greeting card stays dark in both themes, so the globe keeps its bright ink.
    const isLight = () => false;
    function size() {
      const box = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box.width; h = box.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    }
    // Rotate a point about Y (yaw) then X (pitch) and project with perspective.
    const PITCH = -.34;
    function project(x, y, z, cx, cy, R) {
      const cyw = Math.cos(yaw), syw = Math.sin(yaw);
      let X = x * cyw + z * syw, Z = -x * syw + z * cyw, Y = y;
      const cp = Math.cos(PITCH), sp = Math.sin(PITCH);
      const Y2 = Y * cp - Z * sp, Z2 = Y * sp + Z * cp;
      const f = 3.4 / (3.4 - Z2);
      return [cx + X * R * f, cy + Y2 * R * f, Z2, f];
    }
    function orbitPoint(o, a) {
      // Circle in its own plane, tilted about X then rolled about Z.
      let x = Math.cos(a) * o.r, y = 0, z = Math.sin(a) * o.r;
      const ct = Math.cos(o.tilt), st = Math.sin(o.tilt);
      [y, z] = [y * ct - z * st, y * st + z * ct];
      const cr = Math.cos(o.roll), sr = Math.sin(o.roll);
      [x, y] = [x * cr - y * sr, x * sr + y * cr];
      return [x, y, z];
    }
    function draw(time) {
      raf = 0;
      if (document.hidden || !visible) return;
      const motion = !reduce.matches;
      const dt = last ? Math.min((time - last) / 1000, .05) : 0; last = time;
      if (motion) { t += dt; if (!drag) yaw += (dt * .22) + spin; spin *= .93; }
      const light = isLight();
      const ink = light ? '#0b6f86' : '#5ff4ff';
      const cx = w / 2, cy = h / 2, R = Math.min(w * .19, h * .22);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // Stars.
      for (const s of stars) {
        ctx.fillStyle = rgba(light ? '#0b6f86' : '#bff8ff', (.25 + .35 * Math.sin(t * 1.3 + s.tw) ** 2) * (light ? .5 : 1));
        ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, TAU); ctx.fill();
      }
      // Core glow.
      const pulse = .5 + .5 * Math.sin(t * 2.2);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.25);
      g.addColorStop(0, rgba(ink, light ? .38 : .7)); g.addColorStop(.25, rgba(ink, .22 + pulse * .12)); g.addColorStop(1, rgba(ink, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, TAU); ctx.fill();
      ctx.fillStyle = light ? '#e8fbff' : '#ffffff';
      ctx.beginPath(); ctx.arc(cx, cy, R * (.09 + pulse * .02), 0, TAU); ctx.fill();
      // Wireframe sphere: latitudes and meridians, back half dimmer.
      ctx.lineWidth = 1;
      const seg = 48;
      const stroke = pts => {
        for (let i = 1; i < pts.length; i++) {
          const [x1, y1, z1] = pts[i - 1], [x2, y2, z2] = pts[i];
          ctx.strokeStyle = rgba(ink, (z1 + z2) / 2 > 0 ? (light ? .42 : .45) : (light ? .12 : .13));
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
      };
      for (let lat = -3; lat <= 3; lat++) {
        const phi = lat / 3.6 * (Math.PI / 2), ry = Math.sin(phi), rr = Math.cos(phi), pts = [];
        for (let i = 0; i <= seg; i++) { const a = i / seg * TAU; pts.push(project(Math.cos(a) * rr, ry, Math.sin(a) * rr, cx, cy, R)); }
        stroke(pts);
      }
      for (let m = 0; m < 10; m++) {
        const a = m / 10 * Math.PI, pts = [];
        for (let i = 0; i <= seg; i++) { const b = i / seg * TAU; pts.push(project(Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a), cx, cy, R)); }
        stroke(pts);
      }
      // Orbits.
      for (const o of ORBITS) {
        const pts = [];
        for (let i = 0; i <= 96; i++) { const [x, y, z] = orbitPoint(o, i / 96 * TAU); pts.push(project(x, y, z, cx, cy, R)); }
        ctx.setLineDash([2, 5]); stroke(pts); ctx.setLineDash([]);
      }
      // Nodes, far ones first.
      placed = nodes.map(n => {
        const [x, y, z] = orbitPoint(n.orbit, n.phase + t * n.orbit.speed);
        const [px, py, pz, f] = project(x, y, z, cx, cy, R);
        return {n, px, py, pz, f};
      }).sort((a, b) => a.pz - b.pz);
      // Pick labels first (hovered, then nearest), so the closest names win any overlap.
      const labels = [], named = new Set();
      for (const p of placed.slice().sort((a, b) => (b.n === hover) - (a.n === hover) || b.pz - a.pz)) {
        const hot = hover === p.n;
        if (!hot && (w <= 380 || p.pz <= .05)) continue;
        if (!hot && labels.some(([lx, ly]) => Math.abs(lx - p.px) < 120 && Math.abs(ly - p.py) < 16)) continue;
        labels.push([p.px, p.py]); named.add(p.n);
      }
      for (const p of placed) {
        const front = p.pz > -.2, hot = hover === p.n;
        const a = front ? 1 : .45;
        // Link to the core with a travelling pulse.
        const grad = ctx.createLinearGradient(cx, cy, p.px, p.py);
        grad.addColorStop(0, rgba(p.n.color, 0)); grad.addColorStop(1, rgba(p.n.color, (hot ? .75 : .32) * a));
        ctx.strokeStyle = grad; ctx.lineWidth = hot ? 1.6 : 1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.px, p.py); ctx.stroke();
        const k = ((t * .45 + p.n.pulse) % 1);
        ctx.fillStyle = rgba(p.n.color, .9 * a);
        ctx.beginPath(); ctx.arc(cx + (p.px - cx) * k, cy + (p.py - cy) * k, 1.6, 0, TAU); ctx.fill();
        // The node: halo, ring and bright centre.
        const r = (hot ? 7.5 : 5.2) * p.f;
        const halo = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, r * 3.4);
        halo.addColorStop(0, rgba(p.n.color, .55 * a)); halo.addColorStop(1, rgba(p.n.color, 0));
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(p.px, p.py, r * 3.4, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(p.n.color, a); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.px, p.py, r, 0, TAU); ctx.stroke();
        ctx.fillStyle = light ? rgba(p.n.color, a) : rgba('#ffffff', .9 * a);
        ctx.beginPath(); ctx.arc(p.px, p.py, r * .42, 0, TAU); ctx.fill();
        if (named.has(p.n)) {
          ctx.font = (hot ? '600 12px ' : '500 10.5px ') + "'JetBrains Mono',ui-monospace,monospace";
          ctx.fillStyle = hot ? (light ? '#0a2730' : '#ffffff') : rgba(light ? '#0a2730' : '#dff9ff', .78);
          ctx.textAlign = p.px > cx ? 'left' : 'right';
          ctx.fillText(p.n.name, p.px + (p.px > cx ? r + 7 : -r - 7), p.py + 4);
        }
      }
      glow?.render();
      if (motion) raf = requestAnimationFrame(draw);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };

    function nodeAt(e) {
      const box = canvas.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
      let best = null;
      for (const p of placed) { const d = Math.hypot(p.px - x, p.py - y); if (d < 22 && (!best || d < best.d || p.pz > best.pz + .4)) best = {...p, d}; }
      return best;
    }
    function showTag(p) {
      if (!p) { tag.classList.remove('on'); return; }
      tag.textContent = 'Open ' + p.n.name;
      tag.style.setProperty('--node', p.n.color);
      tag.style.left = p.px + 'px'; tag.style.top = p.py + 'px';
      tag.classList.toggle('below', p.py < 48);
      tag.classList.add('on');
    }
    canvas.addEventListener('pointermove', e => {
      if (drag) {
        const dx = e.clientX - drag.x; drag.moved = drag.moved || Math.abs(dx) > 5;
        yaw += dx * .008; spin = dx * .0015; drag.x = e.clientX; kick(); return;
      }
      if (e.pointerType !== 'mouse') return;
      const p = nodeAt(e); hover = p?.n || null; canvas.style.cursor = p ? 'pointer' : 'grab'; showTag(p); kick();
    });
    canvas.addEventListener('pointerdown', e => { drag = {x: e.clientX, moved: false, start: nodeAt(e)}; canvas.setPointerCapture?.(e.pointerId); });
    const end = e => {
      if (!drag) return;
      const was = drag; drag = null;
      if (was.moved) return;
      const p = nodeAt(e) || was.start;
      if (!p) { hover = null; showTag(null); return; }
      if (e.pointerType !== 'mouse' && hover !== p.n) { hover = p.n; showTag(p); kick(); return; } // first tap names it
      location.href = p.n.href;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', () => { drag = null; });
    canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !drag) { hover = null; showTag(null); } });

    // Real light bleed on the GPU when available; the plain canvas otherwise.
    glow = window.AtlasHUDCore?.bloom?.(canvas, {strength: 1.25, threshold: .3}) || null;
    size(); kick();
    new ResizeObserver(() => { size(); last = 0; kick(); }).observe(wrap);
    if (window.IntersectionObserver) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; last = 0; kick(); }).observe(wrap);
    document.addEventListener('visibilitychange', () => { last = 0; kick(); });
    reduce.addEventListener?.('change', kick);
    new MutationObserver(kick).observe(root, {attributes: true, attributeFilter: ['data-atlas-theme']});
  }

  window.AtlasGlobe = {mount};
})();
