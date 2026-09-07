import { addDays } from './model.mjs';
import { ledgerWeek } from './ledger.mjs';

const labels = { note: 'What mattered', tomorrow: 'What would help tomorrow' };
export function reflectionNotes(ledger, week) {
  return ledgerWeek(ledger, week).slice().sort((a,b)=>a.date.localeCompare(b.date)).flatMap(day =>
    ['note','tomorrow'].filter(field => day[field]?.trim()).map(field => ({
      id: `${day.date}:${field}`, date: day.date, field, label: labels[field], text: day[field]
    })));
}

// Compose the full result before changing either field. Oversized excerpts are
// rejected as a group, so nothing is truncated or partly copied into the draft.
export function appendReflections(current, excerpts) {
  const next = { worked: current.worked || '', change: current.change || '' };
  for (const row of excerpts) {
    if (!['worked','change'].includes(row.destination)) throw Error('Choose a review question for each note.');
    const text = row.text.trim();
    if (!text) throw Error('Keep a short excerpt in each selected note, or cancel and deselect it.');
    const block = `Life Ledger · ${row.date} · ${row.label}\n${text}`;
    if (next[row.destination].includes(block)) continue;
    next[row.destination] += (next[row.destination] ? '\n\n' : '') + block;
  }
  if (next.worked.length > 4000 || next.change.length > 4000) throw Error('Each review answer can hold 4,000 characters. Shorten the excerpts or select fewer notes. Your review is unchanged.');
  return next;
}

