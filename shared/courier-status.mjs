const labels = {frontpage:'Front page', lessons:'Lessons', markets:'Markets', companies:'The Ten', practice:'Practice', manitoba:'Manitoba', politics:'Politics', climate:'Climate', tech:'Technology', health:'Health', parenting:'Parenting', sports:'Sports'};

export function publicationState(day, record, now = Date.now()) {
  const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay();
  const expected = day.expectedSections || Object.keys(labels).filter(id => id !== 'lessons' || (weekday > 0 && weekday < 6));
  const blocks = new Map(day.blocks.map(b => [b.id, b]));
  const missing = expected.filter(id => !blocks.has(id));
  const noAudio = expected.filter(id => blocks.has(id) && !blocks.get(id).audio);
  const names = ids => ids.map(id => labels[id] || id).join(', ');
  const sameEdition = record?.generatedAt === day.generatedAt && (record?.updatedAt || null) === (day.updatedAt || null) &&
    Object.keys(record?.audio || {}).length === day.blocks.length && day.blocks.every(b => record.audio[b.id] === (b.audio || ''));
  const active = record?.state === 'updating' && now - Date.parse(record.checkedAt) < 90 * 60 * 1000;
  const gaps = [missing.length ? `Missing: ${names(missing)}.` : '', noAudio.length ? `Audio pending: ${names(noAudio)}.` : ''].filter(Boolean).join(' ');
  if (active) return {label:'Updating', detail:`The edition is being updated. ${gaps} Published sections remain available.`};
  if (missing.length || noAudio.length) return {label:'Partial', detail:gaps};
  if (sameEdition && record.state === 'complete' && record.verifiedAt) return {label:'Complete', detail:`All ${expected.length} sections and their published audio were verified.`};
  if (record?.state === 'failed' || record?.state === 'updating') return {label:'Partial', detail:'The last update did not finish. Available sections can still be played.'};
  return {label:'Partial', detail:'All section links are present. Published audio verification is pending.'};
}

if (typeof window !== 'undefined') {
  let status = null;
  window.CourierPublication = {
    async load() {
      try {
        const response = await fetch('courier/status.json', {cache:'no-store', signal:AbortSignal.timeout(10000)});
        status = response.ok ? await response.json() : null;
      } catch { status = null; }
    },
    render(day) {
      const result = publicationState(day, status?.days?.find(d => d.date === day.date));
      const panel = document.getElementById('editionStatus');
      if (!panel) return;
      panel.dataset.state = result.label.toLowerCase();
      document.getElementById('editionState').textContent = result.label;
      document.getElementById('editionDetail').textContent = result.detail;
    }
  };
}
