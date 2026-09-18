"""Apply only the reviewed Life Map source delta after checksum verification."""
import base64
import hashlib
import json
import lzma
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PART_HASHES = [
    'b7e7dfe1e19c0b9fa19e26a106a898311db851dc3082ef5516bd735227a4aebc',
    'b10eb38c376788ffb58835c2c68a52df3be0dd5bdb0a04e44bbbb4c38b1cbf15',
    'a53ed1c85f6a8de1e24e78abf93b3e05ac3450522dd7e31783a2c3657a79613f',
    '54902d1052ff43b4c7c0607a37c56b6618e9e90cc15c18f645be4059a9f38071',
    'a5ff33b2b3ac5492d6685f3f1073bd84a605fe7b15f13047c6355d4c941116c4',
    'efaeaf17cd0d6e14c127d2be4908f211597bd3437d1c634d4226eed2401e6ab4',
    '51ba9ed2e74fe163c50b8f6012287e750896e7a7fa77c20827f5fbe9e8962f0b',
]
ALLOWED = {
    'atlas/LIFE-MAP-WORKFLOW.md', 'atlas/build-life-map.mjs',
    'atlas/connected-bootstrap.js', 'atlas/connected-build.mjs',
    'atlas/connected-model.mjs', 'atlas/life-map-dashboard.css',
    'atlas/life-map-dashboard.js', 'atlas/life-map-interactions.js',
    'atlas/life-map-legacy.html', 'atlas/life-map-local.js',
    'atlas/life-map-records.mjs', 'atlas/life-map-workflow-core.mjs',
    'atlas/tests/connected-client.test.mjs', 'atlas/tests/life-map-browser.py',
    'atlas/tests/life-map-interactions.test.mjs', 'atlas/tests/life-map-local.test.mjs',
    'atlas/tests/life-map-workflow.test.mjs', 'shared/atlas-activity.js',
    'shared/atlas-mobile.js', 'shared/atlas-theme.js',
}
def digest(data):
    return hashlib.sha256(data).hexdigest()

parts = []
for index, expected in enumerate(PART_HASHES):
    data = (ROOT / f'scripts/lm-upgrade-pack-{index:02d}.txt').read_bytes()
    if digest(data) != expected:
        raise ValueError(f'Package part {index:02d} checksum mismatch: {digest(data)}')
    parts.append(data)
raw = lzma.decompress(base64.b64decode(b''.join(parts), validate=True))
if digest(raw) != '4066edf681a3e3ba35bb718bef78e36b1373a0a6b5091c2a31bf457859357a4b':
    raise ValueError('Source package checksum mismatch')
records = json.loads(raw)
if not isinstance(records, list) or len(records) != len(ALLOWED) or {r['path'] for r in records} != ALLOWED:
    raise ValueError('Unexpected release paths')
outputs = []
for record in records:
    target = ROOT / record['path']
    if target.is_symlink() or not target.resolve().is_relative_to(ROOT):
        raise ValueError('Unsafe release path')
    if record['base'] is None:
        if target.exists():
            raise ValueError(f'New file already exists: {record["path"]}')
        before = b''
    else:
        before = target.read_bytes()
        if digest(before) != record['base']:
            raise ValueError(f'Source changed since review: {record["path"]}')
    lines = before.decode('utf-8').splitlines(keepends=True)
    edits = record['edits']
    previous_end = 0
    for start, end, text in edits:
        if not isinstance(start, int) or not isinstance(end, int) or not previous_end <= start <= end <= len(lines) or not isinstance(text, str):
            raise ValueError('Invalid source edit')
        previous_end = end
    for start, end, text in reversed(edits):
        lines[start:end] = text.splitlines(keepends=True)
    after = ''.join(lines).encode('utf-8')
    if digest(after) != record['sha']:
        raise ValueError(f'Output checksum mismatch: {record["path"]}')
    outputs.append((target, after))
# Verify the entire package before changing any source files.
for target, data in outputs:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
Path('/tmp/lm-release-paths.json').write_text(json.dumps([r['path'] for r in records]))
print(f'Applied {len(outputs)} checksum-verified Life Map source files.')
