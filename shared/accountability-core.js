/* Accountability core: which days count as saved activity for each of the six
   Accountability dashboards, and how a week measures against its goal. Pure and
   read-only. Used by each dashboard's calendar (shared/accountability.js) and by the
   Atlas week strip (shared/hub-live.js), so both always agree. */
(() => {
  'use strict';
  if (globalThis.AtlasAccountabilityCore) return;
  const daily = [0, 1, 2, 3, 4, 5, 6];
  // id: [name, unit, action, rule, default week (0 = Sunday), accent, page]
  const apps = {
    'life-ledger': ['Life Ledger', 'saved days', 'Open today’s check-in', 'Save a habit check-in or reflection.', daily, '#6de4ef', 'life-ledger.html'],
    'communication-trainer': ['Communicator', 'practice days', 'Open practice', 'Finish and save a speaking drill.', [2, 4, 6], '#bfa9fa', 'communication-trainer.html'],
    'workout-forge': ['Forge', 'training days', 'Open workout', 'Log a workout or finish a goal session.', [1, 3, 5], '#85e3c7', 'workout-forge.html'],
    'life-map': ['Life Map', 'plan days', 'Open today’s plan', 'Complete a task on your board.', [1, 2, 3, 4, 5, 6], '#70dce8', 'life-map.html'],
    courier: ['Courier', 'listening days', 'Open briefing', 'Finish listening to one briefing section.', daily, '#ffac9a', 'courier.html'],
    library: ['Library', 'reading days', 'Open books', 'Log new pages in a book.', [2, 4, 6], '#91c8ff', 'the-library.html']
  };

  function localDay(date = new Date()) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  const dayOf = date => (globalThis.AtlasStreak?.localDay || localDay)(date);
  const dayDate = day => new Date(day + 'T12:00:00');
  const dateKey = value => {
    if (typeof value !== 'string') return '';
    if (/^\d{4}-\d\d-\d\d$/.test(value)) return dayOf(dayDate(value)) === value ? value : '';
    const timestamp = new Date(value);
    return Number.isFinite(+timestamp) ? dayOf(timestamp) : '';
  };

  // read(key, fallback) returns parsed JSON; it may throw, and callers decide how to report that.
  function records(app, read) {
    const rows = new Map(), today = dayOf();
    function add(date, text) {
      const d = dateKey(date);
      if (!d || d > today) return;
      if (!rows.has(d)) rows.set(d, []);
      rows.get(d).push(String(text));
    }
    if (app === 'life-ledger') {
      for (const row of read('lifeledger:v2', [])) {
        const habits = Object.entries(row.units || {}).filter(([, n]) => n > 0);
        for (const [habit] of habits) add(row.date, habit);
        if (row.note?.trim() || row.mood) add(row.date, 'Reflection saved');
      }
    } else if (app === 'communication-trainer') {
      for (const rep of read('mc_reps', [])) add(rep.date, rep.drill || 'Practice drill');
    } else if (app === 'workout-forge') {
      const labels = {PUSH: 'Push', PULL: 'Pull', LEGS: 'Legs', ENGINE: 'Engine'};
      for (const session of read('forge:sessions:v2', [])) add(session.date, (labels[session.type] || session.type || 'Training') + ' workout');
      for (const [goal, plan] of Object.entries(read('forge:goals:v1', {}).plans || {})) {
        for (const [session, day] of Object.entries(plan.completed || {})) add(day, goal + ' · session ' + session);
      }
    } else if (app === 'life-map') {
      for (const task of read('lifemap_v1', {}).projects || []) {
        if (task.status === 'Done') add(task.doneAt, task.task || 'Task completed');
      }
    } else if (app === 'library') {
      const data = read('atlas.library.v1', {});
      const books = new Map((data.catalog || []).map(b => [b.id, b.title]));
      for (const [day, entries] of Object.entries(data.reading?.daily || {})) {
        for (const [id, pages] of Object.entries(entries)) {
          if (pages > 0) add(day, (books.get(id) || 'Reading') + ' · ' + pages + (pages === 1 ? ' page' : ' pages'));
        }
      }
    } else if (app === 'courier') {
      for (const [day, entries] of Object.entries(read('courier:state', {}).listeningDays || {})) {
        for (const section of Object.values(entries)) add(day, section.label + ' · ' + section.edition);
      }
    }
    return rows;
  }

  function prefs(app, read) {
    const settings = read('atlas.accountability.' + app + '.schedule', {});
    const revisions = Array.isArray(settings.revisions) ? settings.revisions.filter(r =>
      dateKey(r.start) && Array.isArray(r.week) && r.week.length && r.week.every(n => Number.isInteger(n) && n >= 0 && n < 7)) : [];
    return {revisions, time: /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.time) ? settings.time : ''};
  }
  const weekAt = (app, settings, day) => settings.revisions.findLast(r => r.start <= day)?.week || apps[app][4];
  const isPlanned = (app, settings, day) => weekAt(app, settings, day).includes(dayDate(day).getDay());

  function weeklyProgress(app, rows, settings, today) {
    const cursor = dayDate(today);
    cursor.setDate(cursor.getDate() - (cursor.getDay() + 6) % 7);
    const start = dayOf(cursor);
    let goal = 0, saved = 0, end = start;
    const days = [];
    for (let i = 0; i < 7; i++) {
      end = dayOf(cursor);
      const planned = isPlanned(app, settings, end), done = end <= today && rows.has(end);
      if (planned) goal++;
      if (done) saved++;
      days.push({day: end, planned, saved: done, past: end < today, today: end === today});
      cursor.setDate(cursor.getDate() + 1);
    }
    const savedToday = rows.has(today);
    const remainingDays = 7 - (dayDate(today).getDay() + 6) % 7 - Number(savedToday);
    return {start, end, goal, saved, savedToday, remainingDays, earned: Math.min(saved, goal), days};
  }

  globalThis.AtlasAccountabilityCore = {apps, dayOf, dayDate, dateKey, records, prefs, weekAt, isPlanned, weeklyProgress};
})();
