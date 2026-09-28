import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const page = new URL('https://qchamby204.github.io/my-dashboards/the-library.html');
const html = read('the-library.html').toString();
const head = html.match(/<head>([\s\S]*?)<\/head>/i)[1];
const hash = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 12);
function tag(name, attribute, value) {
  const matches = [...head.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))]
    .map(match => Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]])))
    .filter(attrs => attrs[attribute] === value);
  assert.equal(matches.length, 1, `one ${name}[${attribute}="${value}"] inside head`);
  return matches[0];
}
function asset(href, base = page) {
  const url = new URL(href, base);
  assert.equal(url.origin, page.origin);
  assert.ok(url.pathname.startsWith('/my-dashboards/'), url.href);
  const bytes = read(url.pathname.slice('/my-dashboards/'.length));
  assert.equal(url.searchParams.get('v'), hash(bytes), `content version: ${url.pathname}`);
  return {url, bytes};
}
function png(bytes, size) {
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(bytes.readUInt32BE(16), size);
  assert.equal(bytes.readUInt32BE(20), size);
}

test('Library head contains real markup and complete iOS install metadata', () => {
  assert.doesNotMatch(head, /\\n/);
  // Text between head elements makes the HTML parser close head prematurely.
  const text = head.replace(/<(script|style|title)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').trim();
  assert.equal(text, '');
  assert.equal(tag('meta', 'name', 'apple-mobile-web-app-capable').content, 'yes');
  assert.equal(tag('meta', 'name', 'mobile-web-app-capable').content, 'yes');
  assert.equal(tag('meta', 'name', 'apple-mobile-web-app-title').content, 'Library');
  assert.equal(tag('meta', 'name', 'apple-mobile-web-app-status-bar-style').content, 'black-translucent');
  assert.equal(tag('meta', 'name', 'format-detection').content, 'telephone=no');
  assert.match(tag('meta', 'name', 'viewport').content, /viewport-fit=cover/);
  assert.equal(tag('meta', 'name', 'theme-color').content, '#0b1422');
  const apple = tag('link', 'rel', 'apple-touch-icon');
  assert.equal(apple.sizes, '180x180');
  png(asset(apple.href).bytes, 180);
});

test('Library stays in the shared icon pipeline and versions its changed runtime', () => {
  assert.equal(JSON.parse(read('shared/icons/catalog.json'))['the-library.html'], 'library');
  const icons = [...head.matchAll(/<link\b[^>]*rel="icon"[^>]*>/g)].map(m => m[0]);
  assert.equal(icons.length, 2);
  for (const size of [32, 64]) {
    const icon = icons.find(value => value.includes(`sizes="${size}x${size}"`));
    assert.ok(icon, `${size}px browser icon`);
    png(asset(icon.match(/href="([^"]+)"/)[1]).bytes, size);
  }
  asset(html.match(/<script src="(shared\/library\.js\?[^\"]+)"/)[1]);
});

test('Library manifest launches the existing Pages route with real, correctly sized icons', () => {
  const {url, bytes} = asset(tag('link', 'rel', 'manifest').href);
  const manifest = JSON.parse(bytes);
  assert.equal(url.pathname, '/my-dashboards/library.webmanifest');
  assert.equal(manifest.name, 'The Library · Atlas OS');
  assert.equal(manifest.short_name, 'Library');
  assert.equal(new URL(manifest.start_url, url).href, page.href + '#home');
  const scope = new URL(manifest.scope, url);
  assert.equal(scope.href, new URL('./', page).href);
  assert.ok(new URL(manifest.start_url, url).href.startsWith(scope.href));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#0b1422');
  assert.equal(manifest.background_color, '#0b1422');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(item => item.sizes === `${size}x${size}`);
    assert.ok(icon, `${size}px install icon`);
    assert.equal(icon.type, 'image/png');
    assert.equal(icon.purpose, 'any');
    png(asset(icon.src, url).bytes, size);
  }
});

// Run the unmodified application entry point with inert DOM nodes and observable storage.
function boot(saved, theme = 'system') {
  const nodes = new Map(), writes = [], events = new Map();
  const storage = new Map([['atlas.appearance.v1', theme]]);
  if (saved !== undefined) storage.set('atlas.library.v1', saved);
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {dataset: {}, style: {}, innerHTML: '', textContent: '',
      addEventListener() {}, querySelectorAll: () => []});
    return nodes.get(selector);
  };
  const document = {documentElement: node('html'), querySelector: node, querySelectorAll: () => [],
    addEventListener: (type, fn) => events.set(type, fn)};
  const window = {addEventListener() {}};
  const context = vm.createContext({window, document, location: {hash: '#home'},
    matchMedia: () => ({matches: false, addEventListener() {}}),
    localStorage: {getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => {writes.push(key); storage.set(key, value);}}});
  for(const path of ['shared/library-reading.js','shared/library-art.js','shared/library-pages.js','shared/library-catalog.js']) vm.runInContext(read(path).toString(), context);
  vm.runInContext(read('shared/library.js').toString(), context);
  return {window, nodes, writes, events, storage};
}

