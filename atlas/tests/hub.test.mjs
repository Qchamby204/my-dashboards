import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {hubApps,buildCatalog} from '../neural-catalog.mjs';

const root=new URL('../../',import.meta.url);
const html=readFileSync(new URL('index.html',root),'utf8');
const cards=[...html.matchAll(/<a class="hub-card" href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g)];
const origin='https://qchamby204.github.io';

test('Atlas includes every active public dashboard and keeps redirects, utilities and archives out of the roster',()=>{
  const excluded=new Set(['index.html','gang-ops-roadmap.html','test-booking-downtown.html','test-booking-fort-garry.html','crucible.html','compass-open.html','connect-atlas.html','chambers-wealth-hq.html']);
  const expected=readdirSync(root).filter(p=>p.endsWith('.html')&&!excluded.has(p)).sort();
  const urls=cards.map(([,href])=>new URL(href));
  const publicFiles=urls.filter(u=>u.origin===origin).map(u=>u.pathname.split('/').at(-1)).sort();
  assert.deepEqual(publicFiles,expected,'A new dashboard must be added to Atlas, or deliberately documented as excluded');
  assert.equal(new Set(urls.map(u=>u.href)).size,urls.length,'No duplicate launch cards');
  for(const file of publicFiles)assert(existsSync(new URL(file,root)),file+' must exist');
  const areas=[...html.matchAll(/<section[^>]+data-area="([^"]+)"/g)];
  assert.match(html,new RegExp('>'+cards.length+' apps and tools · '+areas.length+' areas<'));
});

test('published private tools are labelled and do not become phantom local files or duplicate Neural Map records',()=>{
  for(const slug of ['clearbill','portfolio-outcomes-lab']){
    const card=cards.find(([,href])=>href==='https://'+slug+'.qchambers123018.chatgpt.site');
    assert(card,slug+' launch link');
    assert.match(card[2],new RegExp('data-hub-id="'+slug+'"'));
    assert.match(card[3],/>Private site</);
  }
  const apps=hubApps(html);
  assert(apps.every(a=>a.path&&existsSync(new URL(a.path,root))));
  assert(apps.some(a=>a.path==='reminders.html'));
  const catalog=buildCatalog(JSON.parse(readFileSync(new URL('atlas/neural-resources.json',root),'utf8')),apps);
  const tools=catalog.flatMap(c=>(c.groups||[c]).flatMap(g=>g.tools));
  for(const slug of ['clearbill','portfolio-outcomes-lab'])assert.equal(tools.filter(t=>t.doors?.some(d=>d.url==='https://'+slug+'.qchambers123018.chatgpt.site')).length,1);
});

test('category shortcuts and saved-file access have real destinations',()=>{
  for(const [,target]of html.matchAll(/<a href="#(group-[^"]+)"/g))assert(html.includes('id="'+target+'"'));
  assert.match(html,/<summary>Saved files and prototypes<\/summary>/);
  assert.match(html,/Browse the full tool catalogue/);
  assert.match(html,/Advisor Book Economics, Discern, the Admin Workflow Checklist/);
  assert.doesNotMatch(cards.map(c=>c[3]).join(''),/Discern|Chambers Wealth HQ|The Crucible<\/h3>/);
});

test('private Atlas launches the public Communicator with its ladder assets',async()=>{
  const {hub}=await import('../../dist/server/assets.mjs');
  const launches=[...hub.matchAll(/<a class="hub-card" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const communicator=launches.filter(([,href,body])=>body.includes('<h3>Communicator</h3>'));
  assert.equal(communicator.length,1);
  assert.equal(communicator[0][1],'https://qchamby204.github.io/my-dashboards/communication-trainer.html');
  const trainer=readFileSync(new URL('communication-trainer.html',root),'utf8');
  for(const asset of ['communicator-ladder-model.js','communicator-ladder.js','communicator-ladder.css']){
    assert(trainer.includes('shared/'+asset+'?v='),asset+' loads from the launched page');
    assert(existsSync(new URL('shared/'+asset,root)));
  }
});
