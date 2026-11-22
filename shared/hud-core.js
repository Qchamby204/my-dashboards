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
  // The browser can cancel a page transition (a reload, or a page restored from the
  // back/forward cache); settle those promises so a cancellation is not reported as an error.
  const settle = e => {
    const vt = e.viewTransition;
    if (vt) for (const done of [vt.ready, vt.finished, vt.updateCallbackDone]) done?.catch(() => {});
  };
  window.addEventListener?.('pagereveal', settle);
  // Only HUD pages opt in to transitions; leaving for any other page skips it up front.
  const HUD_PAGES = /\/(?:index|life-ledger|life-map|workout-forge|communication-trainer|the-chef|the-library|courier|the-hourglass|the-herald|the-aqueduct|operations-cadence|reminders|neural-map)\.html$|\/$/;
  window.addEventListener?.('pageswap', e => {
    settle(e);
    const to = e.activation?.entry?.url;
    let path = '';
    try { path = new URL(to).pathname; } catch {}
    // Back/forward can land on a page restored from cache, and a page reopening itself (an update)
    // may be an older cached copy; either can cancel the transition, so only animate forward moves to another page.
    if (e.viewTransition && (!to || e.activation.navigationType !== 'push' && e.activation.navigationType !== 'replace' || !HUD_PAGES.test(path) || path === location.pathname)) e.viewTransition.skipTransition();
  });

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

  /* ── GPU bloom: a WebGL post-pass for any 2D canvas. The canvas keeps drawing as
     before; its bright parts are blurred on the GPU and added back as real light
     bleed. Returns {render()} to call after each draw, or null (no WebGL), in which
     case the plain canvas simply stays on show. */
  function bloom(source, opts = {}) {
    const strength = opts.strength ?? 1.1, threshold = opts.threshold ?? .32;
    let out;
    try { out = document.createElement('canvas'); } catch { return null; }
    const gl = out.getContext('webgl', {premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: false});
    if (!gl) return null;
    out.className = (source.className ? source.className + ' ' : '') + 'hud-bloom';
    out.setAttribute('aria-hidden', 'true');
    const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
    const FS = {
      bright: 'precision mediump float;varying vec2 v;uniform sampler2D t;uniform float th;void main(){vec4 c=texture2D(t,v);float l=max(max(c.r,c.g),c.b);gl_FragColor=c*smoothstep(th,th+.25,l);}',
      blur: 'precision mediump float;varying vec2 v;uniform sampler2D t;uniform vec2 d;void main(){vec4 s=texture2D(t,v)*.227;s+=(texture2D(t,v+d*1.385)+texture2D(t,v-d*1.385))*.316;s+=(texture2D(t,v+d*3.231)+texture2D(t,v-d*3.231))*.07;gl_FragColor=s;}',
      mix: 'precision mediump float;varying vec2 v;uniform sampler2D t;uniform sampler2D b;uniform float k;void main(){vec4 c=texture2D(t,v);vec4 g=texture2D(b,v)*k;vec3 rgb=c.rgb+g.rgb*(1.-c.a*.35);float a=clamp(max(c.a,max(max(g.r,g.g),g.b)),0.,1.);gl_FragColor=vec4(rgb,a);}',
    };
    const prog = fs => {
      const mk = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
      const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
    };
    const P = {bright: prog(FS.bright), blur: prog(FS.blur), mix: prog(FS.mix)};
    if (!P.bright || !P.blur || !P.mix) return null;
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
    const src = tex();
    let fbo = [], w = 0, h = 0;
    function target(bw, bh) {
      const t = tex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return {t, f, w: bw, h: bh};
    }
    function sizeTo() {
      if (out.width === source.width && out.height === source.height && fbo.length) return;
      out.width = w = source.width; out.height = h = source.height;
      const bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
      fbo = [target(bw, bh), target(bw, bh)];
    }
    const draw = (p, into, vw, vh) => { gl.useProgram(p); gl.bindFramebuffer(gl.FRAMEBUFFER, into ? into.f : null); gl.viewport(0, 0, vw, vh); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
    let lost = false;
    out.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; out.remove(); source.classList.remove('hud-bloom-source'); });
    source.after(out);
    source.classList.add('hud-bloom-source');
    function render() {
      if (lost || !source.width || !source.height) return;
      sizeTo();
      // Keep the GPU canvas laid over the source exactly.
      out.style.cssText = source.style.cssText;
      if (getComputedStyle(source).position === 'static') Object.assign(out.style, {position: 'absolute', left: source.offsetLeft + 'px', top: source.offsetTop + 'px', width: source.offsetWidth + 'px', height: source.offsetHeight + 'px'});
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.useProgram(P.bright); gl.uniform1i(gl.getUniformLocation(P.bright, 't'), 0); gl.uniform1f(gl.getUniformLocation(P.bright, 'th'), threshold);
      draw(P.bright, fbo[0], fbo[0].w, fbo[0].h);
      for (let pass = 0; pass < 3; pass++) {
        const r = 1 + pass * 1.5;
        gl.useProgram(P.blur); gl.uniform1i(gl.getUniformLocation(P.blur, 't'), 0);
        gl.bindTexture(gl.TEXTURE_2D, fbo[0].t); gl.uniform2f(gl.getUniformLocation(P.blur, 'd'), r / fbo[0].w, 0); draw(P.blur, fbo[1], fbo[1].w, fbo[1].h);
        gl.bindTexture(gl.TEXTURE_2D, fbo[1].t); gl.uniform2f(gl.getUniformLocation(P.blur, 'd'), 0, r / fbo[1].h); draw(P.blur, fbo[0], fbo[0].w, fbo[0].h);
      }
      gl.useProgram(P.mix);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(gl.getUniformLocation(P.mix, 't'), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fbo[0].t); gl.uniform1i(gl.getUniformLocation(P.mix, 'b'), 1);
      gl.uniform1f(gl.getUniformLocation(P.mix, 'k'), strength);
      gl.clearColor(0, 0, 0, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clear(gl.COLOR_BUFFER_BIT);
      draw(P.mix, null, w, h);
      gl.activeTexture(gl.TEXTURE0);
    }
    return {render, canvas: out};
  }

    /* ── Ambient field: reactor rings, drifting motes and a scan pass ─────────── */
    let surgeField = () => {};
    function startField() {
      const canvas = node('canvas', 'hud-field');
      document.body.prepend(canvas);
      const ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) return;
      const tau = Math.PI * 2;
      let w = 0, h = 0, dpr = 1, raf = 0, last = 0, rgb = accentRGB(), surge = 0;
      surgeField = () => { if (still()) return; surge = 1; last = 0; if (!raf) raf = requestAnimationFrame(draw); };
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
        if (drawField(time)) glow?.render();
      }
      function drawField(time) {
        const motion = !still();
        if (motion && time - last < 33) { raf = requestAnimationFrame(draw); return false; }
        const dt = last ? Math.min((time - last) / 1000, .1) : 0; last = time;
        const t = motion ? time / 1000 : 0;
        const light = root.dataset.atlasTheme === 'light';
        surge = surge > .01 ? surge * Math.pow(.18, dt) : 0;
        const fade = (light ? .45 : 1) * (1 + surge * 1.6);
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
          const r = R * ring.r * (1 + surge * .025), rot = t * ring.speed * tau + surge * ring.speed * 6;
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
        return true;
      }
      const glow = root.matches('.hud-calm') ? null : bloom(canvas, {strength: .9, threshold: .18});
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
      const pad = svgNode('g', {class: 'hud-pad'}, svg);
      svgNode('path', {d: 'M58 186 L100 104 L142 186 Z', class: 'hud-pad-beam'}, pad);
      svgNode('ellipse', {cx: 100, cy: 187, rx: 46, ry: 6, class: 'hud-pad-ring'}, pad);
      svgNode('ellipse', {cx: 100, cy: 187, rx: 30, ry: 3.6, class: 'hud-pad-ring b'}, pad);
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
        if (hit) { if (hit.scene) scene({title: hit.done, detail: hit.sceneDetail || hit.value || '', color: hit.color}); else celebrate(svg, hit.done, hit.color); }
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
      surgeField();
      host.classList.add('hud-celebrate-host');
      setTimeout(() => { wave.remove(); svg?.classList.remove('hud-celebrating'); host.classList.remove('hud-celebrate-host'); }, still() ? 2200 : 1900);
    }

    /* ── Milestone scene: a full-screen beat for the big moments. Light rays,
       shockwaves and sparks on a GPU-bloomed canvas, then the milestone and a detail
       line. About 2.6 seconds; tap or press a key to continue. Silent. Under reduced
       motion it is a still card. */
    let sceneOpen = false;
    function scene({title, detail = '', color} = {}) {
      if (sceneOpen || !title) return;
      sceneOpen = true;
      const hue = color && !/^var\(/.test(color) ? color : (getComputedStyle(root).getPropertyValue('--hud-hue').trim() || '#5ff4ff');
      const shell = node('div', 'hud-scene', document.body);
      shell.style.setProperty('--scene', hue);
      const canvas = document.createElement('canvas');
      canvas.className = 'hud-scene-fx';
      const copy = node('div', 'hud-scene-copy', shell);
      node('p', 'hud-scene-kicker', copy).textContent = 'Milestone';
      const h = node('h2', 'hud-scene-title', copy); h.textContent = title;
      if (detail) node('p', 'hud-scene-detail', copy).textContent = detail;
      node('p', 'hud-scene-skip', shell).textContent = 'Tap to continue';
      let raf = 0, t0 = performance.now(), done = false, glow = null;
      const finish = () => {
        if (done) return; done = true; cancelAnimationFrame(raf);
        shell.classList.add('out');
        setTimeout(() => { shell.remove(); sceneOpen = false; }, 450);
      };
      shell.addEventListener('pointerdown', finish);
      document.addEventListener('keydown', finish, {once: true});
      setTimeout(finish, still() ? 1900 : 2700);
      if (still()) return;
      shell.prepend(canvas);
      const ctx = canvas.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const W = innerWidth, H = innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      glow = bloom(canvas, {strength: 1.7, threshold: .2});
      const [r, g, b] = (/^#([0-9a-f]{6})$/i.exec(hue) ? [0, 2, 4].map(i => parseInt(hue.slice(1 + i, 3 + i), 16)) : [95, 244, 255]);
      const ink = a => 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
      const cx = W / 2, cy = H * .42, R = Math.hypot(W, H) * .6;
      const sparks = Array.from({length: 90}, () => ({a: Math.random() * Math.PI * 2, v: .25 + Math.random() * .75, s: .6 + Math.random() * 1.8}));
      surgeField();
      const frame = now => {
        const k = (now - t0) / 1000;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        // Core flash.
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 140 + k * 60);
        core.addColorStop(0, 'rgba(255,255,255,' + Math.max(0, .95 - k * .5) + ')'); core.addColorStop(.25, ink(Math.max(0, .55 - k * .2))); core.addColorStop(1, ink(0));
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, 140 + k * 60, 0, Math.PI * 2); ctx.fill();
        // Rotating rays.
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(k * .35);
        for (let i = 0; i < 18; i++) {
          ctx.rotate(Math.PI * 2 / 18);
          const len = R * Math.min(1, k * 1.6), wid = 10 + (i % 3) * 8;
          const ray = ctx.createLinearGradient(0, 0, len, 0); ray.addColorStop(0, ink(.32)); ray.addColorStop(1, ink(0));
          ctx.fillStyle = ray; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, -wid); ctx.lineTo(len, wid); ctx.fill();
        }
        ctx.restore();
        // Three shockwaves.
        for (let i = 0; i < 3; i++) {
          const q = k - i * .18; if (q <= 0) continue;
          const rad = q * R * .9, a = Math.max(0, .9 - q * .75);
          ctx.strokeStyle = ink(a); ctx.lineWidth = 3 - i * .6;
          ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
        }
        // Sparks with short trails.
        ctx.lineCap = 'round';
        for (const p of sparks) {
          const d = (1 - Math.pow(1 - Math.min(1, k * .9), 3)) * R * .55 * p.v, x = cx + Math.cos(p.a) * d, y = cy + Math.sin(p.a) * d;
          const tail = 14 * p.s * (1 - Math.min(1, k * .6));
          ctx.strokeStyle = k < .15 ? 'rgba(255,255,255,.9)' : ink(Math.max(0, 1 - k * .45)); ctx.lineWidth = p.s;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(p.a) * tail, y - Math.sin(p.a) * tail); ctx.stroke();
        }
        glow?.render();
        if (!done) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    /* ── Click flash on a saving control; accent tints it to its card ─────────── */
    function burstAt(control, label, accent) {
      if (still()) return;
      surgeField();
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
    /* ── Opening card dressing: a light running the edge and a holographic sheen ── */
    function dressHeroes(selector) {
      if (!selector) return;
      const dress = () => {
        for (const card of document.querySelectorAll(selector)) {
          if (card.querySelector(':scope>.hud-runner')) continue;
          card.classList.add('hud-hero');
          // Placed first so the card's last child stays its own content (tests and styles rely on it).
          card.prepend(node('i', 'hud-runner'), node('i', 'hud-sheen'));
        }
      };
      dress();
      let queued = 0;
      new MutationObserver(records => {
        // A clock tick only swaps a text node; skip those so idle pages stay idle.
        if (queued || !records.some(r => [...r.addedNodes].some(n => n.nodeType === 1 && !n.classList?.contains('hud-runner') && !n.classList?.contains('hud-sheen')))) return;
        queued = requestAnimationFrame(() => { queued = 0; dress(); });
      }).observe(document.body, {childList: true, subtree: true});
    }

    /* ── Hologram: flat title illustrations re-rendered as glowing projected line art ── */
    function startHologram() {
      if (document.getElementById('hud-holo-filter')) return;
      // Edges become bright lines, fills a faint glass, all in the app colour (flood-color follows --hud-tab or --hud-hue).
      const defs = document.createElementNS(NS, 'svg');
      defs.setAttribute('aria-hidden', 'true'); defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
      defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      defs.innerHTML =
        '<filter id="hud-holo-filter" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">' +
        '<feColorMatrix in="SourceGraphic" type="matrix" values=".33 .33 .33 0 0  .33 .33 .33 0 0  .33 .33 .33 0 0  0 0 0 1 0" result="lum"/>' +
        '<feConvolveMatrix in="lum" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="edge"/>' +
        '<feColorMatrix in="edge" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3 3 3 0 0" result="edgeA"/>' +
        '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .1 0" result="bodyA"/>' +
        '<feMorphology in="SourceAlpha" operator="erode" radius="1.2" result="inner"/>' +
        '<feComposite in="SourceAlpha" in2="inner" operator="out" result="rim"/>' +
        '<feMerge result="mask"><feMergeNode in="bodyA"/><feMergeNode in="edgeA"/><feMergeNode in="rim"/></feMerge>' +
        '<feFlood class="hud-holo-ink" result="ink"/>' +
        '<feComposite in="ink" in2="mask" operator="in" result="holo"/>' +
        '<feGaussianBlur in="holo" stdDeviation="2.6" result="glow"/>' +
        '<feMerge><feMergeNode in="glow"/><feMergeNode in="holo"/><feMergeNode in="holo"/></feMerge>' +
        '</filter>';
      document.body.append(defs);
      root.classList.add('hud-holo-on');
    }

    /* ── App transitions: launch out of the Atlas tile, power down between pages ── */
    function startTransitions() {
      if (!('onpageswap' in window)) return;
      document.addEventListener('click', e => {
        const link = e.target.closest?.('a[href]');
        if (!link || link.target || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
        let url; try { url = new URL(link.href, location.href); } catch { return; }
        if (url.origin !== location.origin || url.pathname === location.pathname) return;
        const tile = link.closest('.hub-card,[data-hud]') || link;
        document.querySelectorAll('.hud-launching').forEach(n => { n.classList.remove('hud-launching'); n.style.viewTransitionName = ''; });
        tile.classList.add('hud-launching');
        tile.style.viewTransitionName = 'hud-launch';
        // The launch flares in the tile's own colour (transition pseudo-elements inherit from the root).
        const hue = getComputedStyle(tile).getPropertyValue('--tile-raw').trim() || getComputedStyle(tile).getPropertyValue('--tile').trim();
        if (hue) root.style.setProperty('--hud-launch', hue); else root.style.removeProperty('--hud-launch');
      });
      // Coming back through history restores the tile as it was.
      window.addEventListener('pageshow', () => document.querySelectorAll('.hud-launching').forEach(n => { n.classList.remove('hud-launching'); n.style.viewTransitionName = ''; }));
    }

    // Lock-on everywhere; tilt, edge light and sheen on the app's opening card; page transitions.
    function startExtras() { startLock(); startTilt(cfg.tilt); dressHeroes(cfg.hero || cfg.tilt); startTransitions(); startHologram(); }

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

    /* ── HUD-native motion, shared by the apps that opt in (Life Ledger, Life Map and
       The Hourglass carry their own fitted versions):
       - switching pages sweeps the cards in from the side of the page you chose;
       - cards build in the first time they scroll into view;
       - short figures decode like a readout, then lock on their exact original text;
       - progress bars fill from empty as their card arrives.
       cfg: blocks (selector for the app's cards), bars (selector for bar fills),
            scope (where to look, default the page), view (function returning the current
            page key; default the shared page navigation), order (page keys in nav order).
       Opacity, clipping and light only, so layout never shifts. Off under reduced
       motion and in automated browsers, like the boot sequence. */
    function native(cfg = {}) {
      if (root.classList.contains('hud-native')) return;
      const ok = () => !still() && !automated;
      if (!ok()) return;
      root.classList.add('hud-native');
      const BLOCK = (cfg.blocks ? cfg.blocks + ',' : '') + '.panel,.card,.block,[class*="-card"],.hud-hero';
      const scopeEl = () => document.querySelector(cfg.scope || 'body') || document.body;
      const navKeys = () => [...document.querySelectorAll('#atlas-page-navigation [data-page-key]')].map(b => b.dataset.pageKey);
      const viewKey = cfg.view || (() => document.querySelector('#atlas-page-navigation [aria-current="page"]')?.dataset.pageKey || '');
      const blocks = () => [...scopeEl().querySelectorAll(BLOCK)].filter(b => !b.parentElement?.closest(BLOCK) && !b.closest('[hidden],dialog:not([open]),.hud-boot,.hud-scene') && b.getClientRects().length);
      const inView = b => { const r = b.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; };
      const FIGURE = /^(?:[$€£]?\d[\d,.]*\s?(?:%|[kKmM]|y|h|m)?|\d[\d,]*\s+(?:days?|weeks?|years?|pages?|books?|reps?|sessions?|min|mins|minutes|hours?)(?:\s+(?:away|left|ago))?)$/;
      const decoding = new WeakSet(), seen = new WeakSet();
      function decode(scope) {
        let n = 0;
        for (const el of scope.querySelectorAll('strong,b,span,div,p,dd,td,small,em,output')) {
          if (n > 24) break;
          if (el.children.length || decoding.has(el) || el.closest('input,select,textarea,button,[contenteditable],.hud-telemetry,.hud-reactor,[aria-live],time')) continue;
          const text = el.textContent.trim();
          if (!text || text.length > 18 || !FIGURE.test(text) || !/\d/.test(text)) continue;
          n++; scramble(el, el.textContent);
        }
      }
      function scramble(el, final) {
        decoding.add(el);
        const digits = [...final].map((c, i) => /\d/.test(c) ? i : -1).filter(i => i >= 0);
        const t0 = performance.now(), D = 720;
        el.classList.add('hud-n-decoding');
        const step = now => {
          if (!el.isConnected) return;
          const k = now - t0, chars = [...final];
          digits.forEach((i, j) => { if (k < D - (digits.length - j) * 40) chars[i] = String(Math.floor(Math.random() * 10)); });
          el.textContent = chars.join('');
          if (k < D) requestAnimationFrame(step); else { el.textContent = final; el.classList.remove('hud-n-decoding'); }
        };
        requestAnimationFrame(step);
      }
      function fill(scope) {
        if (!cfg.bars) return;
        for (const bar of scope.querySelectorAll(cfg.bars)) {
          bar.classList.remove('hud-n-fill'); void bar.offsetWidth; bar.classList.add('hud-n-fill');
          setTimeout(() => bar.classList.remove('hud-n-fill'), 1300);
        }
      }
      let observer = null;
      function stackIn(fresh) {
        if (!ok() || !window.IntersectionObserver) return;
        observer ||= new IntersectionObserver(entries => {
          let n = 0;
          for (const e of entries) {
            if (!e.isIntersecting || seen.has(e.target)) continue;
            seen.add(e.target); observer.unobserve(e.target);
            const t = e.target, d = Math.min(n++, 6) * 65;
            if (!t.dataset.hudSwept) {
              t.style.setProperty('--hud-d', d + 'ms');
              t.classList.add('hud-n-rise');
              setTimeout(() => t.classList.remove('hud-n-rise'), 900 + d);
            }
            delete t.dataset.hudSwept;
            setTimeout(() => { decode(t); fill(t); }, d + 120);
          }
        }, {rootMargin: '0px 0px -6% 0px'});
        for (const b of blocks()) {
          if (seen.has(b)) continue;
          if (fresh && inView(b)) b.dataset.hudSwept = '1';
          observer.observe(b);
        }
      }
      let last = null, pending = 0;
      function check() {
        pending = 0;
        const key = viewKey();
        if (last !== null && key !== last && ok()) {
          const order = cfg.order || navKeys(), dir = order.indexOf(key) >= order.indexOf(last) ? 'hud-nw-right' : 'hud-nw-left';
          for (const b of blocks()) {
            if (!inView(b)) continue;
            b.classList.remove('hud-nw-left', 'hud-nw-right'); void b.offsetWidth; b.classList.add(dir);
            setTimeout(() => b.classList.remove(dir), 650);
          }
          stackIn(true);
        } else stackIn(false);
        last = key;
      }
      const schedule = () => { if (!pending) pending = requestAnimationFrame(() => requestAnimationFrame(check)); };
      new MutationObserver(records => {
        for (const r of records) {
          const t = r.target.nodeType === 1 ? r.target : r.target.parentElement;
          if (t?.closest?.('.hud-n-decoding,.hud-telemetry,.hud-reactor,.hud-scan,.hud-burst,.hud-lock,.hud-readout')) continue;
          schedule(); return;
        }
      }).observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['aria-current', 'hidden']});
      schedule();
    }

    return {root, reduce, automated, still, pad, started, node, svgNode, accentRGB, bloom, startField, startFrame, frameTick, buildReactor, paintArcs, readoutAt, clearReadout, celebrate, scene, burstAt, startExtras, native, boot};
  }

  window.AtlasHUDCore = {engine, bloom: (canvas, opts) => engine({}).bloom(canvas, opts)};
})();
