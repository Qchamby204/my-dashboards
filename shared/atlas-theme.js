/* Shared appearance preference. Run in <head> before styles to avoid a light flash. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root.classList.contains('atlas-neumo') || window.AtlasAppearance) return;
  // Extend the existing pages in place. Their HTML, records, and URLs remain theirs.
  const sharedSource=document.currentScript?.src;
  if(sharedSource&&document.head){
    const mobile=document.createElement('script');mobile.src=new URL('atlas-mobile.js',sharedSource).href;mobile.defer=true;document.head.appendChild(mobile);
    if(root.dataset.atlasApp==='the-herald'){
      const herald=document.createElement('script');herald.src=new URL('herald-enhancements.js',sharedSource).href;herald.defer=true;document.head.appendChild(herald);
    }
    if(root.dataset.atlasApp==='the-hourglass'){
      const hourglass=document.createElement('script');hourglass.src=new URL('hourglass-enhancements.js',sharedSource).href;hourglass.defer=true;document.head.appendChild(hourglass);
    }
    if(root.dataset.atlasApp==='communication-trainer'){
      const trainer=document.createElement('script');trainer.src=new URL('communication-enhancements.js',sharedSource).href;trainer.defer=true;document.head.appendChild(trainer);
    }
    if(root.dataset.atlasApp==='neural-map'){
      const neural=document.createElement('script');neural.src=new URL('neural-enhancements.js',sharedSource).href;neural.defer=true;document.head.appendChild(neural);
    }
    if(root.dataset.atlasApp==='prospecting-command-center'){
      // Retain the saved bytes before the legacy boot can attempt migration.
      const boot={raw:null,readError:false};try{boot.raw=localStorage.getItem('hq_v1');}catch{boot.readError=true;}
      window.AtlasProspectingBoot=boot;
      const prospects=document.createElement('script');prospects.src=new URL('prospecting-enhancements.js',sharedSource).href;prospects.defer=true;document.head.appendChild(prospects);
    }
    if(root.dataset.atlasApp==='operations-cadence'){
      const boot={raw:null,readError:false};try{boot.raw=localStorage.getItem('operationsCadence.v1');}catch{boot.readError=true;}
      window.AtlasOperationsBoot=boot;
      const operations=document.createElement('script');operations.src=new URL('operations-enhancements.js',sharedSource).href;operations.defer=true;document.head.appendChild(operations);
    }
    if(root.dataset.atlasApp==='baby-brain'){
      const boot={raw:null,readError:false};try{boot.raw=localStorage.getItem('babybrain.v1');}catch{boot.readError=true;}
      window.AtlasBabyBoot=boot;
      const baby=document.createElement('script');baby.src=new URL('baby-enhancements.js',sharedSource).href;baby.defer=true;document.head.appendChild(baby);
    }
  }
  const key = 'atlas.appearance.v1';
  const modes = ['light', 'dark', 'system'];
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => modes.includes(value);
  const read = () => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = value => { try { localStorage.setItem(key, value); } catch { /* In-memory choice still works. */ } };
  let preference = valid(read()) ? read() : 'system';
  // Carry only the appearance choice between the two Atlas origins, never app records.
  const incoming = new URL(location.href);
  const passed = incoming.searchParams.get('atlas-theme');
  if (valid(passed)) {
    preference = passed;
    write(preference);
    incoming.searchParams.delete('atlas-theme');
    try { history.replaceState(history.state, '', incoming.pathname + incoming.search + incoming.hash); } catch { /* Cosmetic URL cleanup is optional. */ }
  }
  let trigger, dialog;
  const chartThemes = new WeakMap();
  function paintCharts() {
    if (!window.Chart?.instances) return;
    const styles = getComputedStyle(root);
    const color = styles.getPropertyValue('--neo-muted').trim();
    const grid = styles.getPropertyValue('--neo-line').trim();
    if (!color || !grid) return;
    const signature = color + grid;
    for (const chart of Object.values(window.Chart.instances)) {
      if (chartThemes.get(chart) === signature) continue;
      for (const scale of Object.values(chart.options.scales || {})) {
        if (scale.ticks) scale.ticks.color = color;
        if (scale.grid) scale.grid.color = grid;
      }
      if (chart.options.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = color;
      chartThemes.set(chart, signature);
      chart.update('none');
    }
  }
  function apply() {
    const resolved = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    root.dataset.atlasTheme = resolved;
    root.dataset.atlasAppearance = preference;
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.content = resolved === 'dark' ? '#202936' : '#e7ecf2';
    if (trigger) {
      trigger.title = 'Appearance: ' + preference;
      trigger.setAttribute('aria-label', 'Appearance: ' + preference + '. Change color theme');
    }
    if (dialog) for (const input of dialog.querySelectorAll('input')) input.checked = input.value === preference;
    paintCharts();
    window.dispatchEvent(new CustomEvent('atlas:appearance', { detail: { preference, resolved } }));
  }
  function set(value) {
    if (!valid(value)) return;
    preference = value;
    write(value);
    apply();
  }
  window.AtlasAppearance = Object.freeze({ set, get: () => preference });
  apply();
  system.addEventListener('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue) ? event.newValue : 'system';
    apply();
  });
  window.addEventListener('pageshow', () => {
    const saved = read();
    if (valid(saved)) preference = saved;
    apply();
  });

  const files = new Set(['', 'index.html', 'life-map.html', 'life-ledger.html', 'workout-forge.html', 'the-aqueduct.html', 'the-hourglass.html', 'baby-brain.html', 'communication-trainer.html', 'prospecting-command-center.html', 'operations-cadence.html', 'the-herald.html', 'courier.html', 'neural-map.html', 'chambers-wealth-hq.html']);
  function carryPreference(event) {
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download')) return;
    let target;
    try { target = new URL(link.href, location.href); } catch { return; }
    const legacy = target.origin === 'https://qchamby204.github.io' && target.pathname.startsWith('/my-dashboards/') && files.has(target.pathname.slice('/my-dashboards/'.length));
    const workspace = target.origin === 'https://atlas-os-quinton.qchambers123018.chatgpt.site' && target.pathname === '/';
    if ((!legacy && !workspace) || target.origin === location.origin) return;
    target.searchParams.set('atlas-theme', preference);
    link.href = target.href;
  }
  document.addEventListener('click', carryPreference, true);
  document.addEventListener('auxclick', carryPreference, true);

  function mount() {
    if (!document.body) return;
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'atlas-appearance-trigger';
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', 'atlas-appearance-dialog');
      trigger.innerHTML = '<span aria-hidden="true">◐</span>';
      dialog = document.createElement('dialog');
      dialog.id = 'atlas-appearance-dialog';
      dialog.setAttribute('aria-labelledby', 'atlas-appearance-title');
      dialog.innerHTML = '<div class="atlas-appearance-heading"><h2 id="atlas-appearance-title">Appearance</h2><button type="button" class="atlas-appearance-close" aria-label="Close appearance">×</button></div><fieldset><legend>Color theme</legend><label><input type="radio" name="atlas-appearance" value="light"><span><strong>Light</strong><small>Soft mineral surfaces</small></span></label><label><input type="radio" name="atlas-appearance" value="dark"><span><strong>Dark</strong><small>Deep graphite surfaces</small></span></label><label><input type="radio" name="atlas-appearance" value="system"><span><strong>System</strong><small>Follow your device</small></span></label></fieldset>';
      dialog.querySelector('.atlas-appearance-close').addEventListener('click', () => dialog.close());
      dialog.addEventListener('change', event => { if (event.target.name === 'atlas-appearance') set(event.target.value); });
      trigger.addEventListener('click', () => { if (!dialog.open) dialog.showModal(); });
    }
    if (!dialog.isConnected) document.body.append(dialog);
    if (!trigger.isConnected) {
      const map = ['baby-brain', 'neural-map'].includes(root.dataset.atlasApp);
      const host = map ? null : document.querySelector('.topbar > div, .appbar, header .bar');
      trigger.classList.toggle('atlas-appearance-floating', !host);
      trigger.classList.toggle('atlas-appearance-map', map);
      (host || document.body).append(trigger);
    }
  }
  function ready() {
    mount();
    apply();
    // Legacy screens rebuild their headers. Reattach the same control after a render.
    new MutationObserver(() => { mount(); paintCharts(); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
