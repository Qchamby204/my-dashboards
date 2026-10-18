import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createLogger, createServer} from 'vite';

test('the actual preview client scans without archived-HTML resolution errors and serves JS/CSS', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const cacheDir = mkdtempSync(path.join(tmpdir(), 'atlas-vite-entry-')), errors = [];
  const logger = createLogger('silent'); logger.error = message => errors.push(message);
  let server;
  try {
    server = await createServer({root, cacheDir, server: {host: '127.0.0.1', port: 0}, customLogger: logger});
    await server.listen(); await server.environments.client.depsOptimizer?.scanProcessing;
    assert.deepEqual(errors, []);
    const port = server.httpServer.address().port;
    const response = await new Promise((resolve, reject) => {
      // The isolated preview bridge deliberately requires this documented Host.
      const request = http.get({host: '127.0.0.1', port, path: '/', headers: {host: 'terminal.local:4173'}}, res => {
        let body = ''; res.on('data', chunk => body += chunk); res.on('end', () => resolve({status: res.statusCode, body}));
      });
      request.on('error', reject);
    });
    assert.equal(response.status, 200); assert.match(response.body, /<html/);
    for (const file of ['/atlas/app.js', '/atlas/style.css']) assert.ok((await server.transformRequest(file))?.code.length, file);
    assert.deepEqual(errors, []);
  } finally { await server?.close(); rmSync(cacheDir, {recursive: true, force: true}); }
});