test('Library starts with 129 unique seed books without writing records or appearance', () => {
  for (const theme of ['system', 'light', 'dark']) {
    const app = boot(undefined, theme);
    assert.equal(app.window.LibraryInfo.seedBooks, 129);
    assert.equal(app.window.LibraryInfo.storageKey, 'atlas.library.v1');
    assert.equal(new Set(app.window.ATLAS_LIBRARY_CATALOG.books.map(b => b.id)).size, 129);
    assert.deepEqual(app.writes, []);
    assert.equal(app.nodes.get('meta[name=theme-color]').content, '#0b1422');
  }
});

test('Library reopening preserves custom records, notes, syntheses, backups and storage keys', () => {
  const seed = boot().window.ATLAS_LIBRARY_CATALOG.books;
  const saved = JSON.stringify({schemaVersion: 1, catalog: [...seed,
    {id: 'custom-kept', title: 'My purchased book', author: 'Test author', topic: '1', subtopic: '1Xkept'}],
    customSubtopics: [{topic: '1', id: '1Xkept', title: 'My subtopic'}],
    progress: {'custom-kept': {status: 'reading', notes: 'Keep my notes', takeaway: 'Keep this idea'}},
    syntheses: {'1:1Xkept': {summary: 'My draft', published: {text: 'My understanding', at: '2026-09-26'},
      history: [{text: 'Earlier understanding', at: '2026-09-25'}]}},
    focus: {topic: '1', subtopic: '1Xkept'}, createdAt: '2026-09-25', updatedAt: '2026-09-26', lastBackupAt: '2026-09-26'});
  const app = boot(saved, 'dark');
  assert.deepEqual(app.writes, []);
  assert.equal(app.storage.get('atlas.library.v1'), saved);
  assert.equal(app.storage.get('atlas.appearance.v1'), 'dark');
  // A normal note edit must retain the custom catalogue and all other saved data.
  app.events.get('input')({target: {dataset: {bookNote: 'custom-kept', field: 'notes'}, value: 'Updated note'}});
  const after = JSON.parse(app.storage.get('atlas.library.v1'));
  assert.deepEqual(app.writes, ['atlas.library.v1']);
  assert.equal(after.catalog.length, 130);
  for (const field of ['catalog', 'customSubtopics', 'focus', 'createdAt', 'lastBackupAt'])
    assert.deepEqual(after[field], JSON.parse(saved)[field], field);
  assert.equal(after.progress['custom-kept'].notes, 'Updated note');
  assert.equal(after.progress['custom-kept'].takeaway, 'Keep this idea');
  assert.equal(after.syntheses['1:1Xkept'].published.text, 'My understanding');
  assert.equal(after.syntheses['1:1Xkept'].history[0].text, 'Earlier understanding');
});

test('Library opening unreadable saved records never overwrites the recovery data', () => {
  const raw = '{unreadable';
  const app = boot(raw);
  assert.deepEqual(app.writes, []);
  assert.equal(app.storage.get('atlas.library.v1'), raw);
  assert.match(app.nodes.get('#storage-banner').innerHTML, /original data has not been overwritten/);
});


test('Library reading records survive reopening and note edits with legacy storage unchanged', () => {
  const catalog=boot().window.ATLAS_LIBRARY_CATALOG.books;
  const reading={pageCounts:{[catalog[0].id]:5000},pagesRead:{[catalog[0].id]:125},goals:{'1:all':'2027-01-01','1:1A':'2026-12-01'}};
  const saved=JSON.stringify({schemaVersion:1,catalog,progress:{},syntheses:{},reading});
  const app=boot(saved);
  assert.deepEqual(app.writes,[]);
  assert.equal(app.storage.get('atlas.library.v1'),saved);
  app.events.get('input')({target:{dataset:{bookNote:catalog[0].id,field:'notes'},value:'Keep my page goals'}});
  const after=JSON.parse(app.storage.get('atlas.library.v1'));
  assert.deepEqual(after.reading,reading);
  assert.equal(after.progress[catalog[0].id].notes,'Keep my page goals');
});

test('invalid saved page goals preserve the original record for recovery', () => {
  const catalog=boot().window.ATLAS_LIBRARY_CATALOG.books;
  const saved=JSON.stringify({schemaVersion:1,catalog,reading:{goals:{'1:all':'not a date'}}});
  const app=boot(saved);
  assert.deepEqual(app.writes,[]);
  assert.equal(app.storage.get('atlas.library.v1'),saved);
  assert.match(app.nodes.get('#storage-banner').innerHTML,/original data has not been overwritten/);
});
