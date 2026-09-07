import { TOOLS, MAX_BYTES, LAST_BACKUP_KEY, sizeOf, inventory, createBackup, parseBackup, previewRestore, applyRestore, readRecovery, recover, recoveryBackup } from './atlas-vault-core.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bytes = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
let preview = null, source = '', selected = new Set(), paste = '', busy = false, message = '', failed = false;
function focusStatus() { const target = document.getElementById('vault-status'); if (target) { target.tabIndex = -1; target.focus(); } }
const status = (text, error = false) => { message = text; failed = error; mount(); focusStatus(); };
function redraw() { if (typeof window.render === 'function') window.render(); else mount(); }
function refreshAppearance() { try { if (window.AtlasAppearance) window.AtlasAppearance.set(localStorage.getItem('atlas.appearance.v1') || 'system'); } catch { /* Appearance cannot change the result of a verified recovery. */ } }
function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function markPrepared() { try { localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString()); } catch { /* The prepared backup remains usable. */ } }
async function backup(copy = false) {
  if (busy) return;
  try {
    const result = createBackup(localStorage);
    if (!result.payload.keys) { status('No supported Atlas records are available to back up.'); return; }
    if (copy) {
      const text = result.text;
      try { await navigator.clipboard.writeText(text); }
      catch {
        const area = document.createElement('textarea'); area.className = 'vault-copy-helper'; area.value = text;
        document.body.append(area); area.focus(); area.select();
        let copied = false;
        try { copied = document.execCommand('copy'); } finally { area.remove(); }
        if (!copied) throw Error('Copy was blocked. Use Download backup instead.');
      }
    } else download(result.text, 'atlas-backup-' + new Date().toISOString().slice(0, 10) + '.json');
    markPrepared();
    message = (copy ? 'Copied ' : 'Download started for ') + result.payload.keys + ' Atlas entries (' + bytes(sizeOf(result.text)) + ').' + (result.excluded.length ? ' ' + result.excluded.length + ' settings outside the backup scope were excluded.' : '');
    failed = false; redraw(); focusStatus();
  } catch (error) { status(error.message || 'The backup could not be prepared.', true); }
}
function review(raw, from) {
  try {
    preview = previewRestore(parseBackup(raw), localStorage);
    selected = new Set(preview.entries.filter(entry => entry.action !== 'unchanged').map(entry => entry.toolId));
    source = from; message = ''; failed = false;
    mount(); document.getElementById('vault-review-title')?.focus();
  } catch (error) { preview = null; status(error.message || 'This backup could not be reviewed.', true); }
}
async function restore() {
  if (busy || !preview) return;
  busy = true; mount();
  try {
    const result = await applyRestore(preview, selected, localStorage, sessionStorage);
    preview = null; paste = '';
    message = 'Restored and verified ' + result.restored + ' entries across ' + result.apps + ' apps. Reopen those apps to load the restored records.';
    failed = false; refreshAppearance();
  } catch (error) {
    message = error.message || 'Restore did not complete.'; failed = true;
    // A failed transaction must be reviewed again, including any concurrent edits.
    if (error.code !== 'NOTHING_SELECTED') preview = null;
  } finally { busy = false; redraw(); focusStatus(); }
}
async function undo() {
  if (busy) return;
  busy = true; mount();
  try {
    const result = await recover(localStorage, sessionStorage);
    preview = null; message = 'Recovery verified for ' + result.restored + ' entries. Reopen the affected apps before continuing.'; failed = false;
    refreshAppearance();
  } catch (error) { message = error.message || 'Recovery could not be completed.'; failed = true; }
  finally { busy = false; redraw(); focusStatus(); }
}
function renderReview() {
  if (!preview) return '';
  const date = preview.exportedAt && Number.isFinite(Date.parse(preview.exportedAt)) ? new Date(preview.exportedAt).toLocaleString() : 'Date unavailable';
  const groups = TOOLS.map(tool => ({ ...tool, entries: preview.entries.filter(entry => entry.toolId === tool.id) })).filter(tool => tool.entries.length);
  const total = preview.entries.filter(entry => selected.has(entry.toolId) && entry.action !== 'unchanged').length;
  return '<section class="vault-review" aria-labelledby="vault-review-title"><h3 id="vault-review-title" tabindex="-1">Review this restore</h3><p class="vault-secondary">' + esc(source) + ' · ' + esc(date) + '</p>' +
    '<p>Choose the apps to restore. Existing entries listed below will be replaced. Records absent from this backup stay in this browser.</p>' +
    '<div class="vault-table-wrap"><table><thead><tr><th scope="col">App</th><th scope="col">Add</th><th scope="col">Replace</th><th scope="col">Same</th></tr></thead><tbody>' +
    groups.map(tool => {
      const add = tool.entries.filter(e => e.action === 'add').length, replace = tool.entries.filter(e => e.action === 'replace').length, same = tool.entries.length - add - replace;
      return '<tr><th scope="row"><label><input type="checkbox" data-vault-tool="' + tool.id + '" ' + (selected.has(tool.id) ? 'checked ' : '') + ((!add && !replace) || busy ? 'disabled' : '') + '><span>' + esc(tool.name) + '</span></label></th><td>' + add + '</td><td>' + replace + '</td><td>' + same + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    (preview.excluded.length ? '<p class="vault-secondary">' + preview.excluded.length + ' unsupported or credential-bearing settings are excluded.</p>' : '') +
    '<p class="vault-caution">Close other Atlas tabs before restoring. An open app can save older data over a restore. Starting this restore replaces the previous undo point.</p>' +
    '<div class="vault-actions"><button type="button" class="btn primary" id="vault-apply" ' + (!total || busy ? 'disabled' : '') + '>Restore ' + total + ' entries</button><button type="button" class="btn line" id="vault-cancel" ' + (busy ? 'disabled' : '') + '>Cancel</button></div></section>';
}
function mount() {
  const host = document.getElementById('atlas-vault-root'); if (!host) return;
  let items = [], journal = null, issue = '';
  try { items = inventory(localStorage); journal = readRecovery(sessionStorage); } catch (error) { issue = error.message; }
  const active = items.filter(tool => tool.count && tool.id !== 'appearance');
  const entries = items.reduce((sum, tool) => sum + tool.count, 0), size = items.reduce((sum, tool) => sum + tool.bytes, 0);
  host.className = 'vault panel';
  host.innerHTML = '<div class="vault-heading"><div><span class="eyebrow">The Vault</span><h2>Your Atlas records, recoverable.</h2></div><span class="vault-count">' + bytes(size) + '</span></div>' +
    '<p>' + active.length + ' apps hold local records in this browser. Create a backup, or review one before restoring.</p>' +
    '<div class="vault-chips">' + active.map(tool => '<span>' + esc(tool.name) + '</span>').join('') + '</div>' +
    '<div class="vault-actions"><button type="button" class="btn primary" id="vault-download" ' + (busy || !entries ? 'disabled' : '') + '>Download backup</button><button type="button" class="btn" id="vault-copy" ' + (busy || !entries ? 'disabled' : '') + '>Copy backup</button></div>' +
    '<div class="vault-import"><label class="vault-file-label">Review a backup file<input id="vault-file" type="file" accept=".json,application/json" ' + (busy ? 'disabled' : '') + '></label><details id="vault-paste-disclosure" ' + (paste ? 'open' : '') + '><summary>Paste a copied backup</summary><label for="vault-paste">Backup text</label><textarea id="vault-paste" rows="4" maxlength="' + MAX_BYTES + '" spellcheck="false" placeholder="Paste your Atlas backup here" ' + (busy ? 'disabled' : '') + '>' + esc(paste) + '</textarea><button type="button" class="btn" id="vault-review-paste" ' + (busy ? 'disabled' : '') + '>Review pasted backup</button></details></div>' +
    renderReview() +
    (journal ? '<section class="vault-recovery"><h3>Restore recovery available</h3><p>Undo or finish recovering the last restore. This recovery point survives a reload in this tab; closing the tab removes it.</p><div class="vault-actions"><button type="button" class="btn" id="vault-undo" ' + (busy ? 'disabled' : '') + '>Undo / recover restore</button><button type="button" class="btn line" id="vault-recovery-file" ' + (busy || !journal.entries.some(entry => entry.before !== null) ? 'disabled' : '') + '>Download previous records</button></div><p class="vault-secondary">The file contains previous values. Use recovery here to also remove entries added by the restore.</p></section>' : '') +
    '<p id="vault-status" class="vault-status ' + ((failed || issue) ? 'vault-error' : '') + '" role="' + ((failed || issue) ? 'alert' : 'status') + '">' + esc(busy ? 'Working… keep this tab open.' : message || issue) + '</p>' +
    '<p class="vault-secondary vault-scope">Includes supported Atlas app records and appearance settings. Voice connection settings, credential-bearing entries, and unrelated dashboards are excluded. Personal notes remain in the backup; keep the file private.</p>' +
    '<p class="vault-secondary">The private Atlas OS workspace saves separately. Use its Export action for commitments and weekly reviews. This Vault covers the apps on this site.</p>';
  host.querySelector('#vault-download').onclick = () => backup();
  host.querySelector('#vault-copy').onclick = () => backup(true);
  host.querySelector('#vault-file').onchange = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > MAX_BYTES) { status('Choose a backup smaller than 20 MB.', true); return; }
    try { review(await file.text(), file.name); } catch { status('The backup file could not be read.', true); }
  };
  host.querySelector('#vault-paste').oninput = event => { paste = event.target.value; };
  host.querySelector('#vault-review-paste').onclick = () => review(paste, 'Pasted backup');
  for (const input of host.querySelectorAll('[data-vault-tool]')) input.onchange = () => {
    if (input.checked) selected.add(input.dataset.vaultTool); else selected.delete(input.dataset.vaultTool);
    const count = preview.entries.filter(entry => selected.has(entry.toolId) && entry.action !== 'unchanged').length;
    const apply = host.querySelector('#vault-apply'); apply.textContent = 'Restore ' + count + ' entries'; apply.disabled = !count;
  };
  if (preview) {
    host.querySelector('#vault-apply').onclick = restore;
    host.querySelector('#vault-cancel').onclick = () => { preview = null; selected.clear(); status('Restore cancelled. No records changed.'); };
  }
  if (journal) {
    host.querySelector('#vault-undo').onclick = undo;
    host.querySelector('#vault-recovery-file').onclick = () => {
      try { const latest = readRecovery(sessionStorage); if (!latest) throw Error('There is no recovery record.'); download(JSON.stringify(recoveryBackup(latest)), 'atlas-before-restore.json'); status('Download started for previous records. The recovery point remains available in this tab.'); }
      catch (error) { status(error.message, true); }
    };
  }
}
window.TOOL_KEYS = TOOLS.filter(tool => tool.id !== 'appearance').map(tool => ({ n: tool.name, keys: tool.keys }));
window.AtlasVaultUI = { mount, backup: () => backup() };
redraw();