export function createReflectionUI({ api, getData, getWeek, load, render, error, toast, esc, downloadJSON, capture, blocked }) {
  const $ = s => document.querySelector(s);
  let draft = null, edited = false, saving = false, selected = new Map(), preview = [];
  const pretty = date => new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  function reset() {
    const current = getData().week;
    draft = { week_start: getWeek(), capacity: current?.capacity ?? 600, worked: current?.worked || '', change: current?.change || '', revision: current?.revision ?? 0 };
    edited = false; selected.clear(); preview = [];
  }
  function ensure() { if (!draft || (!edited && !selected.size && !saving)) reset(); }
  function syncStatus() {
    if ($('#review-draft-state')) $('#review-draft-state').textContent = saving ? 'Saving…' : edited ? 'Unsaved review draft' : 'Saved review';
    if ($('#reflection-selection-status')) $('#reflection-selection-status').textContent = `${selected.size} ${selected.size===1?'note':'notes'} selected`;
    if ($('#reflection-preview-open')) $('#reflection-preview-open').disabled = saving || !selected.size;
    if ($('#reflection-clear')) $('#reflection-clear').disabled = saving || !selected.size;
  }
  function form() {
    ensure();
    return `<form id="review-form" class="review-form"><label>What worked?<textarea name="worked" maxlength="4000" placeholder="Notice the conditions that helped you follow through.">${esc(draft.worked)}</textarea></label><label>What will you change?<textarea name="change" maxlength="4000" placeholder="One adjustment worth carrying into next week.">${esc(draft.change)}</textarea></label><p class="small">Time totals use your estimates. Atlas is not measuring hours worked.</p><p id="review-error" class="form-error" role="alert"></p><div class="review-actions"><button type="submit" class="primary">Save review</button><span id="review-draft-state" class="small" role="status">${edited?'Unsaved review draft':getData().week?'Saved review':'New review'}</span></div><div class="review-actions"><button type="button" class="text-button" data-review-download>Download draft</button><button type="button" class="text-button" data-review-discard>Discard draft & reload review</button></div></form>`;
  }
  function notes() {
    ensure(); const rows = reflectionNotes(getData().ledger, getWeek());
    return `<section class="panel reflection-panel" aria-labelledby="reflection-title"><h2 id="reflection-title">Carry a thought forward</h2><p class="small">Select saved Life Ledger notes to include in your review. You can shorten each excerpt before adding it.</p>${rows.length?`<fieldset class="reflection-choices"><legend class="sr-only">Notes from this week</legend>${rows.map(row=>`<article class="reflection-choice"><label class="reflection-select"><input type="checkbox" data-reflection-select="${row.id}"${selected.has(row.id)?' checked':''}><span><strong>${esc(pretty(row.date))}</strong><span class="small">${esc(row.label)}</span></span></label><p class="reflection-text">${esc(row.text)}</p><button type="button" class="text-button" data-reflection-capture="${row.id}">Plan an action from this note</button></article>`).join('')}</fieldset><div class="review-actions"><button class="secondary" id="reflection-preview-open"${selected.size?'':' disabled'}>Use selected notes</button><button class="text-button" id="reflection-clear"${selected.size?'':' disabled'}>Clear selection</button></div><p id="reflection-selection-status" class="small" role="status">${selected.size} ${selected.size===1?'note':'notes'} selected</p>`:'<p class="quiet-message">No reflection saved for this week yet. Add a note in Life Ledger, then return here.</p>'}<a class="inline-link" href="#ledger">Open Life Ledger</a></section>`;
  }
  document.addEventListener('input', e => {
    if (!e.target.closest('#review-form') || !['worked','change'].includes(e.target.name) || saving) return;
    ensure(); draft[e.target.name] = e.target.value; edited = true; syncStatus();
  });
  document.addEventListener('change', e => {
    const id = e.target.dataset?.reflectionSelect; if (!id) return;
    if (saving || blocked()) { e.target.checked = selected.has(id); return; }
    ensure(); const row = reflectionNotes(getData().ledger,getWeek()).find(row=>row.id===id);
    if (!row) return;
    if (e.target.checked) selected.set(id,structuredClone(row)); else selected.delete(id);
    syncStatus();
  });
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-review-download],[data-review-discard],#reflection-preview-open,#reflection-clear,[data-reflection-capture]');
    if (!t || saving) return;
    if (t.hasAttribute('data-review-download')) { ensure(); downloadJSON({app:'atlas-review-draft',version:1,exportedAt:new Date().toISOString(),review:structuredClone(draft),selectedNotes:[...selected.values()]},`atlas-review-draft-${draft.week_start}.json`); return; }
    if (t.hasAttribute('data-review-discard')) { reset(); render(); await load(); return; }
    if (blocked()) return;
    if (t.id === 'reflection-clear') { selected.clear(); document.querySelectorAll('[data-reflection-select]').forEach(x=>x.checked=false); syncStatus(); return; }
    if (t.hasAttribute('data-reflection-capture')) {
      if (edited || selected.size) { error('Save your review and clear any selected notes before planning a commitment.'); return; }
      const row = reflectionNotes(getData().ledger,getWeek()).find(row=>row.id===t.dataset.reflectionCapture);
      if (row) capture({title:row.text.trim().length<=300?row.text.trim():'',app_id:'life-ledger',week_start:addDays(getWeek(),7),source:{label:`Life Ledger · ${pretty(row.date)} · ${row.label}`,text:row.text}});
      return;
    }
    if (!selected.size) return;
    preview = [...selected.values()].map(row=>({...row,destination:row.field==='note'?'worked':'change'}));
    $('#reflection-preview').innerHTML = preview.map((row,i)=>`<section class="reflection-excerpt"><h3>${esc(pretty(row.date))} · ${esc(row.label)}</h3><label>Excerpt to carry forward<textarea data-excerpt="${i}" maxlength="4000">${esc(row.text)}</textarea></label><label>Add to<select data-destination="${i}"><option value="worked"${row.destination==='worked'?' selected':''}>What worked?</option><option value="change"${row.destination==='change'?' selected':''}>What will you change?</option></select></label></section>`).join('');
    $('#reflection-error').textContent = ''; $('#reflection-dialog').showModal();
  });
  $('#reflection-apply').addEventListener('click', () => {
    if (!preview.length || saving) return;
    try {
      const rows = preview.map((row,i)=>({...row,text:$(`[data-excerpt="${i}"]`).value,destination:$(`[data-destination="${i}"]`).value}));
      Object.assign(draft,appendReflections(draft,rows)); edited = true; selected.clear(); preview = [];
      $('#reflection-dialog').close(); render();
      $('#review-form').elements.worked.focus(); toast('Selected excerpts added to your draft. Review them, then save your review.');
    } catch (err) { $('#reflection-error').textContent = err.message; }
  });
  $('#reflection-dialog').addEventListener('close',()=>{preview=[];});
  document.addEventListener('submit', async e => {
    if (e.target.id !== 'review-form') return; e.preventDefault();
    if (saving || blocked()) return;
    if (selected.size) { $('#review-error').textContent = 'Add the selected notes to your draft or clear the selection before saving.'; return; }
    ensure(); const form = e.target;
    draft.worked = form.elements.worked.value; draft.change = form.elements.change.value;
    edited = true; saving = true;
    const controls = [...form.querySelectorAll('textarea,button')]; controls.forEach(x=>x.disabled=true);
    $('#review-error').textContent = ''; syncStatus();
    try {
      await api('/api/week','PUT',structuredClone(draft)); edited = false; draft = null;
      await load(); toast('Your weekly review is saved.');
    } catch (err) { $('#review-error').textContent = err.message+' Your draft is kept. Download it before discarding and reloading the saved review.'; }
    finally { saving = false; controls.forEach(x=>x.disabled=false); syncStatus(); }
  });
  return { form, notes, get dirty(){return edited || selected.size>0;}, get saving(){return saving;} };
}
