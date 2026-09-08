import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicationState} from '../../shared/courier-status.mjs';

const day = {date:'2026-09-08', generatedAt:'2026-09-08T12:00:00Z', expectedSections:['markets','sports'], blocks:[{id:'sports',audio:'sports.mp3'}]};
test('a partial edition names missing sections', () => {
  assert.equal(publicationState(day).label, 'Partial');
  assert.match(publicationState(day).detail, /Markets/);
});
test('complete requires verification of this exact edition and audio', () => {
  const full = {...day,blocks:[...day.blocks,{id:'markets',audio:'markets.mp3'}]};
  const proof = {state:'complete', generatedAt:day.generatedAt, verifiedAt:'2026-09-08T12:10:00Z', audio:{sports:'sports.mp3',markets:'markets.mp3'}};
  assert.equal(publicationState(full,proof).label,'Complete');
  assert.equal(publicationState({...full,updatedAt:'2026-09-08T13:00:00Z'},proof).label,'Partial');
  assert.equal(publicationState(full,{...proof,audio:{...proof.audio,markets:'old.mp3'}}).label,'Partial');
});
test('stale updating state does not imply a repair is still running', () => {
  const record = {state:'updating',checkedAt:'2026-09-08T12:00:00Z'};
  assert.equal(publicationState(day,record,Date.parse('2026-09-08T12:10:00Z')).label,'Updating');
  assert.equal(publicationState(day,record,Date.parse('2026-09-08T14:00:00Z')).label,'Partial');
});
