import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../../shared/atlas-theme.js', import.meta.url), 'utf8');
const key = 'atlas.appearance.v1';
function boot({ saved, dark = false, blocked = false, href = 'https://atlas-os-quinton.qchambers123018.chatgpt.site/#today' } = {}) {
  const values = new Map(saved === undefined ? [] : [[key, saved]]);
  const listeners = new Map(), documentListeners = new Map(), mediaListeners = new Map();
  const root = { classList: { contains: () => true }, dataset: { atlasApp: 'atlas-os' } };
  const meta = {};
  const system = { matches: dark, addEventListener: (name, fn) => mediaListeners.set(name, fn) };
  const location = new URL(href), history = { state: { preserved: true }, replaceState(state, unused, path) { this.path = path; this.nextState = state; } };
  const document = { documentElement: root, readyState: 'loading', querySelectorAll: () => [meta], addEventListener: (name, fn) => documentListeners.set(name, fn) };
  const window = { matchMedia: () => system, addEventListener: (name, fn) => listeners.set(name, fn), dispatchEvent() {} };
  const localStorage = { getItem(k) { if (blocked) throw Error('blocked'); return values.get(k) ?? null; }, setItem(k, v) { if (blocked) throw Error('blocked'); values.set(k, v); } };
  runInNewContext(source, { window, document, localStorage, location, history, URL, CustomEvent: class { constructor(name, options) { this.type = name; this.detail = options.detail; } }, getComputedStyle: () => ({ getPropertyValue: name => name === '--neo-line' ? '#48586d' : '#b5c3d6' }) });
  return { root, meta, window, values, system, history, documentListeners, listeners, mediaListeners };
}

test('appearance resolves before DOM readiness and respects an explicit override', () => {
  const auto = boot({ dark: true });
  assert.equal(auto.root.dataset.atlasAppearance, 'system');
  assert.equal(auto.root.dataset.atlasTheme, 'dark');
  assert.equal(auto.meta.content, '#202936');
  const manual = boot({ saved: 'light', dark: true });
  assert.equal(manual.root.dataset.atlasTheme, 'light');
  assert.equal(manual.meta.content, '#e7ecf2');
  manual.window.AtlasAppearance.set('dark');
  assert.equal(manual.values.get(key), 'dark');
  assert.equal(boot({ saved: manual.values.get(key) }).root.dataset.atlasTheme, 'dark');
});

test('system changes and other-tab preferences update the resolved theme', () => {
  const app = boot();
  app.system.matches = true;
  app.mediaListeners.get('change')();
  assert.equal(app.root.dataset.atlasTheme, 'dark');
  app.window.AtlasAppearance.set('light');
  app.mediaListeners.get('change')();
  assert.equal(app.root.dataset.atlasTheme, 'light');
  app.listeners.get('storage')({ key, newValue: 'dark' });
  assert.equal(app.window.AtlasAppearance.get(), 'dark');
  app.listeners.get('storage')({ key: 'other-app-data', newValue: 'light' });
  assert.equal(app.window.AtlasAppearance.get(), 'dark');
  app.listeners.get('storage')({ key, newValue: null });
  assert.equal(app.window.AtlasAppearance.get(), 'system');
});

test('invalid preferences and unavailable browser storage do not break appearance', () => {
  const invalid = boot({ saved: 'invalid', dark: true });
  assert.equal(invalid.window.AtlasAppearance.get(), 'system');
  invalid.window.AtlasAppearance.set('unexpected');
  assert.equal(invalid.window.AtlasAppearance.get(), 'system');
  const blocked = boot({ blocked: true });
  assert.doesNotThrow(() => blocked.window.AtlasAppearance.set('dark'));
  assert.equal(blocked.root.dataset.atlasTheme, 'dark');
});

test('validated cross-origin handoff preserves unrelated URL and history state', () => {
  const app = boot({ href: 'https://atlas-os-quinton.qchambers123018.chatgpt.site/?view=all&atlas-theme=dark#apps' });
  assert.equal(app.window.AtlasAppearance.get(), 'dark');
  assert.equal(app.values.get(key), 'dark');
  assert.equal(app.history.path, '/?view=all#apps');
  assert.deepEqual(app.history.nextState, { preserved: true });
  const invalid = boot({ href: 'https://atlas-os-quinton.qchambers123018.chatgpt.site/?atlas-theme=unexpected' });
  assert.equal(invalid.window.AtlasAppearance.get(), 'system');
});

test('handoff applies only to the Atlas suite and preserves external and excluded links', () => {
  const app = boot({ saved: 'dark' });
  function visit(href) {
    const link = { href, hasAttribute: () => false };
    app.documentListeners.get('click')({ target: { closest: () => link } });
    return link.href;
  }
  assert.equal(new URL(visit('https://qchamby204.github.io/my-dashboards/life-map.html#projects')).searchParams.get('atlas-theme'), 'dark');
  for (const href of ['https://example.com/', 'https://qchamby204.github.io/my-dashboards/gang-ops-roadmap.html', 'https://qchamby204.github.io/my-dashboards/test-booking-downtown.html', 'https://qchamby204.github.io/another-site/', 'https://atlas-os-quinton.qchambers123018.chatgpt.site/#week']) assert.equal(visit(href), href);
});

test('theme changes repaint chart labels without changing datasets or restarting animations', () => {
  const app = boot();
  const calls = [], data = { datasets: [{ data: [3, 6, 9] }] };
  const chart = { data, options: { scales: { x: { ticks: {}, grid: {} } }, plugins: { legend: { labels: {} } } }, update: mode => calls.push(mode) };
  app.window.Chart = { instances: { chart } };
  app.window.AtlasAppearance.set('dark');
  assert.equal(chart.options.scales.x.ticks.color, '#b5c3d6');
  assert.equal(chart.options.scales.x.grid.color, '#48586d');
  assert.equal(chart.options.plugins.legend.labels.color, '#b5c3d6');
  assert.deepEqual(data.datasets[0].data, [3, 6, 9]);
  assert.deepEqual(calls, ['none']);
  app.window.AtlasAppearance.set('dark');
  assert.equal(calls.length, 1);
});
