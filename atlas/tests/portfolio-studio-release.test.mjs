import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const studio = readFileSync(new URL('../../portfolio-studio.html', import.meta.url), 'utf8');

test('the published Studio includes purchasing power and saved meetings alongside projected returns', () => {
  // A projection-only HTML export previously replaced the complete Studio.
  assert.match(studio, /<button\b[^>]*\bdata-page="purchasing-power"/);
  assert.match(studio, /<section\b[^>]*\bid="purchasing-power"/);
  assert.match(studio, /<dialog\b[^>]*\bid="sequenceSetup"/);
  assert.match(studio, /id="pjRange"/);
});
