import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
function fixture(run) {
  const dir = mkdtempSync(path.join(tmpdir(), 'atlas-asset-scope-'));
  try {
    mkdirSync(path.join(dir, 'shared')); mkdirSync(path.join(dir, 'atlas'));
    for (const f of readdirSync(path.join(root, 'shared'))) if (/\.(css|js|mjs)$/.test(f)) cpSync(path.join(root, 'shared', f), path.join(dir, 'shared', f));
    for (const f of readdirSync(root)) if (/\.(html|webmanifest)$/.test(f)) cpSync(path.join(root, f), path.join(dir, f));
    for (const f of ['build-experience.mjs', 'asset-versions.mjs', 'life-map-legacy.html', 'index.html']) cpSync(path.join(root, 'atlas', f), path.join(dir, 'atlas', f));
    run(dir);
  } finally { rmSync(dir, {recursive: true, force: true}); }
}
function build(dir) {
  const result = spawnSync(process.execPath, ['atlas/build-experience.mjs'], {cwd: dir, encoding: 'utf8', timeout: 30000});
  assert.equal(result.status, 0, result.error?.message || result.stderr);
}
function snapshot(dir) {
  const files = [...readdirSync(dir).filter(f => f.endsWith('.html')), 'atlas/life-map-legacy.html', 'atlas/index.html', 'shared/atlas-theme.js', 'shared/communicator-theme.js'];
  return Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(path.join(dir, f))).digest('hex')]));
}

for (const [asset, page] of [['hourglass-enhancements.css','the-hourglass'],['hourglass-enhancements.js','the-hourglass'],['ledger-enhancements.css','life-ledger'],['ledger-enhancements.js','life-ledger'],['forge-enhancements.css','workout-forge'],['communication-enhancements.css','communication-trainer'],['operations-enhancements.css','operations-cadence'],['baby-enhancements.css','baby-brain'],['neural-enhancements.css','neural-map'],['prospecting-review.js','prospecting-command-center'],['courier-experience.js','courier']]) {
  test(`${asset} invalidates only its owning HTML, preserving shared theme and unrelated entries`, () => fixture(dir => {
    build(dir); const before = snapshot(dir);
    appendFileSync(path.join(dir, 'shared', asset), '\n/* Isolated build-scope regression probe. */\n');
    build(dir); const after = snapshot(dir);
    assert.deepEqual(Object.keys(before).filter(f => before[f] !== after[f]), [page+'.html']);
    const html = readFileSync(path.join(dir, 'the-hourglass.html'), 'utf8');
    assert.equal([...html.matchAll(/<script[^>]+src="shared\/hourglass-enhancements\.js[^"\n]*"[^>]*defer/g)].length, 1);
  }));
}
