import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
process.env.TZ='America/Winnipeg';
const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../../shared/communicator-ladder-model.js',import.meta.url),'utf8'),context);const M=context.CommunicatorLadderModel;
function rep(index,score=4,extra={}){const c=M.challenges[index];return {id:'attempt-'+index,date:'2026-10-12T15:0'+index+':00Z',drill:M.drill(c.id).name,topic:c.prompt,score:score*20,rubricScores:[score,score,score],rubricVersion:1,scoreOrigin:'self',challenge:{id:c.id,version:1,performed:true,revealed:!!c.interruption},...extra};}
const snap=rows=>M.snapshot(rows,'2026-10-12');
test('empty ladder offers one next action without inventing progress',()=>{const s=snap([]);assert.equal(s.completed,0);assert.equal(s.next.id,'clear-point');assert.equal(s.stages.filter(s=>s.unlocked).length,1);});
test('passing verified compatible records opens one rung at a time',()=>{const s=snap([rep(0)]);assert.equal(s.completed,1);assert.equal(s.next.id,'make-it-land');assert.equal(s.stages[2].unlocked,false);});
test('a weak rubric item cannot be hidden by a high average',()=>{const r=rep(0);r.rubricScores=[5,5,3];r.score=87;assert.equal(snap([r]).completed,0);});
test('default review, unperformed and unrevealed interruption do not pass',()=>{assert.equal(snap([rep(0,3)]).completed,0);const r=rep(0);r.challenge.performed=false;assert.equal(snap([r]).completed,0);const rows=M.challenges.map((_,i)=>rep(i));rows[4].challenge.revealed=false;assert.equal(snap(rows).completed,4);});
test('duplicates, incompatible rubrics and older non-ladder reps do not inflate progress',()=>{assert.equal(snap([rep(0),rep(0)]).attempts,1);assert.equal(snap([rep(0,4,{rubricVersion:2})]).completed,0);assert.equal(snap([rep(0,4,{challenge:undefined})]).completed,0);assert.equal(snap([rep(0,4,{score:100})]).completed,0);});
test('future dates and prematurely imported later-stage successes do not unlock',()=>{assert.equal(snap([rep(0,4,{date:'2026-10-14T00:00:00Z'})]).completed,0);assert.equal(snap([rep(1),rep(0,4,{date:'2026-10-12T15:02:00Z'})]).completed,1);});
test('lower repeat scores keep earned progress and personal best',()=>{const s=snap([rep(0),rep(0,2,{id:'second',date:'2026-10-12T16:00:00Z'})]);assert.equal(s.completed,1);assert.equal(s.stages[0].best,80);assert.equal(s.stages[0].latest.score,40);});
test('completed ladder offers a repeat and accepts out-of-order exports chronologically',()=>{const rows=M.challenges.map((_,i)=>rep(i));const s=snap(rows.reverse());assert.equal(s.completed,5);assert.equal(s.next.unlocked,true);});
test('Winnipeg evening attempts count on their local day',()=>{const r=rep(0,4,{date:'2026-10-13T02:00:00Z'});assert.equal(snap([r]).completed,1);});
test('snapshot is read-only and metadata validation is strict',()=>{const rows=[rep(0)],raw=JSON.stringify(rows);snap(rows);assert.equal(JSON.stringify(rows),raw);assert.throws(()=>M.validate({id:'unknown',version:1,performed:true,revealed:false}));});
