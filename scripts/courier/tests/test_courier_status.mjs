import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationState } from '../../../shared/courier-status.mjs';

function fixture() {
  const day = {
    date: '2026-09-15',
    generatedAt: '2026-09-15T12:00:00Z',
    expectedSections: ['markets', 'sports'],
    skippedSections: ['parenting'],
    sourceHealth: { degradedSections: ['sports'] },
    blocks: [
      { id: 'markets', audio: 'markets.mp3' },
      { id: 'sports', audio: 'sports.mp3' },
    ],
  };
  const record = {
    date: day.date,
    state: 'complete',
    checkedAt: '2026-09-15T12:05:00Z',
    verifiedAt: '2026-09-15T12:05:00Z',
    generatedAt: day.generatedAt,
    updatedAt: null,
    audio: { markets: 'markets.mp3', sports: 'sports.mp3' },
  };
  return { day, record };
}

test('intentional quiet sections stay complete and are explained', () => {
  const { day, record } = fixture();
  const result = publicationState(day, record, Date.parse('2026-09-15T12:06:00Z'));
  assert.equal(result.label, 'Complete');
  assert.match(result.detail, /Parenting was skipped by design/);
  assert.match(result.detail, /Limited source coverage: Sports/);
  assert.doesNotMatch(result.detail, /Missing: Parenting/);
});

test('real expected-section gaps remain partial', () => {
  const { day, record } = fixture();
  day.blocks = day.blocks.filter(block => block.id !== 'sports');
  delete record.audio.sports;
  const result = publicationState(day, record, Date.parse('2026-09-15T12:06:00Z'));
  assert.equal(result.label, 'Partial');
  assert.match(result.detail, /Missing: Sports/);
  assert.match(result.detail, /Parenting was skipped by design/);
});
