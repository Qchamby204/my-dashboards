import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// CI starts from the committed tree. Compare against HEAD, including staged
// changes, so generation cannot silently repair an outdated committed asset.
export function checkGenerated(root, build = ['atlas/build.mjs']) {
  const result = spawnSync(process.execPath, build, {cwd: root, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) return result.status || 1;
  const diff = spawnSync('git', ['diff', '--name-only', '-z', 'HEAD', '--'], {cwd: root, encoding: 'utf8'});
  if (diff.error) throw diff.error;
  if (diff.status !== 0) throw Error(diff.stderr || 'Could not inspect the generated tree.');
  const changed = diff.stdout.split('\0').filter(Boolean);
  if (!changed.length) return 0;
  console.error('Committed files are out of date after generation. Run npm run build, review and commit the resulting files:\n' + changed.map(p => '  ' + p).join('\n'));
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = checkGenerated(fileURLToPath(new URL('../', import.meta.url)));
}
