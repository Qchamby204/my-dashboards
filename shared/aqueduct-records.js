/* Aqueduct record boundaries. Loaded before migration so unreadable data is never overwritten. */
(() => {
  'use strict';
  const plain = o => o !== null && typeof o === 'object' && !Array.isArray(o);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clone = o => JSON.parse(JSON.stringify(o));
  const validDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
  const validMonth = s => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  const number = v => v === '' || typeof v === 'number' && Number.isFinite(v) || typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && Number.isFinite(+v);
  const fail = text => { throw Error(text); };
  function safeKeys(o, depth = 0) {
    if (depth > 30) fail('The backup is too deeply nested.');
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) {
      if (['__proto__', 'constructor', 'prototype'].includes(k)) fail('Invalid record key.');
      safeKeys(v, depth + 1);
    }
  }
  function validate(s, complete = false) {
    if (!plain(s)) fail('Choose an Aqueduct backup.');
    safeKeys(s);
    const arrays = ['expenses', 'debts', 'goals', 'accounts', 'hhs', 'spends', 'hist'];
    for (const key of arrays) {
      if (!own(s, key) && !complete) continue;
      if (key === 'accounts' && plain(s[key]) && !complete) continue; // Pre-balance-sheet record.
      if (!Array.isArray(s[key])) fail('Invalid ' + key + ' records.');
      const seen = new Set();
      for (const row of s[key]) {
        if (!plain(row)) fail('Invalid ' + key + ' entry.');
        if (key !== 'hist') {
          if (typeof row.id !== 'string' || !/^[\w-]+$/.test(row.id) || seen.has(row.id)) fail('Invalid or duplicate ' + key + ' ID.');
          seen.add(row.id);
        }
        for (const k of ['name', 'cat', 'note', 'emoji']) if (own(row, k) && typeof row[k] !== 'string') fail('Invalid ' + k + '.');
        for (const k of ['amt', 'balance', 'rate', 'min', 'extra', 'target', 'ret', 'earmarked', 'contribMo', 'bal', 'cur', 'saved', 'debt', 'spend', 'net', 'nw']) if (own(row, k) && !number(row[k])) fail('Invalid numeric ' + k + '.');
        for (const k of ['d', 'ds', 'due']) if (row[k] && !validDay(row[k])) fail('Invalid calendar date.');
        if (key === 'hist' && !validMonth(row.ym)) fail('Invalid history month.');
        if (key === 'hhs' && (!validDay(row.d) || !['ext', 'ref'].includes(row.type))) fail('Invalid household entry.');
        if (key === 'spends' && !validDay(row.ds)) fail('Invalid spending date.');
      }
    }
    for (const key of ['fi', 'book', 'acctNames', 'rules', 'exec', '_drafts']) if (own(s, key) && !plain(s[key])) fail('Invalid ' + key + ' settings.');
    if (complete && (!plain(s.fi) || !plain(s.book) || !plain(s.acctNames) || !plain(s.rules) || !plain(s.exec) || !Array.isArray(s.cats))) fail('This backup is missing settings.');
    if (s.cats != null && (!Array.isArray(s.cats) || s.cats.some(c => typeof c !== 'string'))) fail('Invalid categories.');
    for (const key of ['aum', 'refPct', 'feeRate', 'gridLow', 'gridHigh', 'cliffRev', 'pensionPct', 'esopPct', 'esopCap', 'charityYr', 'otherIncMo']) if (own(s, key) && !number(s[key])) fail('Invalid ' + key + '.');
    for (const [key, value] of Object.entries(s.fi || {})) if (key !== 'lifestyleMode' && !number(value)) fail('Invalid financial setting.');
    for (const [key, value] of Object.entries(s.book || {})) if (key === 'startDate' ? value && !validDay(value) : !number(value)) fail('Invalid book setting.');
    for (const value of Object.values(s.acctNames || {})) if (typeof value !== 'string') fail('Invalid account label.');
    const buckets = ['enjoy', 'committed', 'debt', 'forward', 'income', 'ignore'];
    for (const value of Object.values(s.rules || {})) if (!buckets.includes(value)) fail('Invalid statement rule.');
    for (const [key, value] of Object.entries(s._drafts || {})) if (!['householdAmount', 'householdDate', 'householdType', 'statement'].includes(key) || typeof value !== 'string') fail('Invalid unfinished entry.');
    if (s.audit != null) {
      if (!plain(s.audit) || !Array.isArray(s.audit.txns)) fail('Invalid statement review.');
      const seen = new Set();
      for (const t of s.audit.txns) {
        if (!plain(t) || typeof t.id !== 'string' || !/^[\w-]+$/.test(t.id) || seen.has(t.id) || typeof t.desc !== 'string' || !Number.isFinite(t.amt) || t.amt <= 0 || typeof t.inflow !== 'boolean' || !buckets.includes(t.b) || t.d != null && !validDay(t.d) || !(t.ym === '?' || validMonth(t.ym))) fail('Invalid statement transaction.');
        seen.add(t.id);
      }
    }
    return clone(s);
  }
  const raw = {}; let blocked = false, unsaved = false, expected;
  function read(key, fallback) {
    try {
      const text = localStorage.getItem(key); raw[key] = text;
      if (key === 'aqueduct:v2') expected = text;
      if (text === null) return fallback;
      const value = JSON.parse(text); safeKeys(value);
      if (key === 'aqueduct:v2') return validate(value);
      if (key === 'climb_h' ? !Array.isArray(value) : !plain(value)) fail('Invalid saved records.');
      for(const k of ['expenses','debts','goals','spends','hist','allocations','fwd','bills'])if(value[k]!=null&&(!Array.isArray(value[k])||value[k].some(row=>!plain(row))))fail('Invalid legacy records.');
      return value;
    } catch { blocked = true; return fallback; }
  }
  function persist(s, replace = false) {
    if (blocked && !replace) return false;
    try {
      const current = localStorage.getItem('aqueduct:v2'), next = JSON.stringify(s);
      if(current===next){expected=next;blocked=false;unsaved=false;return true;}
      if (!replace && current !== expected) { unsaved = true; return false; }
      localStorage.setItem('aqueduct:v2', next);
      if (localStorage.getItem('aqueduct:v2') !== next) throw Error('Write not retained.');
      expected = next; blocked = false; unsaved = false; return true;
    } catch { unsaved = true; return false; }
  }
  window.AqueductRecords = Object.freeze({validate, validDay, validMonth, read, persist, get blocked() {return blocked;}, get unsaved() {return unsaved;}, recovery: () => clone(raw)});
})();
