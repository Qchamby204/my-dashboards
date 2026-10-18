import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {sql} from 'drizzle-orm';
import {SQLiteSyncDialect} from 'drizzle-orm/sqlite-core';

const root = fileURLToPath(new URL('../../', import.meta.url));
function fixture(run) {
  const dir = mkdtempSync(path.join(tmpdir(), 'atlas-migration-tooling-'));
  try {
    for (const file of ['db', 'drizzle', 'drizzle.config.ts']) cpSync(path.join(root, file), path.join(dir, file), {recursive: true});
    symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
    writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    run(dir);
  } finally { rmSync(dir, {recursive: true, force: true}); }
}
function fingerprints(dir) {
  return Object.fromEntries(readdirSync(dir, {recursive: true}).sort().filter(f => /\.(sql|json)$/.test(f)).map(f => [f, createHash('sha256').update(readFileSync(path.join(dir, f))).digest('hex')]));
}
function generate(dir) {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/drizzle-kit/bin.cjs'), 'generate', '--config=drizzle.config.ts'], {cwd: dir, encoding: 'utf8', timeout: 30000});
  assert.equal(result.status, 0, (result.error?.message || '') + '\n' + (result.stdout + result.stderr).slice(-3000));
  return result.stdout;
}

test('upgraded tooling leaves the current schema and all applied migration bytes unchanged', () => fixture(dir => {
  const migrations = path.join(dir, 'drizzle'), before = fingerprints(migrations);
  assert.match(generate(dir), /No schema changes/);
  assert.deepEqual(fingerprints(migrations), before);
}));

test('upgraded tooling appends an additive migration and preserves existing synthetic SQLite records', () => fixture(dir => {
  const migrations = path.join(dir, 'drizzle'), before = fingerprints(migrations);
  const journalBefore = JSON.parse(readFileSync(path.join(migrations, 'meta/_journal.json')));
  const schemaPath = path.join(dir, 'db/schema.ts'), original = readFileSync(schemaPath, 'utf8');
  const marker = 'archivedAt: text(\'archived_at\'),';
  assert.equal(original.split(marker).length, 2);
  writeFileSync(schemaPath, original.replace(marker, marker + " toolingProbe: text('tooling_probe'),"));
  generate(dir);
  const after = fingerprints(migrations);
  for (const [file, hash] of Object.entries(before)) if (file !== 'meta/_journal.json') assert.equal(after[file], hash, 'Existing migration changed: ' + file);
  const journalAfter = JSON.parse(readFileSync(path.join(migrations, 'meta/_journal.json')));
  assert.deepEqual(journalAfter.entries.slice(0, journalBefore.entries.length), journalBefore.entries);
  assert.equal(journalAfter.entries.length, journalBefore.entries.length + 1);
  assert.equal(journalAfter.version, journalBefore.version);
  assert.equal(journalAfter.dialect, journalBefore.dialect);
  const addedSQL = Object.keys(after).filter(f => f.endsWith('.sql') && !before[f]);
  assert.equal(addedSQL.length, 1);
  const db = new DatabaseSync(':memory:');
  try {
    for (const file of Object.keys(before).filter(f => f.endsWith('.sql')).sort()) db.exec(readFileSync(path.join(migrations, file), 'utf8'));
    db.prepare('INSERT INTO atlas_projects (id,owner,source_id,title,area,status,imported_at) VALUES (?,?,?,?,?,?,?)').run('probe', 'synthetic-owner', 'source-probe', 'Preserve this title', 'Learning', 'done', '2026-10-18');
    const saved = db.prepare('SELECT * FROM atlas_projects').get();
    db.exec(readFileSync(path.join(migrations, addedSQL[0]), 'utf8'));
    assert.deepEqual({...db.prepare('SELECT * FROM atlas_projects').get()}, {...saved, tooling_probe: null});
    assert.ok(db.prepare('PRAGMA table_info(atlas_projects)').all().some(c => c.name === 'tooling_probe'));
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally { db.close(); }
  assert.match(generate(dir), /No schema changes/);
  assert.deepEqual(fingerprints(migrations), after);
}));

test('ORM escapes quoted SQL identifiers without executing identifier text as SQL', () => {
  const db = new DatabaseSync(':memory:'), name = 'value"; DROP TABLE protected; --';
  const quoted = '"' + name.replaceAll('"', '""') + '"';
  try {
    db.exec(`CREATE TABLE probe (${quoted} TEXT); CREATE TABLE protected (id TEXT);`);
    db.prepare(`INSERT INTO probe (${quoted}) VALUES (?)`).run('retained');
    const query = new SQLiteSyncDialect().sqlToQuery(sql`SELECT ${sql.identifier(name)} FROM ${sql.identifier('probe')}`);
    assert.equal(db.prepare(query.sql).get()[name], 'retained');
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='protected'").get().name, 'protected');
  } finally { db.close(); }
});

test('the overridden legacy loader still transforms TypeScript enum and module exports', () => {
  const legacy = createRequire(import.meta.url)('@esbuild-kit/core-utils');
  const result = legacy.transformSync('export enum Mode { First = 40 }; export const value: number = Mode.First + 2;', '/tmp/atlas-synthetic-probe.ts');
  const module = {exports: {}};
  runInNewContext(result.code, {module});
  assert.equal(module.exports.value, 42);
  assert.equal(result.warnings.length, 0);
});
