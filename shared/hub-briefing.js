/* Atlas morning boot. The first time Atlas opens each day (motion allowed), a
   full-screen start-up plays: rings assemble, each HUD system comes online, and a
   short briefing types out from data already on this device: Life Map tasks for
   today, the next reminder, and the last app opened. Tap or press any key to skip.
   Read-only: it parses saved records and never changes them; the only thing it
   stores is the date it last played (atlas:hud-briefed). */
(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset?.atlasApp !== 'atlas-hub' || window.AtlasBriefing) return;
  const KEY = 'atlas:hud-briefed';
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function due() {
    if (still() || navigator.webdriver === true) return false;
    try { return localStorage.getItem(KEY) !== today(); } catch { return false; }
  }
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const clock = hhmm => { const [h, m] = hhmm.split(':').map(Number); return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? ' AM' : ' PM'); };

  function lines() {
    const out = [], iso = today();
    // Life Map: open tasks planned or due today, and anything overdue.
    const map = read('lifemap_v1');
    if (map && Array.isArray(map.projects)) {
      const open = map.projects.filter(t => t && !t.archived && t.status !== 'Done');
      const now = open.filter(t => t.plan === iso || t.due === iso).length;
      const late = open.filter(t => t.due && t.due < iso).length;
      if (now || late) out.push('Life Map: ' + (now ? now + (now === 1 ? ' task' : ' tasks') + ' for today' : 'nothing planned for today') + (late ? ', ' + late + ' overdue' : '') + '.');
      else out.push('Life Map: your day is clear.');
    }
    // Reminders: the next one still to come today.
    const prefs = read('atlas.reminders.v1') || {paused: false, reminders: [{title: 'Choose what matters today', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6], enabled: true}, {title: 'Pick up your book', time: '20:30', days: [0, 1, 2, 3, 4, 5, 6], enabled: true}, {title: 'Give today its credit', time: '21:00', days: [0, 1, 2, 3, 4, 5, 6], enabled: true}]};
    if (prefs.paused) out.push('Reminders are paused.');
    else if (Array.isArray(prefs.reminders)) {
      const d = new Date(), mins = d.getHours() * 60 + d.getMinutes();
      const next = prefs.reminders.filter(r => r && r.enabled && /^\d\d:\d\d$/.test(r.time || '') && (r.date ? r.date === iso : (r.days || []).includes(d.getDay())))
        .map(r => ({r, at: +r.time.slice(0, 2) * 60 + +r.time.slice(3)})).filter(x => x.at >= mins).sort((a, b) => a.at - b.at)[0];
      out.push(next ? 'Next reminder: ' + next.r.title + ' at ' + clock(next.r.time) + '.' : 'No more reminders today.');
    }
    // The last app opened, as Atlas already shows it.
    const recent = document.querySelector('#hub-recents a')?.textContent.trim();
    if (recent) out.push('Last opened: ' + recent.replace(/\s+/g, ' ') + '.');
    return out;
  }

  function play(systems) {
    try { localStorage.setItem(KEY, today()); } catch {}
    const shell = document.createElement('div');
    shell.className = 'hud-briefing';
    shell.setAttribute('aria-hidden', 'true');
    shell.innerHTML =
      '<div class="hb-stage">' +
        '<svg class="hb-core" viewBox="0 0 200 200"><circle cx="100" cy="100" r="96" class="r1"/><circle cx="100" cy="100" r="84" class="r2"/><circle cx="100" cy="100" r="70" class="r3"/><circle cx="100" cy="100" r="54" class="r4"/><circle cx="100" cy="100" r="36" class="r5"/><circle cx="100" cy="100" r="14" class="r6"/></svg>' +
        '<div class="hb-copy"><p class="hb-os">Atlas OS 5.0 // morning start-up</p><ul class="hb-systems"></ul><div class="hb-brief"><h2></h2><p class="hb-lines"></p></div></div>' +
      '</div><p class="hb-skip">Tap to skip</p>';
    document.body.append(shell);
    const list = shell.querySelector('.hb-systems');
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    systems.forEach((s, i) => later(() => {
      const li = document.createElement('li');
      li.style.setProperty('--sys', s.color);
      li.innerHTML = '<i></i><span></span><em>online</em>';
      li.querySelector('span').textContent = s.name;
      list.append(li);
    }, 500 + i * 85));
    const after = 500 + systems.length * 85 + 250;
    let text = '';
    const h2 = shell.querySelector('h2'), body = shell.querySelector('.hb-lines');
    // Worked out when typing starts, so Atlas has had time to list recent apps.
    later(() => { shell.classList.add('briefing'); h2.textContent = (document.getElementById('hub-greeting')?.textContent || 'Hello.').trim(); text = lines().concat(systems.length + ' HUD systems online. All systems nominal.').join('\n'); }, after);
    let n = 0;
    const type = () => { n += 2; body.textContent = text.slice(0, n); if (n < text.length) later(type, 18); else later(finish, 2200); };
    later(type, after + 450);
    let done = false;
    function finish() {
      if (done) return; done = true;
      timers.forEach(clearTimeout);
      shell.classList.add('out');
      setTimeout(() => shell.remove(), 650);
    }
    shell.addEventListener('pointerdown', finish);
    document.addEventListener('keydown', finish, {once: true});
    later(finish, 14000);
  }

  window.AtlasBriefing = {due, play};
})();
