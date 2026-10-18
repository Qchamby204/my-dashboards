import {spawnSync} from 'node:child_process';
import {readFileSync, appendFileSync} from 'node:fs';
import path from 'node:path';

const pins = JSON.parse(readFileSync(new URL('../browser-tooling.json', import.meta.url)));
const runtime = process.env.PW_RUNTIME || 'npm';
const browsers = (process.env.PW_BROWSERS || 'chromium').trim().split(/\s+/);
if (!['npm', 'python'].includes(runtime) || browsers.some(b => !['chromium', 'webkit'].includes(b))) throw Error('Unsupported browser test runtime or engine.');
const prefix = path.join(process.env.RUNNER_TEMP || '/tmp', 'atlas-browser');
function run(command, args, capture = false) {
  const result = spawnSync(command, args, {stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${command} failed (${result.status}): ${result.stderr || ''}`);
  return result.stdout;
}
let manifest;
if (runtime === 'npm') {
  run('npm', ['install', '--prefix', prefix, '--no-save', '--no-package-lock', '--ignore-scripts', `playwright@${pins.npm}`]);
  manifest = JSON.parse(readFileSync(path.join(prefix, 'node_modules/playwright-core/browsers.json')));
} else {
  run('python', ['-m', 'pip', 'install', `playwright==${pins.python}`]);
  manifest = JSON.parse(run('python', ['-c', 'import pathlib, playwright; print((pathlib.Path(playwright.__file__).parent / "driver/package/browsers.json").read_text())'], true));
}
for (const browser of ['chromium', 'webkit']) {
  if (manifest.browsers.find(b => b.name === browser)?.revision !== pins.revisions[browser]) throw Error(`Unexpected ${runtime} ${browser} revision. Review both bindings before updating pins.`);
}
console.log(`Verified Playwright ${runtime} ${pins[runtime]} browser revisions: ${JSON.stringify(pins.revisions)}`);
if (runtime === 'npm') {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `node-path=${path.join(prefix, 'node_modules')}\n`);
  run(process.execPath, [path.join(prefix, 'node_modules/playwright/cli.js'), 'install', '--with-deps', ...browsers]);
} else {
  run('python', ['-m', 'playwright', 'install', '--with-deps', ...browsers]);
}
