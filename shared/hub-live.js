/* Atlas, live. Turns the directory into something that answers "what needs me":
   - each tile carries one line of real status from that app's own saved records;
   - a week strip shows the six Accountability dashboards against their weekly goals;
   - a command bar (press / or Ctrl/Cmd+K, or tap Search) finds and opens any tile;
   - tiles can be pinned to the top.
   Read-only for every app's records (November 21 user direction). The only thing it
   writes is the hub's own pin list (atlas:hub-pins). It never reads Herald,
   Prospecting or client data: those tiles show only when they were last opened. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset?.atlasApp !== 'atlas-hub' || window.AtlasHubLive) return;
  const PINS = 'atlas:hub-pins';
  const core = window.AtlasAccountabilityCore;
  const read = (key, fallback = null) => { try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; } };
  const dayOf = (d = new Date()) => core?.dayOf(d) || d.toISOString().slice(0, 10);
  const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
  const clock = hhmm => { const [h, m] = hhmm.split(':').map(Number); return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? ' AM' : ' PM'); };
  const shortDay = day => new Date(day + 'T12:00:00').toLocaleDateString('en-CA', {weekday: 'short'});
  const shortDate = day => new Date(day + 'T12:00:00').toLocaleDateString('en-CA', {month: 'short', day: 'numeric'});
  const fileOf = href => { try { return new URL(href, location.href).pathname.split('/').pop() || ''; } catch { return ''; } };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  /* ── Status lines ─────────────────────────────────────────────────────────── */
  const ACC = {'life-ledger.html': 'life-ledger', 'communication-trainer.html': 'communication-trainer', 'workout-forge.html': 'workout-forge', 'life-map.html': 'life-map', 'courier.html': 'courier', 'the-library.html': 'library'};
  // Ids the activity log uses for each page.
  const ACTIVITY = {'the-library.html': ['the-library', 'library'], 'prospecting-command-center.html': ['prospecting-command-center', 'prospecting']};
  let courierLatest = null;

  function week(app) {
    if (!core) return null;
    try { const today = dayOf(); return core.weeklyProgress(app, core.records(app, read), core.prefs(app, read), today); } catch { return null; }
  }
  function lastOpened(file, card) {
    const ids = ACTIVITY[file] || [card.dataset.hubId || file.replace(/\.html$/, '')];
    const events = read('atlas:activity:v1', {})?.events;
    if (!Array.isArray(events)) return null;
    let latest = '';
    for (const e of events) if (e && ids.includes(e.app) && ['open', 'launch'].includes(e.type) && typeof e.at === 'string' && e.at > latest && Date.parse(e.at) <= Date.now()) latest = e.at;
    if (!latest) return null;
    const days = Math.round((new Date(dayOf()) - new Date(dayOf(new Date(latest)))) / 864e5);
    return {text: days <= 0 ? 'Opened today' : days === 1 ? 'Opened yesterday' : 'Opened ' + days + ' days ago'};
  }
  const STATUS = {
    'life-map.html'() {
      const map = read('lifemap_v1');
      if (!map || !Array.isArray(map.projects)) return null;
      const today = dayOf(), open = map.projects.filter(t => t && !t.archived && t.status !== 'Done');
      const now = open.filter(t => t.plan === today || t.due === today).length, late = open.filter(t => t.due && t.due < today).length;
      if (!now && !late) return {text: 'Your day is clear'};
      return {text: [now && plural(now, 'task') + ' today', late && late + ' overdue'].filter(Boolean).join(' · '), alert: true};
    },
    'life-ledger.html'() {
      const w = week('life-ledger');
      if (!w) return null;
      return w.savedToday ? {text: 'Checked in today'} : {text: 'No check-in yet today', alert: w.days.find(d => d.today)?.planned};
    },
    'workout-forge.html'() { return weekLine('workout-forge', 'workout'); },
    'communication-trainer.html'() { return weekLine('communication-trainer', 'practice day'); },
    'the-library.html'() {
      const w = week('library'), daily = read('atlas.library.v1', {})?.reading?.daily;
      if (!w || !daily || typeof daily !== 'object') return null;
      let pages = 0;
      for (const [day, entries] of Object.entries(daily)) if (day >= w.start && day <= w.end && entries && typeof entries === 'object') for (const n of Object.values(entries)) if (n > 0) pages += n;
      return {text: pages ? plural(pages, 'page') + ' this week' : 'No pages logged this week', alert: !w.savedToday && w.days.find(d => d.today)?.planned};
    },
    'courier.html'() {
      if (!courierLatest) return null;
      const w = week('courier');
      if (courierLatest === dayOf()) return {text: w?.savedToday ? 'Today’s briefing heard' : 'Today’s briefing is ready', alert: !w?.savedToday};
      return {text: 'Latest edition ' + shortDate(courierLatest)};
    },
    'the-hourglass.html'() {
      const s = read('hourglass:v1');
      const today = dayOf();
      const next = (Array.isArray(s?.milestones) ? s.milestones : []).filter(m => m && /^\d{4}-\d\d-\d\d$/.test(m.date || '') && m.date >= today && (m.label || '').trim()).sort((a, b) => a.date.localeCompare(b.date))[0];
      if (!next) return null;
      const days = Math.round((new Date(next.date) - new Date(today)) / 864e5);
      return {text: next.label.trim() + (days === 0 ? ' is today' : ' in ' + plural(days, 'day')), alert: days <= 7};
    },
    'reminders.html'() {
      const prefs = read('atlas.reminders.v1');
      if (!prefs) return null;
      if (prefs.paused) return {text: 'Reminders paused'};
      const d = new Date(), mins = d.getHours() * 60 + d.getMinutes(), today = dayOf();
      const next = (Array.isArray(prefs.reminders) ? prefs.reminders : []).filter(r => r && r.enabled && /^\d\d:\d\d$/.test(r.time || '') && (r.date ? r.date === today : (r.days || []).includes(d.getDay())))
        .map(r => ({r, at: +r.time.slice(0, 2) * 60 + +r.time.slice(3)})).filter(x => x.at >= mins).sort((a, b) => a.at - b.at)[0];
      return {text: next ? 'Next: ' + clock(next.r.time) + ' · ' + String(next.r.title || 'Reminder') : 'No more reminders today'};
    }
  };
  function weekLine(app, unit) {
    const w = week(app);
    if (!w) return null;
    const plannedToday = w.days.find(d => d.today)?.planned;
    return {text: w.earned + ' of ' + w.goal + ' ' + (w.goal === 1 ? unit : unit + 's') + ' this week' + (w.savedToday ? ' · done today' : ''), alert: plannedToday && !w.savedToday};
  }
  const cache = new Map();
  function statusFor(href, card) {
    const file = fileOf(href);
    let s = null;
    try { s = STATUS[file]?.() || null; } catch { s = null; }
    if (!s && card) s = lastOpened(file, card);
    cache.set(file, s);
    return s;
  }

  function paintTiles() {
    for (const card of document.querySelectorAll('a.hub-card')) {
      const s = statusFor(card.href, card), host = card.querySelector(':scope>div') || card;
      let line = host.querySelector(':scope>.hub-live');
      if (!s) { line?.remove(); delete card.dataset.alert; continue; }
      if (!line) { line = el('span', 'hub-live'); host.append(line); }
      line.textContent = s.text;
      if (s.alert) card.dataset.alert = '1'; else delete card.dataset.alert;
    }
  }

  /* ── This week: the six Accountability dashboards ─────────────────────────── */
  function paintWeek() {
    if (!core) return;
    let host = document.getElementById('hub-week');
    if (!host) {
      host = el('section', 'hub-week');
      host.id = 'hub-week';
      host.setAttribute('aria-labelledby', 'hub-week-title');
      const anchor = document.getElementById('hub-recents') || document.querySelector('.hub-areas');
      anchor?.after(host);
    }
    const head = el('div', 'hub-week-head');
    const title = el('h2', '', 'This week');
    title.id = 'hub-week-title';
    head.append(title);
    const rows = el('div', 'hub-week-rows');
    let any = false, dayNames = null;
    for (const [app, info] of Object.entries(core.apps)) {
      const w = week(app);
      if (!w) continue;
      any = true;
      dayNames ||= w.days.map(d => shortDay(d.day).slice(0, 1));
      const [name, unit, , , , accent, page] = info;
      const card = [...document.querySelectorAll('a.hub-card')].find(c => fileOf(c.href) === page);
      const row = el('a', 'hub-week-row');
      row.href = card?.href || page;
      row.style.setProperty('--acc', accent);
      const met = w.earned >= w.goal && w.goal > 0;
      if (met) row.dataset.met = '1';
      row.setAttribute('aria-label', name + ': ' + w.earned + ' of ' + w.goal + ' ' + unit + ' this week' + (w.savedToday ? ', done today' : ''));
      row.append(el('span', 'hub-week-name', name));
      const cells = el('span', 'hub-week-days');
      cells.setAttribute('aria-hidden', 'true');
      for (const d of w.days) {
        const c = el('i');
        c.dataset.state = d.saved ? 'saved' : d.planned ? (d.past ? 'missed' : d.today ? 'due' : 'planned') : 'rest';
        if (d.today) c.dataset.today = '1';
        cells.append(c);
      }
      row.append(cells);
      const meter = el('span', 'hub-week-count', w.earned + '/' + w.goal);
      meter.setAttribute('aria-hidden', 'true');
      row.append(meter);
      rows.append(row);
    }
    host.replaceChildren();
    host.hidden = !any;
    if (!any) return;
    const legend = el('span', 'hub-week-legend');
    legend.setAttribute('aria-hidden', 'true');
    for (const n of dayNames) legend.append(el('i', '', n));
    head.append(legend);
    host.append(head, rows);
  }

  /* ── Pins ─────────────────────────────────────────────────────────────────── */
  const pins = () => { const p = read(PINS, []); return Array.isArray(p) ? p.filter(x => typeof x === 'string') : []; };
  function togglePin(file) {
    const list = pins(), at = list.indexOf(file);
    if (at >= 0) list.splice(at, 1); else list.push(file);
    try { localStorage.setItem(PINS, JSON.stringify(list)); } catch {}
    paintPins();
    return at < 0;
  }
  function paintPins() {
    let host = document.getElementById('hub-pins');
    const list = pins(), cards = [...document.querySelectorAll('a.hub-card')];
    const chosen = list.map(f => cards.find(c => fileOf(c.href) === f || c.dataset.hubId === f)).filter(Boolean);
    if (!host) {
      host = el('section', 'hub-recents hub-pins');
      host.id = 'hub-pins';
      host.setAttribute('aria-label', 'Pinned');
      (document.getElementById('hub-recents') || document.querySelector('.hub-areas'))?.before(host);
    }
    host.replaceChildren();
    host.hidden = !chosen.length;
    if (!chosen.length) return;
    const row = el('div', 'hub-recent-row');
    for (const card of chosen) {
      const a = el('a', 'hub-recent', card.querySelector('h3')?.textContent.trim());
      a.href = card.href;
      if (card.dataset.hud) { a.dataset.hud = card.dataset.hud; a.style.setProperty('--tile-raw', card.style.getPropertyValue('--tile-raw')); }
      row.append(a);
    }
    host.append(el('h2', '', 'Pinned'), row);
  }

  /* ── Command bar ──────────────────────────────────────────────────────────── */
  let dialog = null;
  function entries() {
    return [...document.querySelectorAll('a.hub-card')].map(card => ({
      card, file: card.dataset.hubId || fileOf(card.href), href: card.href,
      name: card.querySelector('h3')?.textContent.trim() || '',
      about: card.querySelector('p')?.textContent.trim() || '',
      area: card.closest('section')?.querySelector('h2')?.textContent.trim() || ''
    }));
  }
  const norm = s => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
  function score(item, q) {
    if (!q) return 1;
    const name = norm(item.name), words = q.split(' ');
    if (name === q) return 100;
    if (name.startsWith(q)) return 80;
    if (name.split(' ').some(w => w.startsWith(q))) return 60;
    const hay = norm(item.name + ' ' + item.about + ' ' + item.area);
    return words.every(w => hay.split(' ').some(t => t.startsWith(w))) ? 30 : 0;
  }
  function buildDialog() {
    dialog = el('dialog', 'hub-command');
    dialog.setAttribute('aria-label', 'Find a dashboard');
    const form = el('form', 'hub-command-form');
    form.method = 'dialog';
    const input = el('input', 'hub-command-input');
    Object.assign(input, {type: 'search', placeholder: 'Find a dashboard', autocomplete: 'off', spellcheck: false});
    input.setAttribute('aria-label', 'Find a dashboard');
    input.setAttribute('aria-controls', 'hub-command-results');
    const close = el('button', 'hub-command-close', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => dialog.close());
    form.append(input, close);
    const list = el('ul', 'hub-command-results');
    list.id = 'hub-command-results';
    const hint = el('p', 'hub-command-hint', 'Enter opens the first match · ☆ pins a dashboard to the top of Atlas');
    dialog.append(form, list, hint);
    document.body.append(dialog);
    const render = () => {
      const q = norm(input.value), pinned = pins();
      const found = entries().map(item => { const base = score(item, q); return {item, s: base && base + (pinned.includes(item.file) ? (q ? 1 : 50) : 0)}; }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, q ? 8 : 40);
      list.replaceChildren();
      if (!found.length) { list.append(el('li', 'hub-command-empty', 'No dashboard matches that.')); return; }
      for (const {item} of found) {
        const li = el('li', 'hub-command-row');
        const a = el('a', 'hub-command-link');
        a.href = item.href;
        if (item.card.dataset.hud) a.style.setProperty('--tile', item.card.style.getPropertyValue('--tile-raw') || 'var(--hud-hue)');
        a.append(el('span', 'hub-command-icon', item.card.querySelector('.hub-icon')?.textContent.trim() || '•'));
        const words = el('span', 'hub-command-words');
        words.append(el('b', '', item.name));
        const s = cache.get(fileOf(item.href)) || null;
        words.append(el('small', '', s?.text || item.area));
        a.append(words);
        a.querySelector('.hub-command-icon').setAttribute('aria-hidden', 'true');
        const pin = el('button', 'hub-command-pin', pinned.includes(item.file) ? '★' : '☆');
        pin.type = 'button';
        pin.setAttribute('aria-pressed', String(pinned.includes(item.file)));
        pin.setAttribute('aria-label', (pinned.includes(item.file) ? 'Unpin ' : 'Pin ') + item.name);
        pin.addEventListener('click', () => { const on = togglePin(item.file); pin.textContent = on ? '★' : '☆'; pin.setAttribute('aria-pressed', String(on)); pin.setAttribute('aria-label', (on ? 'Unpin ' : 'Pin ') + item.name); });
        li.append(a, pin);
        list.append(li);
      }
    };
    input.addEventListener('input', render);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const first = list.querySelector('.hub-command-link');
      if (first) { dialog.close(); first.click(); }
    });
    dialog.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const links = [...list.querySelectorAll('.hub-command-link')];
      if (!links.length) return;
      e.preventDefault();
      const at = links.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (at < 0 ? 0 : Math.min(at + 1, links.length - 1)) : at <= 0 ? -1 : at - 1;
      (next < 0 ? input : links[next]).focus();
    });
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.render = render;
    dialog.input = input;
  }
  function openCommand() {
    if (!dialog) buildDialog();
    if (dialog.open) return;
    dialog.input.value = '';
    dialog.render();
    dialog.showModal();
    dialog.input.focus();
  }
  function mountSearchButton() {
    const nav = document.querySelector('.hub-areas');
    if (!nav || nav.querySelector('.hub-search')) return;
    const b = el('button', 'hub-search');
    b.type = 'button';
    b.setAttribute('aria-label', 'Find a dashboard');
    b.setAttribute('aria-keyshortcuts', '/ Control+K Meta+K');
    b.append(el('span', '', 'Search'), el('kbd', '', '/'));
    b.lastChild.setAttribute('aria-hidden', 'true');
    b.addEventListener('click', openCommand);
    nav.prepend(b);
  }
  document.addEventListener('keydown', e => {
    const typing = e.target.closest?.('input,textarea,select,[contenteditable="true"]');
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openCommand(); }
    else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); openCommand(); }
  });

  /* ── Refresh ──────────────────────────────────────────────────────────────── */
  function refresh() {
    paintTiles();
    paintWeek();
    paintPins();
    window.dispatchEvent(new Event('atlas:hub-live'));
  }
  async function loadCourier() {
    try {
      const r = await fetch('courier/manifest.json', {cache: 'no-cache'});
      if (!r.ok) return;
      const data = await r.json(), today = dayOf();
      courierLatest = (Array.isArray(data.days) ? data.days : []).map(d => d?.date).filter(d => typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d) && d <= today).sort().at(-1) || null;
      refresh();
    } catch { /* The Courier tile falls back to when it was last opened. */ }
  }

  window.AtlasHubLive = {status: href => cache.get(fileOf(href)) ?? statusFor(href, [...document.querySelectorAll('a.hub-card')].find(c => fileOf(c.href) === fileOf(href))), open: openCommand};
  function init() {
    root.classList.add('hub-live-on');
    mountSearchButton();
    refresh();
    // The HUD tags tiles with their colours a frame later; repaint pins once that has happened.
    requestAnimationFrame(() => requestAnimationFrame(refresh));
    loadCourier();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
