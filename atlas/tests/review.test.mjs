import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {summarizeActivity,narrative,patternNotes,trimActivity} from '../../shared/atlas-activity-core.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../..');
const NOW=Date.parse('2026-09-15T12:00:00Z');
const event=(at,app,type,kind='usage',extra={})=>({id:`${app}-${type}-${at}`,at,app,type,kind,summary:'test',seconds:0,...extra});

function envelope(events){return {version:1,events};}

test('Review aggregates usage, active time, and meaningful change without counting system apps',()=>{
  const value=envelope([
    event('2026-09-15T08:00:00Z','atlas-hub','open'),
    event('2026-09-15T08:02:00Z','life-ledger','open'),
    event('2026-09-15T08:12:00Z','life-ledger','session','usage',{seconds:600}),
    event('2026-09-15T08:05:00Z','life-ledger','data_changed','meaningful'),
    event('2026-09-15T09:00:00Z','courier','open'),
    event('2026-09-15T09:20:00Z','courier','session','usage',{seconds:1200}),
  ]);
  const summary=summarizeActivity(value,{days:7,now:NOW});
  assert.equal(summary.usedApps,2);
  assert.equal(summary.sessions,2);
  assert.equal(summary.meaningful,1);
  assert.equal(summary.activeSeconds,1800);
  assert.equal(summary.topPayoff.id,'life-ledger');
  assert.equal(summary.systemApps.some(app=>app.id==='atlas-hub'),true);
  assert.match(narrative(summary),/2 apps across 2 tracked sessions/);
});

test('private-origin launch counts as a session without pretending inside-app telemetry exists',()=>{
  const value=envelope([
    event('2026-09-15T10:00:00Z','prospecting-command-center','launch','usage',{sourceApp:'atlas-hub'}),
  ]);
  const summary=summarizeActivity(value,{days:7,now:NOW});
  assert.equal(summary.usedApps,1);
  assert.equal(summary.sessions,1);
  assert.equal(summary.apps[0].launches,1);
  assert.equal(summary.apps[0].activeSeconds,0);
});

test('reference use is surfaced as a pattern rather than treated as failure',()=>{
  const value=envelope([
    event('2026-09-14T14:00:00Z','neural-map','open'),
    event('2026-09-15T10:00:00Z','neural-map','open'),
  ]);
  const summary=summarizeActivity(value,{days:7,now:NOW});
  assert.equal(summary.usedNoChange[0].id,'neural-map');
  assert.match(patternNotes(summary).map(note=>note.text).join(' '),/healthy for a reference tool/);
});

test('common flow survives Atlas hub hops and still requires a repeated pair within 45 minutes',()=>{
  const value=envelope([
    event('2026-09-13T08:00:00Z','courier','open'),
    event('2026-09-13T08:10:00Z','atlas-hub','open'),
    event('2026-09-13T08:20:00Z','workout-forge','open'),
    event('2026-09-14T08:00:00Z','courier','open'),
    event('2026-09-14T08:12:00Z','atlas-hub','open'),
    event('2026-09-14T08:25:00Z','workout-forge','open'),
  ]);
  const summary=summarizeActivity(value,{days:7,now:NOW});
  assert.deepEqual(summary.sequence,{from:'courier',to:'workout-forge',count:2});
});

test('activity retention drops records older than 120 days',()=>{
  const value=envelope([
    event('2026-01-01T12:00:00Z','courier','open'),
    event('2026-09-15T08:00:00Z','courier','open'),
  ]);
  const trimmed=trimActivity(value,NOW);
  assert.equal(trimmed.events.length,1);
  assert.equal(trimmed.events[0].at,'2026-09-15T08:00:00.000Z');
});

test('Review is a single Atlas hub destination and activity logging is shared through the existing bootstrap',async()=>{
  const [review,hub,mobile]=await Promise.all([
    readFile(resolve(root,'review.html'),'utf8'),
    readFile(resolve(root,'index.html'),'utf8'),
    readFile(resolve(root,'shared/atlas-mobile.js'),'utf8'),
  ]);
  assert.match(review,/data-atlas-app="review"/);
  assert.match(review,/shared\/review\.js/);
  assert.match(hub,/review\.html/);
  assert.match(hub,/>The Review</);
  assert.match(mobile,/atlas-activity\.js/);
});
