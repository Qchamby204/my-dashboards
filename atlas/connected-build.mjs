import {readFile} from 'node:fs/promises';
export async function connectedAssets(root){
  const assets={};
  const add=(path,body,type)=>assets[path]=[body,type];
  for(const name of ['atlas-theme.js','atlas-palette.css','atlas-neumorphism-compat.css','atlas-neumorphism.css','atlas-appearance.css','atlas-workflow.css','atlas-connect.css'])add('/shared/'+name,await readFile(new URL('shared/'+name,root),'utf8'),name.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');
  add('/connected/bootstrap.js',await readFile(new URL('atlas/connected-bootstrap.js',root),'utf8'),'text/javascript; charset=utf-8');
  add('/connected/style.css',`.connected-toolbar{position:sticky;top:0;z-index:500;background:var(--bg,#151a24);color:var(--txt,var(--text,#e6ebf3));border-bottom:1px solid var(--border,#445069);padding:12px 20px;font:14px/1.5 system-ui;display:flex;gap:16px;align-items:center;flex-wrap:wrap}.connected-toolbar a,.connected-toolbar button{color:inherit;font:inherit;min-height:44px;display:inline-flex;align-items:center}.connected-toolbar button{background:transparent;border:1px solid currentColor;border-radius:8px;padding:6px 10px}.connected-toolbar [hidden]{display:none}.connected-toolbar p{margin:0;max-width:65ch}#connected-status{flex:1 1 260px}#connected-app[inert]{opacity:.35}#connected-discard{flex-basis:100%}#connected-app .header{position:relative}#connected-app{min-width:0}`,'text/css; charset=utf-8');
  for(const [kind,file] of [['life-map','life-map.html'],['herald','the-herald.html']]){
    let html=await readFile(new URL(file,root),'utf8');
    const matches=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    if(matches.length!==(kind==='herald'?2:1))throw Error('Review connected script extraction for '+file);
    let script=matches.map(m=>m[1]).join('\n');
    const replace=(pattern,value)=>{if(!pattern.test(script))throw Error('Connected storage adapter no longer matches '+kind);script=script.replace(pattern,value);};
    if(kind==='herald'){
      replace(/const store=\(\(\)=>\{[\s\S]*?\}\)\(\);\nconst KEY=/,"const store={getItem:()=>window.AtlasConnected.raw(),setItem:(k,v)=>window.AtlasConnected.save(JSON.parse(v))};\nconst KEY=");
      script+="\nwindow.acceptConnectedState=next=>{S=next;renderAll();};window.connectedDraftOpen=()=>!!document.querySelector('#connected-app input:focus,#connected-app textarea:focus,#connected-app select:focus');\nconst linkedRecord=new URL(location.href).searchParams.get('record');if(linkedRecord&&S.videos.some(v=>v.id===linkedRecord)){openVid=linkedRecord;renderAll();}\n";
      // Cross-device copying is replaced by the shared backing record.
      script=script.replace(/function syncHTML\(\)\{/,"function syncHTML(){if(window.AtlasConnected)return '<h2>Saved with Atlas</h2><p>This Herald and Home share the same work across your devices.</p><button onclick=\"openSync()\">Close</button>'; ");
    }else{
      replace(/var store=\(function\(\)\{[\s\S]*?\}\)\(\);/,"var store={get:k=>Promise.resolve(window.AtlasConnected.raw()),set:(k,v)=>window.AtlasConnected.save(JSON.parse(v))};");
      script+="\nwindow.discardConnectedDraft=()=>{view.editor=null;};window.acceptConnectedState=next=>{S=next;render();};window.connectedDraftOpen=()=>!!view.editor||!!document.querySelector('#connected-app input:focus,#connected-app textarea:focus');\nstore.get(KEY).then(()=>{const id=new URL(location.href).searchParams.get('record'),p=S.projects.find(x=>x.id===id);if(p){view.editor=Object.assign({kind:'proj'},p);render();}});\n";
    }
    // Keep every original app capability; only replace persistence and links.
    script=script.replaceAll('href="index.html"','href="/#today"').replaceAll('href="life-ledger.html"','href="/#ledger"').replaceAll('href="workout-forge.html"','href="https://qchamby204.github.io/my-dashboards/workout-forge.html"');
    add('/connected/'+kind+'-main.js',script,'text/javascript; charset=utf-8');
    for(const match of matches)html=html.replace(match[0],'');
    html=html.replace(/<script type="module" src="shared\/atlas-project-transfer.js"><\/script>/,'');
    html=html.replaceAll('href="shared/','href="/shared/').replaceAll('src="shared/','src="/shared/').replaceAll('href="index.html"','href="/#today"');
    html=html.replace('</head>','<link rel="stylesheet" href="/connected/style.css"></head>');
    const bar=`<nav class="connected-toolbar" aria-label="Atlas connected app"><a href="/#today">← Atlas Home</a><a href="/apps/${kind==='herald'?'life-map':'herald'}">${kind==='herald'?'Life Map':'The Herald'}</a><p id="connected-status" role="status" aria-live="polite">Opening saved work…</p><a id="connected-import" href="/#connect" hidden>Bring existing work</a><button id="connected-retry" hidden>Retry</button><button id="connected-download" hidden>Download draft</button><button id="connected-reload" hidden>Reload saved work</button><div id="connected-discard" hidden><p>Download your draft first if you want to keep it. Reloading replaces this tab's unsaved changes with saved work.</p><button id="connected-discard-confirm">Discard draft and reload</button><button id="connected-keep">Keep editing</button></div></nav>`;
    html=html.replace(/<body([^>]*)>/,`<body$1>${bar}<div id="connected-app" inert>`).replace('</body>',`</div><script src="/connected/bootstrap.js" data-kind="${kind}" defer></script></body>`);
    add('/apps/'+kind,html,'text/html; charset=utf-8');
  }
  return assets;
}
