/* Each dashboard owns its calendar. Read its saved records when the calendar opens. */
(() => {
  'use strict';
  const app = document.documentElement.dataset.atlasApp;
  const daily = [0, 1, 2, 3, 4, 5, 6];
  const apps = {
    'life-ledger': ['Life Ledger', 'saved days', 'Open today’s check-in', 'Save a habit check-in or reflection.', daily, '#6de4ef'],
    'communication-trainer': ['Communicator', 'practice days', 'Open practice', 'Finish and save a speaking drill.', [2, 4, 6], '#bfa9fa'],
    'workout-forge': ['Forge', 'training days', 'Open workout', 'Log a workout or finish a goal session.', [1, 3, 5], '#85e3c7'],
    'life-map': ['Life Map', 'plan days', 'Open today’s plan', 'Complete a task on your board.', [1, 2, 3, 4, 5, 6], '#70dce8'],
    courier: ['Courier', 'listening days', 'Open briefing', 'Finish listening to one briefing section.', daily, '#ffac9a'],
    library: ['Library', 'reading days', 'Open books', 'Log new pages in a book.', [2, 4, 6], '#91c8ff']
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
  function weeklyProgress(rows, settings, today) {
    const cursor = dayDate(today);
    cursor.setDate(cursor.getDate() - (cursor.getDay() + 6) % 7);
    const start = dayOf(cursor);
    let goal = 0, saved = 0, end = start;
    for (let i = 0; i < 7; i++) {
      end = dayOf(cursor);
      if (isPlanned(settings, end)) goal++;
      if (end <= today && rows.has(end)) saved++;
      cursor.setDate(cursor.getDate() + 1);
    }
    const savedToday = rows.has(today);
    const remainingDays = 7 - (dayDate(today).getDay() + 6) % 7 - Number(savedToday);
    return {start, end, goal, saved, savedToday, remainingDays, earned: Math.min(saved, goal)};
  }

  const svg = (tag, attrs) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };

  function inkMark() {
    const x = svg('svg', {viewBox:'0 0 36 36', class:'acc-ink-mark', 'aria-hidden':'true'});
    for (const d of ['M6 6 Q16 16 30 29', 'M29 5 Q17 19 7 30']) {
      x.append(svg('path', {d, pathLength:1}));
    }
    return x;
  }

  function ring(week) {
    const dial = e('div',null,'acc-dial');
    const face = svg('svg',{viewBox:'0 0 100 100',class:'acc-face','aria-hidden':'true'});
    face.append(svg('circle',{cx:50,cy:50,r:46,class:'acc-rim'}));
    if (week.goal) {
      const segment = 100 / week.goal, gap = Math.min(3,segment / 5);
      for (let i=0; i<week.goal; i++) {
        const filled = i < week.earned;
        face.append(svg('circle',{
          cx:50,cy:50,r:37,pathLength:100,
          transform:'rotate('+(-90 + 360*i/week.goal + gap*1.8)+' 50 50)',
          'stroke-dasharray':(segment-gap)+' '+(100-segment+gap),
          class:filled?'acc-segment acc-filled'+(i===week.earned-1?' acc-newest':''):'acc-segment'
        }));
      }
    }
    const number = e('strong',String(week.earned));
    number.append(e('small','/'+week.goal));
    const readout = e('div',null,'acc-readout');
    readout.append(number,e('span','days'));
    dial.append(face,readout);
    dial.setAttribute('role',week.goal?'progressbar':'img');
    dial.setAttribute('aria-label',week.goal?'Weekly goal':'No days scheduled this week');
    if (week.goal) {
      dial.setAttribute('aria-valuemin','0');
      dial.setAttribute('aria-valuemax',week.goal);
      dial.setAttribute('aria-valuenow',week.earned);
      dial.setAttribute('aria-valuetext',week.earned+' of '+week.goal+' '+unit);
    }
    return dial;
  }

  function weekWidget(week,rows,opened,settings,today,counts) {
    const box = e('div',null,'acc-week');
    const summary = e('div',null,'acc-week-summary');
    const text = e('div',null,'acc-week-copy');
    const left = week.goal-week.earned;
    const planned = isPlanned(settings,today);
    const previous = dayDate(today);
    do { previous.setDate(previous.getDate()-1); } while (!isPlanned(settings,dayOf(previous)));
    const previousDay = dayOf(previous);
    const returned = week.savedToday && !rows.has(previousDay) && [...rows.keys()].some(day=>day<previousDay);
    const single = {'life-ledger':'check-in','communication-trainer':'practice day','workout-forge':'workout','life-map':'plan day',courier:'listening day',library:'reading day'}[app];
    let heading = 'Mark today';
    if (week.goal && !left) heading = 'Weekly goal reached';
    else if (returned) heading = 'Back on track';
    else if (week.savedToday) heading = 'Today is marked';
    else if (!planned) heading = 'Rest day';
    else if (left===1) heading = 'One '+single+' to go';
    const goalLabel=week.goal===1?unit.replace(/days$/, 'day'):unit;
    let caption = 'This week’s goal is '+week.goal+' '+goalLabel+'.';
    if (!week.goal) caption = 'No days scheduled this week.';
    else if (week.saved>=week.goal) {
      const extra=week.saved-week.goal;
      caption=extra?'Weekly goal complete · '+extra+' extra '+(extra===1?'day':'days')+' logged.':(week.goal===1?'Your '+goalLabel+' is marked.':'All '+week.goal+' '+unit+' marked.');
    } else if (!planned && !week.savedToday) {
      const next=dayDate(today);
      do { next.setDate(next.getDate()+1); } while (!isPlanned(settings,dayOf(next)));
      caption='Next scheduled day · '+fmt(dayOf(next),{weekday:'short',month:'short',day:'numeric'});
    } else if (left>week.remainingDays && !week.savedToday) caption='Save today to add a mark to this week.';
    text.append(e('p',fmt(today,{weekday:'long',month:'short',day:'numeric'}),'acc-eyebrow'),e('h2',heading),e('p',caption));
    summary.append(ring(week),text);
    const strip = e('div',null,'acc-week-strip');
    strip.setAttribute('role','group');strip.setAttribute('aria-label','Activity this week');
    const cursor=dayDate(week.start);
    for(let i=0;i<7;i++,cursor.setDate(cursor.getDate()+1)){
      const day=dayOf(cursor);
      strip.append(dayButton(day,weekdays[cursor.getDay()],rows,opened,settings,today,true));
    }
    const weekLabel=e('div',null,'acc-strip-label');
    weekLabel.append(e('span','This week'));
    if(!window.AtlasStreak.hidden()){
      const monthDays=[...rows.keys()].filter(day=>day.slice(0,7)===today.slice(0,7)).length;
      if(counts.current>1)weekLabel.append(e('span',counts.current+' '+unit+' · current streak'));
      else if(monthDays)weekLabel.append(e('span',monthDays+(monthDays===1?' day':' days')+' marked this month'));
    }
    box.append(summary,weekLabel,strip);
    return box;
  }

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
    const compact = !active && app !== 'library' && app !== 'courier';
    const group = e(compact ? 'span' : 'nav',null,'acc-tabs');
    if (compact) group.setAttribute('role','navigation');
    group.setAttribute('aria-label',name + ' workspace');
    const home = button(name, () => { if (panel.open) leave(); },'acc-tab');
    const tab = button('', enter,'acc-tab');
    tab.append(e('span','Accountability','acc-tab-label'));
    tab.setAttribute('aria-label','Accountability');
    (active ? tab : home).setAttribute('aria-current','page');
    tab.setAttribute('aria-controls', panel.id);
    if (!active) home.disabled = true;
    if (!compact) group.append(home);
    group.append(tab);
    return group;
  }
  const entry = navButton(false);
  entry.id = 'atlas-accountability-tabs';
  // Enlarged text: the header link leaves the compact title slot and flows below the title.
  const probe = e('span',null,'acc-rem-probe');
  probe.setAttribute('aria-hidden','true');
  document.body.append(probe);
  // If even then the label cannot fit beside the header buttons, the dial alone stays (named by aria-label).
  const fitLabel = () => {
    entry.classList.remove('acc-icon-only');
    const slot = entry.closest('.appbar-title')?.parentElement, tab = entry.lastElementChild;
    if (!slot || !tab || !document.documentElement.classList.contains('acc-large-text')) return;
    if (tab.getBoundingClientRect().right > slot.getBoundingClientRect().right + 1) entry.classList.add('acc-icon-only');
  };
  const sizeText = () => { document.documentElement.classList.toggle('acc-large-text', probe.getBoundingClientRect().width > 20); fitLabel(); };
  if (window.ResizeObserver) { const watch = new ResizeObserver(sizeText); watch.observe(probe); requestAnimationFrame(() => { const bar = entry.closest('.appbar'); if (bar) watch.observe(bar); }); }
  requestAnimationFrame(sizeText);
  let hostWeek, freshMark;
  const miniDial=e('span',null,'acc-nav-mark');
  miniDial.setAttribute('aria-hidden','true');
  entry.lastElementChild.prepend(miniDial);
  const miniTrack = e('span',null,'acc-week-mini');
  miniTrack.setAttribute('aria-hidden','true');
  miniTrack.hidden = true;
  miniTrack.append(e('span'));
  entry.lastElementChild.append(miniTrack);
  entry.style.setProperty('--acc-accent',accent);
  function mount() {
    const anchor = document.querySelector(app === 'library' ? '.content>.topbar' : app === 'courier' ? 'body>header' : '.appbar .appbar-title, .appbar>h1>span');
    if (!anchor) return;
    if (app === 'library') {
      if (anchor.nextElementSibling === entry) return;
      anchor.after(entry);
    } else {
      if (entry.parentElement === anchor) return;
      anchor.append(entry);
    }
    refreshHost();
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
  function choose(day, fromWeek=false) {
    selected = day; month = day.slice(0,7); draw();
    wrap.querySelector((fromWeek?'.acc-week-strip ':'.acc-grid ')+'[aria-pressed="true"]')?.focus({preventScroll:true});
  }

  function dayButton(day,label,rows,opened,settings,today,weekly) {
    const planned=isPlanned(settings,day);
    const state=rows.has(day)?'saved':opened.has(day)?'opened':!planned?'off':day>today?'upcoming':'empty';
    const cell=button('',()=>choose(day,weekly),'acc-day');
    cell.dataset.state=state;cell.dataset.date=day;
    cell.append(e('span',label,'acc-day-label'));
    if(state==='saved')cell.append(inkMark());
    else if(!planned)cell.append(e('span','–','acc-day-off'));
    else if(state==='opened'||day===today)cell.append(e('span',null,'acc-open-dot'));
    const labels={saved:'Saved activity',opened:'Opened only',off:'Rest day',upcoming:'Upcoming',empty:'No activity recorded'};
    cell.setAttribute('aria-label',fmt(day,{month:'long',day:'numeric'})+', '+labels[state]+(state==='opened'&&!planned?', rest day':''));
    cell.setAttribute('aria-pressed',String(selected===day));
    if(day===today)cell.setAttribute('aria-current','date');
    return cell;
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
      grid.append(dayButton(day,String(i),rows,opened,settings,today,false));
    }
    const legend=e('div',null,'acc-legend');
    for(const [symbol,title] of [['✕','Saved'],['○','Opened only'],['–','Rest day']]) legend.append(e('span',symbol+' '+title));
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
        settingsOpen=false;arm();draw();wrap.querySelector('.acc-note').textContent='Schedule saved for '+name+'.';
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
    // Preserve an unfinished schedule edit. Its save explicitly redraws the view.
    if (!force && settingsOpen) return;
    const focused = !force && panel.contains(document.activeElement) ? document.activeElement : null;
    const focusDay = focused?.dataset.date;
    const focusGroup = focused?.closest('.acc-week-strip') ? '.acc-week-strip' : '.acc-grid';
    const focusLabel = focused?.getAttribute('aria-label') || focused?.textContent;
    const title=e('h1','Accountability');title.id='acc-title';title.tabIndex=-1;
    const identity=e('header',null,'acc-head');identity.append(e('p',name,'acc-eyebrow'),title);
    const content=e('div',null,'acc-layout');wrap.replaceChildren(navButton(true),identity,content);
    try {
      const today=dayOf(),rows=records(),opened=visits(),settings=prefs(),done=rows.has(today),planned=isPlanned(settings,today);
      const counts=streaks(rows,settings,today),todayCard=e('section',null,'acc-card acc-today');
      const now=new Date(),time=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
      const due=planned&&!done&&settings.time&&time>=settings.time;
      const week = weeklyProgress(rows,settings,today);
      const todayBody = e('div',null,'acc-today-body');
      todayCard.append(weekWidget(week,rows,opened,settings,today,counts),todayBody);
      const selectedEntries=rows.get(selected);
      const status=selected!==today?fmt(selected,{weekday:'long',month:'short',day:'numeric'}):done?'Saved today':due?'Reminder · Today':planned?'Today’s activity':'Rest day';
      const receipt=e('div',null,'acc-receipt');receipt.setAttribute('role','status');
      const preview=selectedEntries?selectedEntries[0]+(selectedEntries.length>1?' · +'+(selectedEntries.length-1)+' more':'')
        :selected===today&&planned?rule:!isPlanned(settings,selected)?'Scheduled rest day':selected>today?'Scheduled activity':'No saved activity.';
      receipt.append(e('p',status,'acc-eyebrow'),e('p',preview,'acc-receipt-text'));
      const controls=e('div',null,'acc-week-actions');
      if(selected!==today)controls.append(button('Back to today',()=>choose(today,true),'acc-primary'));
      else if(!done)controls.append(button(action,openActivity,'acc-primary'));
      controls.append(button('View month',()=>{
        const monthHeading=wrap.querySelector('.acc-month h2');
        monthHeading.tabIndex=-1;monthHeading.focus({preventScroll:true});monthHeading.scrollIntoView({block:'start'});
      },'acc-month-link'));
      todayBody.append(receipt,controls);
      const stats=e('section',null,'acc-card acc-stats');
      stats.append(e('p','Current streak','acc-eyebrow'),e('strong',String(counts.current)),e('span',unit),e('p','Personal best · '+counts.longest));
      const info=e('details');info.append(e('summary','How streaks work'),e('p',rule+' '+(weekAt(settings,today).length===7 && initialWeek.length===7 && settings.revisions.every(r=>r.week.length===7)?window.AtlasStreak.rule:'Scheduled days count once each. Off days preserve the streak.')));
      stats.append(info);stats.hidden=window.AtlasStreak.hidden();
      const detail=e('section',null,'acc-card acc-detail');detail.setAttribute('aria-live','polite');
      detail.append(e('p','Activity record','acc-eyebrow'),e('h3',fmt(selected,{weekday:'long',month:'short',day:'numeric'})));
      const entries=rows.get(selected);
      if(entries){const list=e('ul');for(const record of entries)list.append(e('li',record));detail.append(list);}
      else detail.append(e('p',opened.has(selected)?'Dashboard opened. No saved activity for this day.':selected>today?'Upcoming day.': 'No saved activity for this day.'));
      if(app==='courier')detail.append(e('small','Listening dates are recorded from this release. Older editions retain their heard marks in the player.'));
      const options=e('div',null,'acc-prefs');options.append(...schedule(settings,today,done));
      const monthCard=calendar(rows,opened,settings,today);
      monthCard.append(detail);
      content.append(todayCard,monthCard,stats,options);
      if(freshMark && freshMark.day===today && done && Date.now()-freshMark.at < 8000) {
        for(const mark of todayCard.querySelectorAll('[aria-current=date]'))mark.classList.add('acc-fresh-mark');
        todayCard.classList.add('acc-new-credit');
        if(freshMark.goal)todayCard.classList.add('acc-goal-flare');
        freshMark=null;
      }
      if(focusDay)wrap.querySelector(focusGroup+' [data-date="'+focusDay+'"]')?.focus({preventScroll:true});
      else if(focused) {
        const target=[...wrap.querySelectorAll('button,summary,h1,h2')].find(n=>n.tagName===focused.tagName && (n.getAttribute('aria-label')||n.textContent)===focusLabel);
        target?.focus({preventScroll:true});
      }
    } catch {content.append(e('p','Saved activity could not be read on this device. Your original records are still in the dashboard.','acc-card'));}
  }
  function refreshHost(localSave=false) {
    if (!entry.isConnected || document.hidden) return;
    const tab = entry.lastElementChild;
    let due = false;
    try {
      const settings = prefs(), today = dayOf(), rows = records();
      const week = weeklyProgress(rows,settings,today);
      const newMark=localSave && hostWeek?.day===today && !hostWeek.savedToday && week.savedToday;
      const justReached=Boolean(newMark && week.goal && hostWeek.goal===week.goal && hostWeek.earned<week.goal && week.earned===week.goal);
      if(newMark)freshMark={day:today,at:Date.now(),goal:justReached};
      if(!hostWeek || hostWeek.day!==today || hostWeek.goal!==week.goal || hostWeek.earned!==week.earned || hostWeek.savedToday!==week.savedToday){
        const icon=ring(week).firstElementChild;
        miniDial.replaceChildren(icon);
        if(week.savedToday)miniDial.append(inkMark());
        miniDial.classList.toggle('acc-fresh-mark',Boolean(newMark));
        miniDial.classList.toggle('acc-goal-flare',justReached);
        tab.dataset.marked=String(week.savedToday);
      }
      hostWeek={...week,day:today};
      miniTrack.hidden = !week.goal;
      miniTrack.style.setProperty('--week-fill',String(week.goal ? week.earned / week.goal : 0));
      tab.title = 'Weekly goal · '+week.earned+' of '+week.goal+' '+unit;
      const time = new Date().toTimeString().slice(0,5);
      due = Boolean(settings.time && time >= settings.time && isPlanned(settings,today) && !rows.has(today));
    } catch {
      miniTrack.hidden = true;
      tab.removeAttribute('title');
    }
    tab.classList.toggle('acc-due',due);
    tab.setAttribute('aria-label',due?'Accountability · Activity due':'Accountability');
  }
  let clock;
  function arm(localSave=false) {
    clearTimeout(clock);
    if (document.hidden) return;
    refreshHost(localSave===true);
    const now = new Date(), next = new Date(now);
    next.setHours(24,0,0,0);
    try {
      const time = prefs().time;
      if (time) {
        const [hours,minutes] = time.split(':').map(Number);
        const reminder = new Date(now);
        reminder.setHours(hours,minutes,0,0);
        if (reminder > now) next.setTime(reminder.getTime());
      }
    } catch {}
    clock = setTimeout(() => { recordVisit(); arm(); draw(false); }, next - now + 30);
  }
  function refreshProgress(event) {
    arm(event.type==='atlas:accountability-record' || event.type==='atlas-reminder-activity');
    draw(false);
  }
  panel.addEventListener('close',arm);
  window.addEventListener('storage',refreshProgress);
  window.addEventListener('atlas:accountability-record',refreshProgress);
  window.addEventListener('atlas-reminder-activity',refreshProgress);
  document.addEventListener('visibilitychange',()=>{recordVisit();arm();draw(false);});
  window.addEventListener('atlas-streak-preference',()=>draw());
  recordVisit();syncView();arm();
})();
