// Atlas's hub owns the active dashboard inventory; this directory retains older resources.
const clean = value => value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
export function hubApps(html) {
  return [...html.matchAll(/<a\b[^>]*class="hub-card"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, body]) => {
    const url = new URL(href, 'https://qchamby204.github.io/my-dashboards/');
    return {path: url.pathname.split('/').pop(), url: url.href, title: clean(body.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] || ''), description: clean(body.match(/<p>([\s\S]*?)<\/p>/)?.[1] || '')};
  }).filter(app => app.path !== 'neural-map.html');
}
const priorRoutes = {'Prospecting Command Center': 'prospecting-command-center.html', 'Operations Cadence': 'operations-cadence.html'};
export function buildCatalog(resources, apps) {
  const cats = structuredClone(resources), used = new Set();
  for (const cat of cats) for (const group of cat.groups || [cat]) for (const tool of group.tools) {
    const path = priorRoutes[tool.full] || (tool.doors || []).find(d => d.k === 'live')?.url.split('/').pop();
    const app = apps.find(a => a.path === path);
    if (app) {
      used.add(app.path); tool.aliases = [tool.full, tool.file]; tool.full = app.title; tool.file = app.description;
      tool.path = app.path; tool.resourceType = 'dashboard'; tool.note = '';
      tool.doors = [{k: 'live', label: 'Open dashboard', url: app.url}, ...(tool.doors || []).filter(d => d.k !== 'live')];
    } else {
      tool.resourceType = tool.savedFiles?.length ? 'saved' : (tool.doors || []).some(d => /^https?:/.test(d.url)) ? 'external' : (tool.doors || []).some(d => /^file:/.test(d.url)) ? 'device' : 'unresolved';
    }
  }
  for (const app of apps.filter(a => !used.has(a.path))) {
    const work = ['the-herald.html', 'the-aqueduct.html', 'crucible.html'].includes(app.path);
    const cat = cats.find(c => c.key === (work ? 'work' : 'personal'));
    const group = work ? cat.groups.find(g => g.title === (app.path === 'the-herald.html' ? 'Practice' : 'Clients')) : cat;
    group.tools.push({id: 'app-' + app.path.replace('.html', ''), label: app.title, full: app.title, file: app.description, path: app.path, resourceType: 'dashboard', doors: [{k: 'live', label: 'Open dashboard', url: app.url}]});
  }
  // Preserve original resource IDs (and favourites), but give the enlarged branches room.
  cats.find(c => c.key === 'work').position = [500, 180];
  cats.find(c => c.key === 'work').groups.forEach((g, i) => {
    g.position = [140 + i * 360, -80];
    const columns = g.title === 'Clients' ? 2 : 1;
    const rows = Math.ceil(g.tools.length / columns);
    g.slots = g.tools.map((_, n) => [columns === 2 && n >= rows ? 160 : g.title === 'Practice' ? 150 : -150, (n % rows - (rows - 1) / 2) * 58, columns === 2 && n >= rows || g.title === 'Practice' ? 'R' : 'L']);
  });
  const personal = cats.find(c => c.key === 'personal'); personal.position = [-40, 600];
  personal.slots = personal.tools.map((_, i) => [-250, (i - (personal.tools.length - 1) / 2) * 58, 'L']);
  const ent = cats.find(c => c.key === 'ent'); ent.position = [1000, 470];
  ent.slots = ent.tools.map((_, i) => [250, (i - (ent.tools.length - 1) / 2) * 58, 'R']);
  const bfc = cats.find(c => c.key === 'bfc'); bfc.position = [500, 1000];
  bfc.slots = bfc.tools.map((_, i) => [(i - (bfc.tools.length - 1) / 2) * 210, 200, 'D']);
  return cats;
}
