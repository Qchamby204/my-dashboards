/* The Forge, focus mode: the live workout as one clean, guided screen.
   One exercise at a time, one set at a time. Weight and reps arrive pre-filled from
   your last session or the progression target; "Log set" saves the set and starts the
   rest ring in place; after the last set, one tap says how it felt and moves you on.
   Everything else (pause, hide, swap, cancel, finish) waits behind the options menu.

   Records: a set reaches the draft only when you log it, so a prefilled number is never
   saved as work you did. Drafts, finishing, cancelling, pausing and the rest timer all go
   through the session layer in forge-enhancements.js, unchanged. */
(() => {
  'use strict';
  if (window.ForgeFocus) return;
  const root = document.documentElement;
  const app = document.getElementById('app');
  const S = () => window.ForgeSession;
  if (!app || typeof liveView !== 'function') return;

  const ui = {menu: false, edit: {}, note: {}};   // per-render UI only; never stored
  const FEEL = [['smooth', 'Clean', '2+ reps left'], ['hard', 'Hard', '0–1 left'], ['missed', 'Missed', 'below the range'], ['pain', 'Pain', 'stop this lift']];
  const num = v => typeof v === 'number' ? v : (typeof v === 'string' && /^\d+(?:\.\d+)?$/.test(v.trim()) ? Number(v) : NaN);
  const fmt = n => Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '';
  const logged = s => !!s && Number.isInteger(num(s.r)) && num(s.r) > 0 && (s.w === '' || s.w == null || Number.isFinite(num(s.w)));
  const isBody = it => /rollout|pull-up|pullup|push-up|dip|plank|hold|leg raise|crunch/i.test(effName(it));
  const range = it => (window.ForgeProgression?.range(it.reps)) || null;
  const stepFor = (it, eid) => window.ForgeProgression ? ForgeProgression.setting((state.progressionSettings || {})[eid], effName(it)) : 5;

  function session() {
    const live = state.live, d = live && dayBy(live.key);
    if (!d) return null;
    const items = orderedItems(d), i = Math.max(0, Math.min(items.length - 1, live.exIdx || 0));
    return {live, d, items, i, it: items[i]};
  }
  // Which set is next for this exercise, and what to show in the editor.
  function setState(it) {
    const eid = effId(it), dr = state.draft[eid] || {sets: []}, n = it.sets || 3;
    const sets = Array.from({length: n}, (_, k) => dr.sets?.[k] || {w: '', r: ''});
    const next = sets.findIndex(s => !logged(s));
    const edit = ui.edit[eid];
    const at = edit && edit.i < n ? edit.i : (next < 0 ? n : next);
    return {eid, dr, sets, n, next, at, all: next < 0};
  }
  function suggestion(it, eid, k, sets) {
    const prev = (typeof lastSets === 'function' && lastSets(eid)) || [];
    const mine = sets[k] && (logged(sets[k]) || String(sets[k].w ?? '') !== '' || String(sets[k].r ?? '') !== '') ? sets[k] : null;
    if (mine) return {w: String(mine.w ?? ''), r: String(mine.r ?? '')};
    const before = [...sets.slice(0, k)].reverse().find(logged);
    let w = '', r = '';
    let target = null;
    try { target = typeof progressionFor === 'function' ? progressionFor(it, eid) : null; } catch { target = null; }
    if (before) { w = before.w ?? ''; r = before.r; }
    else if (target && target.load != null && target.kind !== 'pause') { w = fmt(target.load); r = prev[k]?.r || range(it)?.lo || ''; }
    else if (prev[k]) { w = prev[k].w ?? ''; r = prev[k].r ?? ''; }
    else if (prev.length) { w = prev[prev.length - 1].w ?? ''; r = prev[prev.length - 1].r ?? ''; }
    else r = range(it)?.lo || '';
    if (isBody(it) && !before && !prev.length) w = '';
    return {w: String(w ?? ''), r: String(r ?? '')};
  }
  const editorValues = (it, st) => {
    const cached = ui.edit[st.eid];
    if (cached && cached.i === st.at && cached.w != null) return cached;
    const v = suggestion(it, st.eid, st.at, st.sets);
    ui.edit[st.eid] = {i: st.at, w: v.w, r: v.r, chosen: !!cached?.chosen};
    return ui.edit[st.eid];
  };

  /* ── Markup ────────────────────────────────────────────────────────────────── */
  let shownIdx = null, shownSession = null;
  function view() {
    const s = session();
    if (!s) return '';
    // A new session starts clean; moving to another exercise closes the options.
    if (shownSession !== s.live.startedAt) { shownSession = s.live.startedAt; shownIdx = null; ui.menu = false; ui.edit = {}; ui.note = {}; }
    if (shownIdx !== null && shownIdx !== s.i) ui.menu = false;
    shownIdx = s.i;
    const {live, d, items, i, it} = s, eid = effId(it), n = items.length;
    const doneN = items.filter(x => state.draft[effId(x)]?.done).length;
    const paused = !!live.pausedAt, last = i === n - 1, dr = state.draft[eid] || {};
    const section = (d.sections[daySectionOf(d, it.id)] || {}).name || '';
    let h = '<div class="overlay forge-focus" role="dialog" aria-modal="true" aria-label="Current training session" style="--acc:' + d.accent + '">';
    h += '<div class="ff-shell' + (paused ? ' is-paused' : '') + '">';

    // Top bar: day, clock, progress through the session, options.
    h += '<header class="ff-top"><div class="ff-clockwrap"><span class="ff-tag">' + esc(d.tag) + (paused ? ' · paused' : '') + '</span><span class="ff-clock mono" id="liveClock">' + liveElapsed() + '</span></div>';
    h += '<span class="ff-count mono">' + doneN + '/' + n + '</span>';
    h += '<button type="button" class="ff-iconbtn" data-ff="menu" aria-expanded="' + ui.menu + '" aria-controls="ff-menu" aria-label="Workout options">⋯</button></header>';
    h += '<nav class="ff-track" aria-label="Exercises in this session">' + items.map((x, k) => {
      const ok = state.draft[effId(x)]?.done;
      return '<button type="button" data-ff="go" data-i="' + k + '" class="' + (ok ? 'is-done ' : '') + (k === i ? 'is-now' : '') + '" aria-label="' + (k + 1) + '. ' + esc(effName(x)) + (ok ? ', done' : '') + '"' + (k === i ? ' aria-current="step"' : '') + (paused ? ' disabled' : '') + '><i></i></button>';
    }).join('') + '</nav>';

    // Stage: the one exercise in front of you.
    h += '<main class="ff-stage forge-live-panel">';
    h += '<p class="ff-eyebrow">' + esc(section) + ' · ' + (i + 1) + ' of ' + n + '</p>';
    h += '<h2 class="ff-name">' + esc(effName(it)) + '</h2>';
    const rx = it.track === 'load' ? [it.sets + ' × ' + esc(it.reps), it.rest ? 'rest ' + esc(it.rest) : '', it.rpe ? esc(it.rpe) : ''] : [it.s ? esc(it.s) : (it.sets ? it.sets + ' × ' + esc(it.reps || '') : '')];
    h += '<p class="ff-rx mono">' + rx.filter(Boolean).join(' · ') + '</p>';
    if (it.c) h += '<p class="ff-cue">' + esc(it.c) + '</p>';

    if (paused) {
      h += '<div class="ff-paused"><p>Session paused. The clock is stopped.</p><button type="button" class="ff-primary" data-ff="pause">Resume session</button></div>';
    } else if (it.track === 'load') {
      h += loadStage(it, d);
    } else if (it.track === 'cardio') {
      h += '<div class="ff-cardio">' + cardioRows(it, d.accent) + '</div>';
      h += nextButton(s, dr.done);
    } else {
      h += '<p class="ff-simple">' + (it.s ? esc(it.s) : 'Work through it at your own pace.') + '</p>';
      h += nextButton(s, dr.done);
    }
    if (!paused) {
      const open = ui.note[eid] || !!dr.note;
      h += '<details class="ff-note"' + (open ? ' open' : '') + ' data-ff-note="' + esc(eid) + '"><summary>' + (dr.note ? 'Note added' : 'Add a note') + '</summary><textarea data-act="note" data-id="' + esc(eid) + '" rows="2" placeholder="How did it go?" aria-label="Note for ' + esc(effName(it)) + '">' + esc(dr.note || '') + '</textarea></details>';
    }
    h += '</main>';

    // Footer: back, what's next, skip.
    h += '<footer class="ff-foot"><button type="button" class="ff-iconbtn" data-ff="prev" aria-label="Previous exercise"' + (i === 0 || paused ? ' disabled' : '') + '>‹</button>';
    h += '<p class="ff-upnext">' + (last ? 'Last exercise' : 'Up next · <b>' + esc(effName(items[i + 1])) + '</b>') + '</p>';
    h += '<button type="button" class="ff-iconbtn" data-ff="skip" aria-label="Skip for now"' + (last || paused ? ' disabled' : '') + '>›</button></footer>';

    // Options.
    h += '<div class="ff-menu" id="ff-menu"' + (ui.menu ? '' : ' hidden') + '><div class="ff-menu-card" role="group" aria-label="Workout options">';
    h += '<button type="button" data-ff="pause">' + (paused ? 'Resume session' : 'Pause session') + '</button>';
    h += '<button type="button" data-ff="hide">Hide · keep the clock running</button>';
    const sameSection = !last && daySectionOf(d, it.id) === daySectionOf(d, items[i + 1].id);
    if (sameSection && !paused) h += '<button type="button" data-ff="later">Can’t do this now · swap with next</button>';
    h += '<button type="button" data-act="livefinish">Finish workout</button>';
    h += '<button type="button" class="ff-danger" data-ff="cancel">Cancel workout</button>';
    h += '<p class="forge-draft-status" role="status"></p><button type="button" class="ff-menu-close" data-ff="menu">Close</button></div></div>';
    h += '</div></div>';
    return h;
  }

  function loadStage(it, d) {
    const st = setState(it), v = editorValues(it, st), prev = (typeof lastSets === 'function' && lastSets(st.eid)) || [];
    let target = null;
    try { target = progressionFor(it, st.eid); } catch { target = null; }
    let h = '<div class="ff-context">';
    const same = prev.length > 1 && prev.every(x => String(x.w) === String(prev[0].w) && String(x.r) === String(prev[0].r));
    const lastText = !prev.length ? 'First time' : same ? (prev[0].w ? esc(prev[0].w) + ' lb × ' : '') + esc(prev[0].r) + ' · ' + prev.length + ' sets' : prev.map(x => (x.w ? esc(x.w) + '×' : '') + esc(x.r)).join(' · ');
    h += '<span><small>Last time</small><b class="mono">' + lastText + '</b></span>';
    if (target && target.load != null) h += '<span><small>' + (target.kind === 'increase' ? 'Target · step up' : target.kind === 'reduce' ? 'Target · lighter' : 'Target') + '</small><b class="mono">' + fmt(target.load) + ' lb</b></span>';
    else if (target && target.kind === 'pause') h += '<span class="is-warn"><small>Pain flagged</small><b>Review before loading</b></span>';
    h += '</div>';
    if (target && target.reason) h += '<details class="ff-why"><summary>Why this target?</summary><p>' + esc(target.reason) + '</p></details>';

    // Set chips: logged sets (tap to edit), the current one, and the rest.
    h += '<ol class="ff-sets" aria-label="Sets">' + st.sets.map((s, k) => {
      const ok = logged(s), now = k === st.at;
      const label = ok ? ((s.w !== '' && s.w != null ? esc(s.w) + '×' : '') + esc(s.r)) : 'Set ' + (k + 1);
      return '<li><button type="button" data-ff="set" data-k="' + k + '" class="' + (ok ? 'is-logged ' : '') + (now ? 'is-now' : '') + '" aria-label="Set ' + (k + 1) + (ok ? ', ' + label + ', edit' : '') + '"' + (ok || now ? '' : ' disabled') + '>' + label + '</button></li>';
    }).join('') + '</ol>';

    if (!st.all || ui.edit[st.eid]?.chosen) {
      const editing = logged(st.sets[st.at]);
      const step = stepFor(it, st.eid);
      h += '<div class="ff-editor" data-eid="' + esc(st.eid) + '" data-k="' + st.at + '">';
      h += stepper('w', 'Weight', v.w, isBody(it) && v.w === '' ? 'Body' : 'lb', step, st.eid, it.home && !it.recordId ? 'per dumbbell' : '');
      h += stepper('r', 'Reps', v.r, 'reps', 1, st.eid, it.reps ? 'aim ' + esc(it.reps) : '');
      h += '</div>';
      h += '<button type="button" class="ff-primary" data-ff="log">' + (editing ? 'Update set ' + (st.at + 1) : 'Log set ' + (st.at + 1) + ' of ' + st.n) + '</button>';
      if (editing) h += '<button type="button" class="ff-link" data-ff="cancel-edit">Keep set ' + (st.at + 1) + ' as it was</button>';
    } else {
      const dr = state.draft[st.eid] || {};
      h += '<div class="ff-feel" role="group" aria-label="How did ' + esc(effName(it)) + ' feel?"><p>How did that feel?</p><div>' + FEEL.map(([k, a, b]) => '<button type="button" data-ff="feel" data-v="' + k + '" aria-pressed="' + (dr.feedback === k) + '"><b>' + a + '</b><small>' + b + '</small></button>').join('') + '</div></div>';
    }
    h += restBlock(it);
    if (st.all && !ui.edit[st.eid]?.chosen) h += nextButton(session(), true);
    return h;
  }
  function stepper(field, label, value, unit, step, eid, hint) {
    return '<div class="ff-stepper"><span class="ff-step-label">' + label + (hint ? ' <small>' + hint + '</small>' : '') + '</span><div class="ff-step-row">' +
      '<button type="button" data-ff="step" data-f="' + field + '" data-d="-' + step + '" aria-label="' + label + ' down ' + step + '">−</button>' +
      '<label class="ff-step-value"><input class="mono" data-ff-field="' + field + '" inputmode="' + (field === 'w' ? 'decimal' : 'numeric') + '" value="' + esc(value) + '" placeholder="' + (field === 'w' ? '—' : '0') + '" aria-label="' + label + '" autocomplete="off"/><span>' + unit + '</span></label>' +
      '<button type="button" data-ff="step" data-f="' + field + '" data-d="' + step + '" aria-label="' + label + ' up ' + step + '">+</button></div></div>';
  }
  function restBlock(it) {
    return '<section class="ff-rest" id="ff-rest" hidden aria-label="Rest"><div class="ff-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="ff-ring-bg"/><circle cx="60" cy="60" r="52" class="ff-ring-fg" id="ff-ring-fg"/></svg><div class="ff-ring-text"><small id="ff-rest-label">Rest</small><b class="mono" id="ff-rest-time">0:00</b></div></div>' +
      '<div class="ff-rest-actions"><button type="button" data-ff="rest" data-d="-30">−30</button><button type="button" data-ff="rest" data-d="30">+30</button><button type="button" data-ff="rest-skip">Skip rest</button></div></section>';
  }
  function nextButton(s, done) {
    if (!s) return '';
    const last = s.i === s.items.length - 1;
    if (last && done) return '<button type="button" class="ff-primary ff-finish" data-act="livefinish">Finish workout</button>';
    return '<button type="button" class="ff-primary' + (done ? '' : ' ff-ghost') + '" data-ff="next">' + (last ? 'Mark done' : done ? 'Next exercise' : 'Done · next exercise') + '</button>';
  }

  /* ── Actions ───────────────────────────────────────────────────────────────── */
  const blocked = () => { const s = S(); return !s || s.blocked || s.busy || s.pendingLog; };
  const buzz = () => { try { navigator.vibrate?.(10); } catch {} };
  function readEditor() {
    const box = app.querySelector('.ff-editor');
    if (!box) return null;
    const eid = box.dataset.eid, k = Number(box.dataset.k), w = box.querySelector('[data-ff-field="w"]').value.trim(), r = box.querySelector('[data-ff-field="r"]').value.trim();
    return {eid, k, w, r, box};
  }
  function complain(box, field, text) {
    const input = box.querySelector('[data-ff-field="' + field + '"]');
    document.getElementById('ff-error')?.remove();
    const p = document.createElement('p'); p.id = 'ff-error'; p.className = 'ff-error'; p.setAttribute('role', 'alert'); p.textContent = text;
    box.after(p); input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', 'ff-error'); input.focus();
  }
  function logSet() {
    const s = session(), e = readEditor();
    if (!s || !e || blocked() || s.live.pausedAt) return;
    if (!/^\d+$/.test(e.r) || Number(e.r) < 1 || Number(e.r) > 100) return complain(e.box, 'r', 'Enter the reps you completed.');
    if (e.w !== '' && !/^\d+(?:\.\d+)?$/.test(e.w)) return complain(e.box, 'w', 'Enter the weight as a number, or leave it blank for bodyweight.');
    const it = s.it, dr = state.draft[e.eid] || {done: false, sets: []};
    dr.sets = Array.isArray(dr.sets) ? dr.sets : [];
    while (dr.sets.length <= e.k) dr.sets.push({w: '', r: ''});
    const editing = logged(dr.sets[e.k]);
    dr.sets[e.k] = {w: e.w, r: e.r};
    const n = it.sets || 3, all = Array.from({length: n}, (_, k) => dr.sets[k]).every(logged);
    if (all) dr.done = true;
    state.draft[e.eid] = dr;
    delete ui.edit[e.eid];
    saveDraft(); buzz();
    const lastOfAll = s.i === s.items.length - 1 && all;
    if (!editing && !lastOfAll) startTimer(parseRest(it.rest));
    render();
  }
  function goNext() {
    const s = session();
    if (!s || blocked() || s.live.pausedAt) return;
    const eid = effId(s.it), dr = state.draft[eid] || {sets: []};
    if (!dr.done) { dr.done = true; state.draft[eid] = dr; saveDraft(); buzz(); }
    delete ui.edit[eid];
    if (s.i < s.items.length - 1) S().goExercise(s.i + 1); else render();
  }
  function step(field, delta) {
    const e = readEditor();
    if (!e) return;
    const input = e.box.querySelector('[data-ff-field="' + field + '"]');
    const cur = num(input.value) || 0, next = Math.max(0, Math.round((cur + delta) * 100) / 100);
    input.value = field === 'r' ? String(Math.round(next)) : fmt(next);
    const c = ui.edit[e.eid] || (ui.edit[e.eid] = {i: e.k});
    c[field] = input.value;
    input.removeAttribute('aria-invalid'); document.getElementById('ff-error')?.remove();
  }

  app.addEventListener('click', ev => {
    const el = ev.target.closest('[data-ff]');
    if (!el || !el.closest('.forge-focus')) return;
    const a = el.dataset.ff, s = session();
    if (!s) return;
    if (a === 'menu') { ui.menu = !ui.menu; render(); if (ui.menu) app.querySelector('.ff-menu button')?.focus(); else app.querySelector('[data-ff="menu"]')?.focus(); return; }
    if (blocked() && !['menu'].includes(a)) return;
    if (a !== 'menu' && a !== 'cancel') ui.menu = false;
    switch (a) {
      case 'go': S().goExercise(Number(el.dataset.i)); break;
      case 'prev': S().goExercise(s.i - 1); break;
      case 'skip': S().goExercise(s.i + 1); break;
      case 'log': logSet(); break;
      case 'next': goNext(); break;
      case 'step': step(el.dataset.f, Number(el.dataset.d)); break;
      case 'set': {
        const eid = effId(s.it), k = Number(el.dataset.k), st = setState(s.it);
        if (!logged(st.sets[k]) && k !== st.next) break;
        ui.edit[eid] = {i: k, chosen: logged(st.sets[k])};
        render(); app.querySelector('.ff-editor [data-ff-field="r"]')?.focus({preventScroll: true});
        break;
      }
      case 'cancel-edit': delete ui.edit[effId(s.it)]; render(); break;
      case 'feel': {
        const eid = effId(s.it), dr = state.draft[eid] || {sets: []};
        if (dr.feedback === el.dataset.v) delete dr.feedback; else dr.feedback = el.dataset.v;
        state.draft[eid] = dr; saveDraft(); render(); break;
      }
      case 'rest': S().adjustRest(Number(el.dataset.d)); paintRest(); break;
      case 'rest-skip': stopTimer(); paintRest(); break;
      case 'pause': S().pauseLive(); break;
      case 'hide': state.live.hidden = true; saveLive(); render(); break;
      case 'later': {
        const it = s.it;
        if (moveItem(state.live.key, it.id, 1)) toast('Moved down. Do it after the next one.');
        render(); break;
      }
      case 'cancel': S().cancelLive(); break;
    }
  });
  app.addEventListener('input', ev => {
    const input = ev.target.closest?.('.forge-focus [data-ff-field]');
    if (!input) return;
    const e = readEditor(); if (!e) return;
    const c = ui.edit[e.eid] || (ui.edit[e.eid] = {i: e.k});
    c[input.dataset.ffField] = input.value;
    input.removeAttribute('aria-invalid'); document.getElementById('ff-error')?.remove();
  });
  app.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.closest?.('.forge-focus [data-ff-field]')) { ev.preventDefault(); logSet(); }
    if (ev.key === 'Escape' && ui.menu && ev.target.closest?.('.forge-focus')) { ev.preventDefault(); ui.menu = false; render(); app.querySelector('[data-ff="menu"]')?.focus(); }
  });
  app.addEventListener('toggle', ev => {
    const d = ev.target.closest?.('.forge-focus [data-ff-note]');
    if (d) ui.note[d.dataset.ffNote] = d.open;
  }, true);

  /* ── Rest ring: driven by the session layer's timer, repainted in place ─────── */
  let lastRest = null;
  function paintRest() {
    const box = document.getElementById('ff-rest');
    if (!box) return;
    const r = S()?.rest, show = !!r && (r.left > 0 || r.paused);
    box.hidden = !show;
    app.querySelector('.forge-focus')?.classList.toggle('is-resting', show);
    if (!show) { lastRest = null; return; }
    const secs = Math.ceil(r.left / 1000), frac = r.total ? Math.max(0, Math.min(1, r.left / (r.total * 1000))) : 0;
    const t = document.getElementById('ff-rest-time'), fg = document.getElementById('ff-ring-fg'), label = document.getElementById('ff-rest-label');
    const text = clk(secs);
    if (t && t.textContent !== text) t.textContent = text;
    if (fg) fg.style.strokeDashoffset = String(326.73 * (1 - frac));
    if (label) label.textContent = r.paused ? 'Rest paused' : secs <= 5 ? 'Get ready' : 'Rest';
    lastRest = secs;
  }
  setInterval(() => { if (app.querySelector('.forge-focus')) paintRest(); }, 250);

  /* ── Install ───────────────────────────────────────────────────────────────── */
  const before = liveView;
  liveView = function () {
    if (!state.live || state.live.hidden) return before();
    return view();
  };
  const priorRender = render;
  render = function () {
    priorRender.apply(this, arguments);
    const on = !!app.querySelector('.forge-focus');
    if (!state.live) ui.menu = false;
    root.classList.toggle('forge-focus-on', on);
    if (on) paintRest();
  };
  window.ForgeFocus = Object.freeze({version: 1});
  render();
})();
