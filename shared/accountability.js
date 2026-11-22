/* Each dashboard owns its calendar. Read its saved records when the calendar opens. */
(() => {
  'use strict';
  const app = document.documentElement.dataset.atlasApp;
  const daily = [0, 1, 2, 3, 4, 5, 6];
  const apps = {
    'life-ledger': ['Life Ledger', 'saved days', 'Open today’s check-in', 'Save a habit check-in or reflection.', daily, '#92ead1'],
    'communication-trainer': ['Communicator', 'practice days', 'Open practice', 'Finish and save a speaking drill.', [2, 4, 6], '#c6acff'],
    'workout-forge': ['Forge', 'training days', 'Open workout', 'Log a workout or finish a goal session.', [1, 3, 5], '#ffb391'],
    'life-map': ['Life Map', 'plan days', 'Open today’s plan', 'Complete a task on your board.', [1, 2, 3, 4, 5, 6], '#edce94'],
    courier: ['Courier', 'listening days', 'Open briefing', 'Finish listening to one briefing section.', daily, '#93d2ff'],
    library: ['Library', 'reading days', 'Open books', 'Log new pages in a book.', [2, 4, 6], '#e3bdf7']
  };
  if (!apps[app] || !window.AtlasStreak) return;
  const [name, unit, action, rule, initialWeek, accent] = apps[app];
  const prefix = 'atlas.accountability.' + app + '.';
  const dayOf = window.AtlasStreak.localDay;
  const dayDate = day => new Date(day + 'T12:00:00');
  const fmt = (day, options) => dayDate(day).toLocaleDateString('en-CA', options);
  const read = (key, fallback) => {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  };
  const e = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const button = (title, fn, cls) => {
    const b = e('button', title, cls); b.type = 'button'; b.addEventListener('click', fn); return b;
  };
  const dateKey = value => {
    if (typeof value !== 'string') return '';
    if (/^\d{4}-\d\d-\d\d$/.test(value)) return dayOf(dayDate(value)) === value ? value : '';
    const timestamp = new Date(value);
    return Number.isFinite(+timestamp) ? dayOf(timestamp) : '';
  };

  function records() {
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
    } else {
      for (const [day, entries] of Object.entries(read('courier:state', {}).listeningDays || {})) {
        for (const section of Object.values(entries)) add(day, section.label + ' · ' + section.edition);
      }
    }
    return rows;
  }

  // Keep each visit in its own key so simultaneous days or tabs cannot overwrite history.
  function recordVisit() {
    if (document.hidden) return;
    try {
      const key = prefix + 'visit.' + dayOf();
      if (!localStorage.getItem(key)) localStorage.setItem(key, new Date().toISOString());
    } catch { /* The calendar displays its storage error if the device blocks access. */ }
  }
  function visits() {
    const days = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix + 'visit.')) days.add(key.slice(-10));
    }
    for (const event of read('atlas:activity:v1', {}).events || []) {
      if (event.app === app && ['open','session','engaged'].includes(event.type)) days.add(dateKey(event.at));
    }
    return days;
  }
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const weekOrder = [1,2,3,4,5,6,0];
  function prefs() {
    const settings = read(prefix + 'schedule', {});
    const revisions = Array.isArray(settings.revisions) ? settings.revisions.filter(r =>
      dateKey(r.start) && Array.isArray(r.week) && r.week.length && r.week.every(n => Number.isInteger(n) && n >= 0 && n < 7)) : [];
    return {revisions, time: /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.time) ? settings.time : ''};
  }
  const weekAt = (settings, day) => settings.revisions.findLast(r => r.start <= day)?.week || initialWeek;
  const isPlanned = (settings, day) => weekAt(settings, day).includes(dayDate(day).getDay());
  function streaks(rows, settings, today) {
    const hits = [...rows.keys()].sort();
    if (!hits.length) return {current:0, longest:0};
    if (initialWeek.length === 7 && settings.revisions.every(r => r.week.length === 7)) return window.AtlasStreak.compute(hits,today);
    let current = 0, longest = 0;
    for (let d = dayDate(hits[0]); dayOf(d) <= today; d.setDate(d.getDate()+1)) {
      const day = dayOf(d);
      if (!isPlanned(settings,day)) continue;
      if (rows.has(day)) { current++; longest = Math.max(longest,current); }
      else if (day < today) current = 0;
    }
    return {current,longest};
  }

  const panel = e('dialog',null,'acc-screen');
  panel.id = 'atlas-accountability'; panel.setAttribute('aria-labelledby','acc-title');
  panel.style.setProperty('--acc-accent',accent);
  const wrap = e('div',null,'acc-wrap');
  panel.append(wrap); document.body.append(panel);
  let selected = dayOf(), month = selected.slice(0,7), settingsOpen = false, opener, nextTick;
  function navButton(active) {
    const group = e('nav',null,'acc-tabs');
    group.setAttribute('aria-label',name + ' workspace');
    const home = button(name, () => { if (panel.open) leave(); },'acc-tab');
    const tab = button('Accountability', enter,'acc-tab');
    (active ? tab : home).setAttribute('aria-current','page');
    tab.setAttribute('aria-controls', panel.id);
    if (!active) home.disabled = true;
    group.append(home,tab);
    return group;
  }
  const entry = navButton(false);
  entry.id = 'atlas-accountability-tabs';
  function mount() {
    const anchor = document.querySelector(app === 'library' ? '.content>.topbar' : app === 'courier' ? 'body>header' : '.appbar');
    if (!anchor) return;
    if (app === 'library') {
      if (anchor.nextElementSibling !== entry) anchor.after(entry);
    } else if (entry.parentElement !== anchor) {
      anchor.append(entry);
    }
  }
  mount();
  const host = document.getElementById('app') || (app === 'library' ? document.querySelector('.content') : document.body);
  new MutationObserver(mount).observe(host || document.body,{childList:true});
  function enter() {
    if (panel.open) return;
    opener = document.activeElement;
    const url = new URL(location.href);
    if (url.searchParams.get('view') !== 'accountability') {
      url.searchParams.set('view','accountability');
      history.pushState({...history.state,atlasAccountability:true},'',url);
    }
    selected = dayOf(); month = selected.slice(0,7); settingsOpen = false;
    panel.showModal(); panel.scrollTop = 0; document.documentElement.classList.add('acc-showing');
    draw();
    wrap.querySelector('h1').focus({preventScroll:true});
    nextTick = setInterval(() => { if (!document.hidden && !settingsOpen) draw(false); },60000);
  }
  function closeView() {
    if (!panel.open) return;
    clearInterval(nextTick); panel.close(); document.documentElement.classList.remove('acc-showing');
    (opener?.isConnected && opener !== document.body ? opener : entry.lastElementChild)?.focus({preventScroll:true});
  }
  let afterLeave;
  function leave(onReturn) {
    afterLeave = typeof onReturn === 'function' ? onReturn : null;
    closeView();
    if (history.state?.atlasAccountability) { history.back(); return; }
    const url = new URL(location.href); url.searchParams.delete('view');history.replaceState(history.state,'',url);
    finishLeaving();
  }
  function finishLeaving() {
    const action = afterLeave; afterLeave = null; action?.();
  }
  function syncView() {
    if (new URL(location.href).searchParams.get('view') === 'accountability') enter(); else { closeView(); finishLeaving(); }
  }
  panel.addEventListener('cancel',event=>{event.preventDefault();leave();});
  window.addEventListener('popstate',syncView);
  function choose(day) {
    selected = day; month = day.slice(0,7); draw();
    wrap.querySelector('[aria-pressed="true"][data-date]')?.focus({preventScroll:true});
  }
  function stepMonth(offset) {
    const d = dayDate(month+'-01');d.setMonth(d.getMonth()+offset);
    const last = new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    d.setDate(Math.min(Number(selected.slice(-2)),last));choose(dayOf(d));
  }
  function calendar(rows, opened, settings, today) {
    const box = e('section',null,'acc-card acc-month');
    const header = e('div',null,'acc-row');
    const back = button('‹',()=>stepMonth(-1),'acc-arrow'), next=button('›',()=>stepMonth(1),'acc-arrow');
    back.setAttribute('aria-label','Previous month');next.setAttribute('aria-label','Next month');
    const monthTitle = e('h2',fmt(month+'-01',{month:'long',year:'numeric'}));
    const controls = e('div',null,'acc-controls');controls.append(back,button('Today',()=>choose(today)),next);
    header.append(monthTitle,controls);box.append(header);
    const grid = e('div',null,'acc-grid');
    for (const i of weekOrder) grid.append(e('span',weekdays[i].slice(0,1),'acc-weekday'));
    const first = dayDate(month+'-01');
    for (let i=0;i<(first.getDay()+6)%7;i++) grid.append(e('span'));
    const days = new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
    for(let i=1;i<=days;i++) {
      const day = month+'-'+String(i).padStart(2,'0');
      const state = rows.has(day) ? 'saved' : opened.has(day) ? 'opened' : !isPlanned(settings,day) ? 'off' : day>today ? 'upcoming' : 'empty';
      const cell = button(String(i),()=>choose(day),'acc-day');
      cell.dataset.state=state;cell.dataset.date=day;
      const labels={saved:'Saved activity',opened:'Opened only',off:'Off day',upcoming:'Upcoming',empty:'No activity recorded'};
      cell.setAttribute('aria-label',fmt(day,{month:'long',day:'numeric'})+', '+labels[state]);
      cell.setAttribute('aria-pressed',String(selected===day));
      if(day===today) cell.setAttribute('aria-current','date');
      grid.append(cell);
    }
    const legend=e('div',null,'acc-legend');
    for(const [symbol,title] of [['●','Saved'],['○','Opened only'],['–','Off day']]) legend.append(e('span',symbol+' '+title));
    box.append(grid,legend);return box;
  }
  function openActivity() {
    leave(() => {
    if (app==='life-ledger') document.getElementById('ledger-nav-today')?.click();
    else if (app==='communication-trainer') window.nav?.('train');
    else if (app==='life-map') window.LifeMapDay?.choose('home');
    else if (app==='library') location.hash='books';
    else if (app==='workout-forge') document.querySelector('#forge-goals,.forge-live-record')?.scrollIntoView({block:'start'});
    else document.getElementById('courier-opening')?.scrollIntoView({block:'start'});
    });
  }
  function schedule(settings,today,done) {
    const details=e('details',null,'acc-card acc-settings');details.open=settingsOpen;
    const week=weekAt(settings,today);
    const rhythm=week.length===7?'Daily':weekOrder.filter(n=>week.includes(n)).map(n=>weekdays[n]).join(' · ');
    details.append(e('summary','Schedule & reminder'));
    const copy=e('p','Choose your activity days. An optional reminder appears in this dashboard after the time you set.');
    const form=e('form');const set=e('fieldset');set.append(e('legend','Activity days'));
    for (const i of weekOrder) {
      const label=e('label'),input=e('input');input.type='checkbox';input.value=String(i);input.checked=week.includes(i);
      label.append(input,document.createTextNode(weekdays[i]));set.append(label);
    }
    const label=e('label','In-app reminder time'),input=e('input');input.type='time';input.value=settings.time;label.append(input);
    const save=e('button','Save schedule','acc-primary');save.type='submit';
    const status=e('p');status.setAttribute('role','status');form.append(set,label,save,status);
    form.onsubmit=event=>{
      event.preventDefault();
      const days=[...set.querySelectorAll('input:checked')].map(n=>Number(n.value));
      if(!days.length){status.textContent='Choose at least one activity day.';return;}
      try {
        const latest=prefs(),revisions=latest.revisions.filter(r=>r.start!==today);
        if(days.slice().sort().join()!==weekAt({...latest,revisions},today).slice().sort().join()) revisions.push({start:today,week:days});
        localStorage.setItem(prefix+'schedule',JSON.stringify({revisions,time:input.value}));
        settingsOpen=false;draw();wrap.querySelector('.acc-note').textContent='Schedule saved for '+name+'.';
        wrap.querySelector('.acc-settings summary')?.focus({preventScroll:true});
      } catch {status.textContent='This browser could not save your schedule.';}
    };
    details.append(copy,form);
    details.addEventListener('toggle',()=>{if(details.isConnected)settingsOpen=details.open;});
    const summary=e('p',rhythm+(settings.time?' · '+new Date(today+'T'+settings.time).toLocaleTimeString('en-CA',{hour:'numeric',minute:'2-digit'}):''),'acc-note');
    summary.setAttribute('role','status');
    if(done && settings.time) summary.append(' · Today’s reminder cleared');
    return [details,summary];
  }
  function draw(force=true) {
    if(!panel.open) return;
    // Keep a focused calendar cell or an open editor stable during background refresh.
    if(!force && (settingsOpen || panel.contains(document.activeElement) && document.activeElement.matches('input,button,summary'))) return;
    const title=e('h1','Accountability');title.id='acc-title';title.tabIndex=-1;
    const identity=e('header',null,'acc-head');identity.append(e('p',name,'acc-eyebrow'),title);
    const content=e('div',null,'acc-layout');wrap.replaceChildren(navButton(true),identity,content);
    try {
      const today=dayOf(),rows=records(),opened=visits(),settings=prefs(),done=rows.has(today),planned=isPlanned(settings,today);
      const counts=streaks(rows,settings,today),todayCard=e('section',null,'acc-card acc-today');
      const now=new Date(),time=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
      const due=planned&&!done&&settings.time&&time>=settings.time;
      todayCard.append(e('p',due?'Reminder · Today':fmt(today,{weekday:'long',month:'short',day:'numeric'}),'acc-eyebrow'),
        e('h2',done?'Today’s activity is saved':planned?'Today is still open':'Today is an off day'),
        e('p',done?rows.get(today).join(' · '):planned?rule:'Your next scheduled session keeps your streak going.'));
      if(!done&&planned)todayCard.append(button(action,openActivity,'acc-primary'));
      const stats=e('section',null,'acc-card acc-stats');
      stats.append(e('p','Current streak','acc-eyebrow'),e('strong',String(counts.current)),e('span',unit),e('p','Personal best · '+counts.longest));
      const info=e('details');info.append(e('summary','How streaks work'),e('p',rule+' '+(weekAt(settings,today).length===7 && initialWeek.length===7 && settings.revisions.every(r=>r.week.length===7)?window.AtlasStreak.rule:'Scheduled days count once each. Off days preserve the streak.')));
      stats.append(info);stats.hidden=window.AtlasStreak.hidden();
      const detail=e('section',null,'acc-card acc-detail');detail.setAttribute('aria-live','polite');
      detail.append(e('p','Activity record','acc-eyebrow'),e('h2',fmt(selected,{weekday:'long',month:'short',day:'numeric'})));
      const entries=rows.get(selected);
      if(entries){const list=e('ul');for(const record of entries)list.append(e('li',record));detail.append(list);}
      else detail.append(e('p',opened.has(selected)?'Dashboard opened. No saved activity for this day.':selected>today?'Upcoming day.': 'No saved activity for this day.'));
      if(app==='courier')detail.append(e('small','Listening dates are recorded from this release. Older editions retain their heard marks in the player.'));
      const options=e('div',null,'acc-prefs');options.append(...schedule(settings,today,done));
      content.append(todayCard,stats,calendar(rows,opened,settings,today),detail,options);
    } catch {content.append(e('p','Saved activity could not be read on this device. Your original records are still in the dashboard.','acc-card'));}
  }
  function refreshHostReminder() {
    if(!entry.isConnected || document.hidden) return;
    let due=false;
    try {
      const settings=prefs(),today=dayOf(),now=new Date(),time=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
      due=Boolean(settings.time && time>=settings.time && isPlanned(settings,today) && !records().has(today));
    } catch {}
    const tab=entry.lastElementChild;
    if(tab.classList.contains('acc-due')!==due)tab.classList.toggle('acc-due',due);
    tab.setAttribute('aria-label',due?'Accountability · Activity due':'Accountability');
  }
  recordVisit();syncView();refreshHostReminder();
  // No timer runs on the dashboard unless a reminder time was chosen.
  let clock;
  function arm() {
    clearTimeout(clock);
    if(document.hidden)return;
    refreshHostReminder();
    try{if(prefs().time)clock=setTimeout(arm,60000-new Date().getSeconds()*1000);}catch{}
  }
  panel.addEventListener('close',arm);
  window.addEventListener('storage',()=>{arm();draw(false);});
  document.addEventListener('visibilitychange',()=>{recordVisit();arm();draw(false);});
  window.addEventListener('atlas:activity',event=>{if(event.detail?.kind==='meaningful')queueMicrotask(arm);});
  window.addEventListener('atlas-streak-preference',()=>draw());
  arm();
})();
