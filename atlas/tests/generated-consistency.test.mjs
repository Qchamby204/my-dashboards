import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {checkGenerated} from '../check-generated.mjs';

function fixture(run) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'atlas-generated-'));
  const git = (...args) => execFileSync('git', args, {cwd: root, stdio: 'pipe'});
  try {
    git('init', '-q');
    writeFileSync(path.join(root, 'output.html'), 'current');
    writeFileSync(path.join(root, 'generate.mjs'), "import {writeFileSync} from 'node:fs'; writeFileSync('output.html', 'current');");
    git('add', '.');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture');
    run(root, git);
  } finally { rmSync(root, {recursive: true, force: true}); }
}
test('generation accepts committed current output and ignores untracked build output', () => fixture(root => {
  writeFileSync(path.join(root, 'untracked.txt'), 'temporary');
  assert.equal(checkGenerated(root, ['generate.mjs']), 0);
}));
test('generation fails when it repairs stale committed output', () => fixture((root, git) => {
  writeFileSync(path.join(root, 'output.html'), 'stale');
  git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'stale');
  assert.equal(checkGenerated(root, ['generate.mjs']), 1);
}));
test('generation fails even when unexpected tracked changes are staged', () => fixture((root, git) => {
  writeFileSync(path.join(root, 'other.txt'), 'unexpected'); git('add', '.');
  assert.equal(checkGenerated(root, ['generate.mjs']), 1);
}));
test('generation preserves a failed build exit code', () => fixture(root => {
  assert.equal(checkGenerated(root, ['-e', 'process.exit(7)']), 7);
}));
