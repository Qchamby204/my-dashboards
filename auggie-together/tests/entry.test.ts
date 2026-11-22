import test from 'node:test';import assert from 'node:assert/strict';
import {createDraft,entryReady,entryPayload} from '../lib/entry.ts';
import {fromInput,type CareEvent} from '../lib/care.ts';
const now=Date.parse('2026-11-02T16:00:00Z');
test('new feeds require an intentional amount and never prefill a target',()=>{const d=createDraft('feed','milk',undefined,now);assert.equal(d.amount,'');assert.equal(entryReady(d),false);assert.equal(entryReady({...d,amount:'45'}),true);assert.equal(entryPayload({...d,amount:'45'},now).amount,45);});
test('Now is saved at submission time, not the time the panel opened',()=>{const d=createDraft('feed','formula',undefined,now-600000);const p=entryPayload({...d,amount:'60'},now);assert.equal(p.startedAt,new Date(now).toISOString());assert.equal(p.offered,null);});
test('earlier entries use Winnipeg local time',()=>{const d=createDraft('diaper','wet',undefined,now);const p=entryPayload({...d,when:'earlier',time:'2026-11-02T10:30'},now);assert.equal(p.startedAt,'2026-11-02T15:30:00.000Z');});
test('sleep duration sets the correct start and end across midnight',()=>{const end=Date.parse(fromInput('2026-11-02T00:30'));const d=createDraft('sleep','',undefined,end);const p=entryPayload({...d,duration:'120'},end);assert.equal(p.endedAt,new Date(end).toISOString());assert.equal(p.startedAt,fromInput('2026-11-01T22:30'));assert.equal(entryReady(d),false);});
test('editing a precise older amount preserves timestamp seconds and amount',()=>{const e={id:crypto.randomUUID(),kind:'feed',subtype:'milk',startedAt:'2026-11-02T15:30:42.123Z',endedAt:null,amount:42.5,offered:50,duration:null,notes:'',version:1} as CareEvent;const d=createDraft('feed','milk',e,now);const p=entryPayload(d,now);assert.equal(p.startedAt,e.startedAt);assert.equal(p.amount,42.5);assert.equal(p.offered,50);});
test('nursing minutes stay separate from measured milk',()=>{const d=createDraft('feed','nursing',undefined,now);assert.equal(entryReady(d),false);const p=entryPayload({...d,duration:'15',notes:'[Left] '},now);assert.equal(p.duration,15);assert.equal(p.amount,null);});

test('soiled amount survives entry edits and clears when changed to wet only',()=>{const d={...createDraft('diaper','both',undefined,now),soiledSize:'medium' as const};const payload=entryPayload(d,now);assert.equal(payload.soiledSize,'medium');const e={...payload,version:1,notes:'',actor:'Test'} as CareEvent;assert.equal(createDraft('diaper','both',e,now).soiledSize,'medium');assert.equal(entryPayload({...d,subtype:'wet'},now).soiledSize,null);});

test('wet amount survives a saved entry and is cleared only for dirty-only diapers',()=>{const d={...createDraft('diaper','wet',undefined,now),wetSize:'large' as const};const p=entryPayload(d,now);assert.equal(p.wetSize,'large');assert.equal(p.soiledSize,null);const saved={...p,version:1} as CareEvent;assert.equal(createDraft('diaper','wet',saved,now).wetSize,'large');assert.equal(entryPayload({...d,subtype:'dirty',soiledSize:'small'},now).wetSize,null);});

test('pumping assumes room temperature in its single-screen payload',()=>{const draft=createDraft('pump');draft.amount='60';assert.equal(draft.milkStorage,'fresh');assert.equal(entryPayload(draft).milkStorage,'fresh');});

test('leftover bottle starts without requiring volume and preserves feed-end time',()=>{const d=createDraft('bottle','',undefined,now);assert.equal(entryReady(d),true);const p=entryPayload(d,now);assert.equal(p.kind,'bottle');assert.equal(p.amount,null);assert.equal(p.startedAt,new Date(now).toISOString());});

test('untimed tummy check-ins save without measurements, support earlier times and round-trip through edit',()=>{
 const draft=createDraft('tummy','',undefined,now);
 assert.equal(entryReady(draft),true);
 const bare=entryPayload(draft,now);
 assert.equal(bare.tummyObservation,'session');
 assert.equal(bare.startedAt,bare.endedAt);
 assert.equal(bare.amount,null);
 const old=entryPayload({...draft,when:'earlier',time:'2026-11-01T21:00',subtype:'lap',tummyObservation:'lifted'},now);
 assert.equal(old.startedAt,fromInput('2026-11-01T21:00'));
 assert.equal(old.endedAt,old.startedAt);
 const saved={...old,version:1} as CareEvent;
 const edit=createDraft('tummy','',saved,now);
 assert.equal(entryPayload(edit,now).tummyObservation,'lifted');
 const timed={...saved,tummyObservation:null,startedAt:new Date(Date.parse(old.startedAt)-15000).toISOString(),amount:3} as CareEvent;
 const measured=entryPayload(createDraft('tummy','',timed,now),now);
 assert.equal(measured.tummyObservation,null);
 assert.equal(measured.startedAt,timed.startedAt);
 assert.equal(measured.amount,3);
});
